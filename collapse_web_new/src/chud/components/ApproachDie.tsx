import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { ApproachDieResult, ApproachRollResult, DieSides } from "../../domain/approachDice"
import { rollFlatDice } from "../../domain/approachDice"
import { addSetRollRow } from "../../utils/chudVanillaBridge"
import { getRollMode } from "../../domain/rollMode"
import { hasPendingNotification, pushNotification } from "../../domain/notifications"
import { STAT_AND_METHOD_MAX } from "../../domain/coreApproachMap"

export type ApproachDieRollResult = ApproachRollResult

const ROLL_ANIM_TICKS = 8
const ROLL_ANIM_INTERVAL_MS = 60
const CHARGE_THRESHOLD_MS = 500
const ERROR_FLASH_MS = 420
const VIBRATE_START_MS = 180
const VIBRATE_MIN_MS = 45
const VIBRATE_STEP_MS = 18
const VIBRATE_PULSE_MS = 28

type PopupView = "result" | "margin-input" | "margin-result" | "damage"

const dieLabel = (die: DieSides) => `D${die}`

// Method row — printed-sheet style: the track is a fixed 1-6 numbered
// circle row (never a glowing number). A solid marker sits on the current
// (base) pool size; a faint ghost marker sits on the full (base) rating so
// a depleted pool still shows where "full" is. Tapping a circle sets the
// current pool directly — this is a player correction/bookkeeping action,
// not a roll trigger. Holding the row (vibrating/stuttering as it "spins
// up") is what actually rolls the pool, and releasing fires using however
// many dice are in the current pool right now (base-available + Wardrobe).
//
// Wardrobe dice are a separate, non-depleting square box next to the track
// ("Wardrobe adds dice to that Method's roll only") — they're always
// rolled, but are never part of the Overload-spendable pool, so they never
// appear as track circles and can't be Overloaded away.
//
// Past the roll, the popup offers Overload (tap a die to preview doubling
// it), which only actually spends from the base pool once the player
// presses Resolve — until then they can freely undo by tapping again, or
// via the Undo button. From there, two paths continue: send the Total to
// the HUD's Set Roll list, or turn it into a Margin against an Opposition
// roll. A positive Margin can then be spent on a flat (non-exploding)
// Wound roll — individual dice are checked against a Wound
// Threshold/Target so the player can read off how many "successes" they
// have to announce at the table. None of this adjudicates anything; it
// only surfaces the numbers.
export function ApproachDie({
  label,
  baseRating,
  wardrobeBonus = 0,
  wardrobeItems = [],
  available,
  damageDie,
  onRoll,
  onOverload,
  onSetAvailable,
}: {
  label: string
  /** Core-distributed rating alone (before Wardrobe) — the track's full/ghost count and the Overload-spendable pool size. */
  baseRating: number
  /** Extra dice granted by Wardrobe items assigned to this Method. Always rolled; never part of the track or the Overload pool. */
  wardrobeBonus?: number
  /** Wardrobe item names/bonuses contributing to wardrobeBonus, for a tooltip. */
  wardrobeItems?: string[]
  /** Base-pool dice currently available (baseRating minus any Overloaded-and-spent dice). */
  available: number
  /** Weapon Quality die size, used for the post-Margin Wound roll. */
  damageDie: DieSides
  onRoll: (count: number) => ApproachDieRollResult
  /** Doubles one rolled die's value and spends it from the Overload pool. Returns false if the pool is exhausted. */
  onOverload?: (dieIndex: number) => boolean
  /** Directly sets the base pool's current/available count (tapping a track circle). */
  onSetAvailable?: (next: number) => void
}) {
  const [errorFlash, setErrorFlash] = useState(false)
  const [result, setResult] = useState<ApproachDieRollResult | null>(null)
  const [pendingOverload, setPendingOverload] = useState<Set<number>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [charging, setCharging] = useState(false)
  const [pressing, setPressing] = useState(false)
  const [view, setView] = useState<PopupView>("result")
  const [oppositionInput, setOppositionInput] = useState("")
  const [margin, setMargin] = useState<number | null>(null)
  const [damageDice, setDamageDice] = useState<number[]>([])
  const [woundValue, setWoundValue] = useState("")
  const [woundMode, setWoundMode] = useState<"threshold" | "target">("threshold")
  const rollAnimTimer = useRef<number | null>(null)
  const errorFlashTimer = useRef<number | null>(null)
  const chargeStartTimer = useRef<number | null>(null)
  const vibrateTimer = useRef<number | null>(null)
  const suppressClick = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const closePopup = useCallback(() => {
    setResult(null)
    setRolling(false)
    setPendingOverload(new Set())
    setResolved(false)
    setView("result")
    setOppositionInput("")
    setMargin(null)
    setDamageDice([])
    setWoundValue("")
    setWoundMode("threshold")
    if (rollAnimTimer.current !== null) {
      window.clearInterval(rollAnimTimer.current)
      rollAnimTimer.current = null
    }
  }, [])

  // The result popup stays open until the player dismisses it (tap outside
  // or the close button) — it never times out on its own.
  useEffect(() => {
    if (!result) return
    const handleOutside = (event: PointerEvent) => {
      if (boxRef.current && event.target instanceof Node && !boxRef.current.contains(event.target)) closePopup()
    }
    document.addEventListener("pointerdown", handleOutside)
    return () => document.removeEventListener("pointerdown", handleOutside)
  }, [result, closePopup])

  const stopVibration = () => {
    if (vibrateTimer.current !== null) {
      window.clearTimeout(vibrateTimer.current)
      vibrateTimer.current = null
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(0)
  }

  useEffect(() => () => {
    if (rollAnimTimer.current !== null) window.clearInterval(rollAnimTimer.current)
    if (errorFlashTimer.current !== null) window.clearTimeout(errorFlashTimer.current)
    if (chargeStartTimer.current !== null) window.clearTimeout(chargeStartTimer.current)
    stopVibration()
  }, [])

  const flashError = () => {
    setErrorFlash(true)
    if (errorFlashTimer.current !== null) window.clearTimeout(errorFlashTimer.current)
    errorFlashTimer.current = window.setTimeout(() => setErrorFlash(false), ERROR_FLASH_MS)
  }

  const rollPool = () => {
    const count = available + wardrobeBonus
    if (count <= 0) {
      flashError()
      return
    }
    const rolled = onRoll(count)
    setResult(null)
    setPendingOverload(new Set())
    setResolved(false)
    setView("result")
    setRolling(true)
    let ticks = 0
    rollAnimTimer.current = window.setInterval(() => {
      ticks += 1
      if (ticks >= ROLL_ANIM_TICKS) {
        if (rollAnimTimer.current !== null) {
          window.clearInterval(rollAnimTimer.current)
          rollAnimTimer.current = null
        }
        setRolling(false)
        setResult(rolled)
      }
    }, ROLL_ANIM_INTERVAL_MS)
  }

  // "Spins up" a held press: pulses the device (shrinking the interval each
  // pulse to feel like it's accelerating) and keeps stuttering until the
  // player releases, at which point the roll actually fires.
  const startCharging = () => {
    setCharging(true)
    let delay = VIBRATE_START_MS
    const pulse = () => {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(VIBRATE_PULSE_MS)
      delay = Math.max(VIBRATE_MIN_MS, delay - VIBRATE_STEP_MS)
      vibrateTimer.current = window.setTimeout(pulse, delay)
    }
    pulse()
  }

  const stopCharging = () => {
    setCharging(false)
    stopVibration()
  }

  const cancelPress = () => {
    if (chargeStartTimer.current !== null) {
      window.clearTimeout(chargeStartTimer.current)
      chargeStartTimer.current = null
    }
    setPressing(false)
    if (charging) stopCharging()
  }

  const handlePointerDown = () => {
    suppressClick.current = false
    setPressing(true)
    chargeStartTimer.current = window.setTimeout(() => {
      chargeStartTimer.current = null
      setPressing(false)
      startCharging()
    }, CHARGE_THRESHOLD_MS)
  }

  const handlePointerUp = () => {
    setPressing(false)
    if (chargeStartTimer.current !== null) {
      // Released before the charge threshold — not a roll, just a tap on
      // the roll zone. Nothing happens; only a hold rolls the pool.
      window.clearTimeout(chargeStartTimer.current)
      chargeStartTimer.current = null
      return
    }
    if (charging) {
      suppressClick.current = true
      stopCharging()
      rollPool()
    }
  }

  // Overload pool remaining = the base pool only. Wardrobe dice always
  // roll but are never Overload-spendable ("Wardrobe adds dice to that
  // Method's roll only") — see the module doc comment.
  const overloadPoolRemaining = Math.max(0, available - pendingOverload.size)
  // Overload doubles a die's face value. Nothing Explodes, so the Total is
  // simply the single highest die in the pool after any Overloads.
  const overloadedValue = (dieRoll: ApproachDieResult) => dieRoll.rolls[0] * 2
  const displayTotal = result
    ? result.dice.reduce(
        (max, dieRoll, index) => Math.max(max, pendingOverload.has(index) ? overloadedValue(dieRoll) : dieRoll.total),
        0
      )
    : 0

  // Tapping a die previews doubling it (and reserves a charge from the
  // base pool) but doesn't actually spend anything until Resolve — the
  // player can keep toggling freely up to the pool size.
  const handleToggleOverload = (index: number) => {
    if (!onOverload || resolved) return
    setPendingOverload((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
        return next
      }
      if (next.size >= available) {
        flashError()
        return prev
      }
      next.add(index)
      return next
    })
  }

  const handleUndoOverload = () => {
    if (resolved) return
    setPendingOverload(new Set())
  }

  const handleResolveOverload = () => {
    if (!onOverload || resolved || pendingOverload.size === 0) {
      setResolved(true)
      return
    }
    for (let i = 0; i < pendingOverload.size; i++) {
      if (!onOverload(i)) break
    }
    setResolved(true)
  }

  const canProceedPastOverload = resolved || pendingOverload.size === 0

  const handleSendToSet = () => {
    if (!canProceedPastOverload) return
    addSetRollRow(displayTotal)
    closePopup()
  }

  const handleConfirmMargin = () => {
    if (!canProceedPastOverload) return
    const opposition = Number(oppositionInput)
    if (!Number.isFinite(opposition)) return
    const computed = displayTotal - opposition
    setMargin(computed)
    if (computed === 0 && getRollMode() === "combat" && !hasPendingNotification("desync")) {
      pushNotification(
        "desync",
        "Desynced",
        "Margin of 0 in Combat. Accept to desync, or cancel to ignore it.",
        { desync: true }
      )
    }
    setView("margin-result")
  }

  const handleRollDamage = () => {
    if (margin === null || margin <= 0) return
    setDamageDice(rollFlatDice(margin, damageDie))
    setView("damage")
  }

  const woundThresholdNumber = Number(woundValue)
  const hasWoundValue = woundValue.trim() !== "" && Number.isFinite(woundThresholdNumber)
  const isSuccess = (value: number) =>
    hasWoundValue && (woundMode === "threshold" ? value >= woundThresholdNumber : value === woundThresholdNumber)
  const successCount = hasWoundValue ? damageDice.filter(isSuccess).length : 0

  // Track geometry: a fixed 1-6 numbered circle row, like the printed
  // sheet (a Method's base rating can never exceed STAT_AND_METHOD_MAX).
  // Circles past baseRating are locked (this Method hasn't grown a die
  // there yet). The solid marker sits on `available` (current pool); a
  // faint ghost marker sits on `baseRating` (full pool) whenever the two
  // differ, so a depleted pool still shows where full used to be.
  const trackMax = Math.min(STAT_AND_METHOD_MAX, baseRating)
  const trackCurrent = Math.max(0, Math.min(available, trackMax))
  const isDepleted = trackMax > 0 && trackCurrent === 0

  const handleCircleClick = (slot: number) => {
    if (!onSetAvailable) return
    onSetAvailable(slot)
  }

  const rollHint = available + wardrobeBonus <= 0
    ? "No dice"
    : errorFlash
    ? "No more dice"
    : charging
    ? "Release to roll…"
    : "Hold to roll"

  return (
    <div
      ref={boxRef}
      className={`method-row${charging ? " charging" : ""}${errorFlash ? " error" : ""}`}
    >
      <button
        type="button"
        className="method-row-roll"
        aria-label={`${label}, ${available} of ${baseRating} base dice available${wardrobeBonus > 0 ? `, plus ${wardrobeBonus} from Wardrobe` : ""}. Hold to roll.`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenu={(event) => event.preventDefault()}
        style={{ ["--hold-progress-ms" as string]: `${CHARGE_THRESHOLD_MS}ms` } as React.CSSProperties}
      >
        <span className={`hold-progress-fill${pressing ? " active" : ""}`} aria-hidden="true" />
        <span className="method-row-name-wrap">
          <span className="method-row-name">{label}</span>
          <span className="method-row-hint">{rollHint}</span>
        </span>
      </button>

      <div className="method-row-track" role="group" aria-label={`${label} dice track`}>
        {Array.from({ length: STAT_AND_METHOD_MAX }, (_, index) => {
          const slot = index + 1
          const isLocked = slot > trackMax
          const isCurrent = !isLocked && slot === trackCurrent
          const isGhost = !isLocked && slot === trackMax && trackMax !== trackCurrent
          return (
            <button
              key={slot}
              type="button"
              className={`method-die-pip${isLocked ? " locked" : ""}${isCurrent ? " current" : ""}${isGhost ? " ghost" : ""}`}
              disabled={isLocked || !onSetAvailable}
              onClick={(event) => {
                event.stopPropagation()
                handleCircleClick(slot)
              }}
              title={isLocked ? undefined : `Set ${label} pool to ${slot}`}
            >
              {slot}
            </button>
          )
        })}
        {/* When the pool is fully depleted (every die Overloaded away),
            cover the numbers with a plain banner instead of a "0" marker —
            the ghost at the full count already shows where "full" is. */}
        {isDepleted && (
          <div className="method-row-track-overlay" aria-hidden="true">
            Charges Spent
          </div>
        )}
      </div>

      {wardrobeBonus > 0 && (
        <span
          className="method-row-wardrobe-box"
          title={`+${wardrobeBonus} dice from Wardrobe${wardrobeItems.length ? ` (${wardrobeItems.join(", ")})` : ""}. Always rolled; not part of the Overload pool.`}
        >
          +{wardrobeBonus}
        </span>
      )}

      {(rolling || result) && createPortal(
        <div
          className="approach-die-popup"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="approach-die-popup-close"
            onClick={(event) => {
              event.stopPropagation()
              closePopup()
            }}
            aria-label="Close roll result"
          >
            X
          </button>
          <div className="approach-die-popup-label">{label}</div>

          {rolling && <div className="approach-die-popup-value rolling" aria-label="Rolling dice">…</div>}

          {!rolling && result && view === "result" && (
            <>
              <div className="approach-die-popup-value">
                {displayTotal}
              </div>
              <div className="approach-die-popup-die">
                {result.dice.map((dieRoll, index) => {
                  const effectiveValue = pendingOverload.has(index) ? overloadedValue(dieRoll) : dieRoll.total
                  const isTop = result.dice.length > 0 && effectiveValue === displayTotal
                  return (
                    <button
                      key={index}
                      type="button"
                      className={`approach-die-chip${pendingOverload.has(index) ? " overloaded" : ""}${isTop ? " top" : ""}`}
                      disabled={!onOverload || resolved || (overloadPoolRemaining <= 0 && !pendingOverload.has(index))}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleToggleOverload(index)
                      }}
                      title={
                        resolved
                          ? undefined
                          : pendingOverload.has(index)
                          ? "Tap to undo this Overload"
                          : onOverload
                          ? "Tap to Overload: double this die (spends 1 from the base pool on Resolve)"
                          : undefined
                      }
                    >
                      D10: {dieRoll.rolls[0]}
                      {pendingOverload.has(index) && <span className="approach-die-chip-doubled">DOUBLED</span>}
                    </button>
                  )
                })}
              </div>
              {onOverload && (
                <div className="approach-die-popup-pool">
                  Overload pool: {overloadPoolRemaining}/{baseRating}
                  {pendingOverload.size > 0 && !resolved && (
                    <div className="approach-overload-resolve-actions">
                      <button type="button" className="approach-roll-path-btn" onClick={(e) => { e.stopPropagation(); handleResolveOverload() }}>
                        Resolve
                      </button>
                      <button type="button" className="approach-roll-path-btn secondary" onClick={(e) => { e.stopPropagation(); handleUndoOverload() }}>
                        Undo
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="approach-roll-path-actions">
                <button
                  type="button"
                  className="approach-roll-path-btn"
                  disabled={!canProceedPastOverload}
                  title={!canProceedPastOverload ? "Resolve or undo your Overload selection first" : undefined}
                  onClick={(e) => { e.stopPropagation(); handleSendToSet() }}
                >
                  Send to Set
                </button>
                <button
                  type="button"
                  className="approach-roll-path-btn"
                  disabled={!canProceedPastOverload}
                  title={!canProceedPastOverload ? "Resolve or undo your Overload selection first" : undefined}
                  onClick={(e) => { e.stopPropagation(); setView("margin-input") }}
                >
                  Create Margin
                </button>
              </div>
            </>
          )}

          {view === "margin-input" && (
            <div className="approach-margin-input">
              <label className="approach-margin-label" htmlFor={`opposition-${label}`}>
                Opposition Roll
              </label>
              <input
                id={`opposition-${label}`}
                type="number"
                inputMode="numeric"
                className="approach-margin-field"
                value={oppositionInput}
                onChange={(e) => setOppositionInput(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="approach-roll-path-btn"
                disabled={oppositionInput.trim() === ""}
                onClick={(e) => { e.stopPropagation(); handleConfirmMargin() }}
              >
                Calculate Margin
              </button>
            </div>
          )}

          {view === "margin-result" && margin !== null && (
            <div className="approach-margin-result">
              <div className="approach-margin-value">{margin > 0 ? `+${margin}` : margin}</div>
              <div className="approach-margin-sub">Margin</div>
              {margin === 0 && (
                <div className="approach-desync-banner">DESYNCED</div>
              )}
              {margin > 0 && (
                <button type="button" className="approach-roll-path-btn" onClick={(e) => { e.stopPropagation(); handleRollDamage() }}>
                  Roll Wounds ({margin}{dieLabel(damageDie)})
                </button>
              )}
            </div>
          )}

          {view === "damage" && (
            <div className="approach-damage-roll">
              <div className="approach-damage-dice">
                {damageDice.map((value, index) => (
                  <span key={index} className={`approach-damage-chip${isSuccess(value) ? " success" : ""}`}>
                    {value}
                  </span>
                ))}
              </div>
              <div className="approach-damage-controls">
                <div className="approach-damage-wound-field">
                  <label htmlFor={`wound-${label}`}>{woundMode === "threshold" ? "Wound Threshold" : "Wound Target"}</label>
                  <input
                    id={`wound-${label}`}
                    type="number"
                    inputMode="numeric"
                    value={woundValue}
                    onChange={(e) => setWoundValue(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="approach-damage-mode-toggle"
                  onClick={(e) => { e.stopPropagation(); setWoundMode((m) => (m === "threshold" ? "target" : "threshold")) }}
                >
                  {woundMode === "threshold" ? "Switch to Target" : "Switch to Threshold"}
                </button>
              </div>
              <div className="approach-damage-success-count">
                <span className="approach-damage-success-value">{successCount}</span>
                <span className="approach-damage-success-label">Successes</span>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
