import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { ApproachRollResult, DieSides } from "../../domain/approachDice"
import { rollFlatDice } from "../../domain/approachDice"
import { addSetRollRow, setChipDesynced } from "../../utils/chudVanillaBridge"

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

// Approach dice card: tapping arms one die (up to the Approach's available
// pool); holding charges a roll (vibrating/stuttering as it "spins up") and
// releasing fires the roll using however many dice are currently armed, then
// resets the armed count back to 0. Adding a point to an Approach (via the
// Core distribution popout) already implies the extra die is available — no
// separate "breakout" indicator is needed here.
//
// Past the initial Resolution roll, the popup offers two paths: send the sum
// to the HUD's Set Roll list, or turn it into a Margin against an Opposition
// roll. A positive Margin can then be spent on a flat (non-exploding) Damage
// roll — individual dice are checked against a Wound Threshold/Target so the
// player can read off how many "successes" they have to announce at the
// table. None of this adjudicates anything; it only surfaces the numbers.
export function ApproachDie({
  label,
  rating,
  available,
  die,
  damageDie,
  onRoll,
  onOverload,
}: {
  label: string
  /** Full Approach rating, i.e. the size of the Overload dice pool. */
  rating: number
  /** Dice currently available to arm (rating minus any Overloaded-and-spent dice). */
  available: number
  die: DieSides
  /** Shared Damage die size, used for the post-Margin damage roll. */
  damageDie: DieSides
  onRoll: (count: number) => ApproachDieRollResult
  /** Doubles one rolled die's value and spends it from the Overload pool. Returns false if the pool is exhausted. */
  onOverload?: (dieIndex: number) => boolean
}) {
  const [armed, setArmed] = useState(0)
  const [errorFlash, setErrorFlash] = useState(false)
  const [result, setResult] = useState<ApproachDieRollResult | null>(null)
  const [overloaded, setOverloaded] = useState<Set<number>>(new Set())
  const [rolling, setRolling] = useState(false)
  const [charging, setCharging] = useState(false)
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
  const boxRef = useRef<HTMLButtonElement>(null)

  // Clamp armed count down whenever the available pool shrinks (e.g. an
  // Overload spend) so it never exceeds what's actually rollable.
  useEffect(() => {
    setArmed((prev) => Math.min(prev, available))
  }, [available])

  const closePopup = useCallback(() => {
    setResult(null)
    setRolling(false)
    setOverloaded(new Set())
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

  const armOne = () => {
    if (armed >= available) {
      flashError()
      return
    }
    setArmed((v) => v + 1)
  }

  const rollArmed = () => {
    if (armed <= 0) return
    const count = armed
    setArmed(0)
    const rolled = onRoll(count)
    setResult(null)
    setOverloaded(new Set())
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
    if (charging) stopCharging()
  }

  const handlePointerDown = () => {
    suppressClick.current = false
    chargeStartTimer.current = window.setTimeout(() => {
      chargeStartTimer.current = null
      startCharging()
    }, CHARGE_THRESHOLD_MS)
  }

  const handlePointerUp = () => {
    if (chargeStartTimer.current !== null) {
      // Released before the charge threshold — treat as a tap to arm.
      window.clearTimeout(chargeStartTimer.current)
      chargeStartTimer.current = null
      return
    }
    if (charging) {
      suppressClick.current = true
      stopCharging()
      rollArmed()
    }
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    armOne()
  }

  const hasExplosion = result?.dice.some((dieRoll) => dieRoll.rolls.length > 1) ?? false
  const overloadPoolRemaining = Math.max(0, available - overloaded.size)
  const displayTotal = result
    ? result.dice.reduce((sum, dieRoll, index) => sum + (overloaded.has(index) ? dieRoll.total * 2 : dieRoll.total), 0)
    : 0

  const handleToggleOverload = (index: number) => {
    if (!onOverload || overloaded.has(index)) return
    if (!onOverload(index)) return // pool exhausted
    setOverloaded((prev) => new Set(prev).add(index))
  }

  const handleSendToSet = () => {
    addSetRollRow(displayTotal)
    closePopup()
  }

  const handleConfirmMargin = () => {
    const opposition = Number(oppositionInput)
    if (!Number.isFinite(opposition)) return
    const computed = displayTotal - opposition
    setMargin(computed)
    setChipDesynced(computed <= 0)
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
    hasWoundValue && (woundMode === "threshold" ? value > woundThresholdNumber : value === woundThresholdNumber)
  const successCount = hasWoundValue ? damageDice.filter(isSuccess).length : 0

  return (
    <button
      ref={boxRef}
      type="button"
      className={`approach-die${charging ? " charging" : ""}${errorFlash ? " error" : ""}`}
      aria-label={`${label}: ${armed} armed of ${available} available. Tap to arm a die, hold to roll.`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onClick={handleClick}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="approach-die-label">{label}</span>
      <div className="approach-die-pips" aria-hidden="true">
        {Array.from({ length: available }, (_, index) => (
          <span key={index} className={`approach-die-pip${index < armed ? " armed" : ""}`} />
        ))}
      </div>
      <span className="approach-die-sub">
        {available <= 0 ? "No dice" : errorFlash ? "No more dice" : charging ? "Release to roll…" : "Tap: arm · Hold: roll"}
      </span>

      {(rolling || result) && createPortal(
        <div className="approach-die-popup" onPointerDown={(event) => event.stopPropagation()}>
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
              <div className={`approach-die-popup-value${hasExplosion ? " good" : ""}`}>
                {displayTotal}
              </div>
              <div className="approach-die-popup-die">
                {result.dice.map((dieRoll, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`approach-die-chip${overloaded.has(index) ? " overloaded" : ""}`}
                    disabled={!onOverload || overloaded.has(index) || overloadPoolRemaining <= 0}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleToggleOverload(index)
                    }}
                    title={onOverload ? "Tap to Overload: double this die, spend 1 from the Approach pool" : undefined}
                  >
                    {dieLabel(result.die)}: {dieRoll.rolls.join(" + ")}
                    {dieRoll.rolls.length > 1 && " (explode)"}
                    {overloaded.has(index) && <span className="approach-die-chip-doubled">DOUBLED</span>}
                  </button>
                ))}
              </div>
              {onOverload && (
                <div className="approach-die-popup-pool">
                  Overload pool: {overloadPoolRemaining}/{rating}
                </div>
              )}
              <div className="approach-roll-path-actions">
                <button type="button" className="approach-roll-path-btn" onClick={(e) => { e.stopPropagation(); handleSendToSet() }}>
                  Send to Set
                </button>
                <button type="button" className="approach-roll-path-btn" onClick={(e) => { e.stopPropagation(); setView("margin-input") }}>
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
              {margin <= 0 ? (
                <div className="approach-desync-banner">DESYNCED</div>
              ) : (
                <button type="button" className="approach-roll-path-btn" onClick={(e) => { e.stopPropagation(); handleRollDamage() }}>
                  Roll Damage ({margin}{dieLabel(damageDie)})
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
    </button>
  )
}
