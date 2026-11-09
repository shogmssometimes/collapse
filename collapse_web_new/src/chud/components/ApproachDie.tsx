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
// Brief hold before drag-tracking engages — long enough that an incidental
// touch-scroll starting on the name box isn't hijacked as a roll gesture,
// short enough that it doesn't feel like a delay once the player commits.
const DRAG_ARM_MS = 150
// If the pointer moves more than this many px before DRAG_ARM_MS elapses,
// treat it as a scroll/pan attempt rather than a hold, and release it.
const PRE_ARM_CANCEL_PX = 8
const ERROR_FLASH_MS = 420
const VIBRATE_PIP_MS = 14

type PopupView = "result" | "margin-input" | "margin-result" | "damage"

const dieLabel = (die: DieSides) => `D${die}`

// Method row — printed-sheet style: the track is a fixed 1-6 numbered
// circle row (never a glowing number). A solid marker sits on the current
// (base) pool size; a faint ghost marker sits on the full (base) rating so
// a depleted pool still shows where "full" is. Rolling is a press-hold-drag
// gesture: pressing and holding the name box briefly "arms" the gesture,
// then dragging right across the track live-selects how many dice to roll
// (capped at the current pool — base-available + Wardrobe), pulsing a
// haptic each pip crossed and highlighting the selected pips; releasing
// fires the roll for whatever count was last selected, and dragging back
// to (or past) the start before releasing cancels it.
//
// Wardrobe dice are folded directly into the same track as a non-depleting
// gold-tinted pip (same round shape, just colored, continuing the circle
// sequence) right after the Method's own circles ("Wardrobe adds dice to
// that Method's roll only") — they're always rolled, but are never part
// of the Overload-spendable pool, so they never get a current/ghost
// marker and can't be Overloaded away.
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
}) {
  const [errorFlash, setErrorFlash] = useState(false)
  const [result, setResult] = useState<ApproachDieRollResult | null>(null)
  const [pendingOverload, setPendingOverload] = useState<Set<number>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [armed, setArmed] = useState(false)
  const [pressing, setPressing] = useState(false)
  const [dragCount, setDragCount] = useState<number | null>(null)
  const [view, setView] = useState<PopupView>("result")
  const [oppositionInput, setOppositionInput] = useState("")
  const [margin, setMargin] = useState<number | null>(null)
  const [damageDice, setDamageDice] = useState<number[]>([])
  const [woundValue, setWoundValue] = useState("")
  const [woundMode, setWoundMode] = useState<"threshold" | "target">("threshold")
  const rollAnimTimer = useRef<number | null>(null)
  const errorFlashTimer = useRef<number | null>(null)
  const armTimer = useRef<number | null>(null)
  const startPos = useRef({ x: 0, y: 0 })
  const dragCountRef = useRef<number | null>(null)
  const suppressClick = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

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
  // or the close button) — it never times out on its own. The popup is
  // rendered via createPortal into document.body, physically outside
  // boxRef's own subtree, so "outside" must explicitly also check
  // popupRef — relying solely on the popup's own stopPropagation calls
  // bubbling correctly across the portal boundary (interacting with
  // touch-blocker.js's overlay spans on real touch devices) was fragile
  // and could let a tap on a die/button inside the popup be misread as
  // "outside" and close it before the player's intended action landed.
  useEffect(() => {
    if (!result) return
    const handleOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (boxRef.current?.contains(event.target)) return
      if (popupRef.current?.contains(event.target)) return
      closePopup()
    }
    document.addEventListener("pointerdown", handleOutside)
    return () => document.removeEventListener("pointerdown", handleOutside)
  }, [result, closePopup])

  const vibrate = (ms: number) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms)
  }

  useEffect(() => () => {
    if (rollAnimTimer.current !== null) window.clearInterval(rollAnimTimer.current)
    if (errorFlashTimer.current !== null) window.clearTimeout(errorFlashTimer.current)
    if (armTimer.current !== null) window.clearTimeout(armTimer.current)
  }, [])

  const flashError = () => {
    setErrorFlash(true)
    if (errorFlashTimer.current !== null) window.clearTimeout(errorFlashTimer.current)
    errorFlashTimer.current = window.setTimeout(() => setErrorFlash(false), ERROR_FLASH_MS)
  }

  const rollPool = (count: number) => {
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

  // The current pool this Method can roll right now — the drag gesture's
  // selectable count never exceeds this (can't select more dice than you
  // actually have).
  const poolMax = Math.max(0, available) + Math.max(0, wardrobeBonus)

  // Reads the live pointer X against the track's rendered bounds and turns
  // it into a selected dice count — position at/left of the track's own
  // left edge (i.e. still back over the name box, where the gesture
  // started) is 0 dice ("swipe fully to the left ... cancels"); each
  // pip-width step to the right selects one more, capped at poolMax.
  const updateDragCount = (clientX: number) => {
    const trackEl = trackRef.current
    if (!trackEl) return
    const rect = trackEl.getBoundingClientRect()
    const perPip = rect.width / totalSlots
    if (!(perPip > 0)) return
    const raw = Math.round((clientX - rect.left) / perPip)
    const next = Math.max(0, Math.min(poolMax, raw))
    if (next !== dragCountRef.current) {
      dragCountRef.current = next
      setDragCount(next)
      vibrate(VIBRATE_PIP_MS)
    }
  }

  const resetGesture = () => {
    if (armTimer.current !== null) {
      window.clearTimeout(armTimer.current)
      armTimer.current = null
    }
    setPressing(false)
    setArmed(false)
    setDragCount(null)
    dragCountRef.current = null
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (poolMax <= 0) return
    suppressClick.current = false
    startPos.current = { x: event.clientX, y: event.clientY }
    setPressing(true)
    const pointerId = event.pointerId
    const target = event.currentTarget
    armTimer.current = window.setTimeout(() => {
      armTimer.current = null
      setPressing(false)
      setArmed(true)
      dragCountRef.current = 0
      setDragCount(0)
      try {
        target.setPointerCapture(pointerId)
      } catch {
        // Pointer capture isn't critical — move/up still fire on this
        // element for mouse, and most touch browsers grant it anyway.
      }
    }, DRAG_ARM_MS)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (armed) {
      updateDragCount(event.clientX)
      return
    }
    if (armTimer.current === null) return
    const dx = event.clientX - startPos.current.x
    const dy = event.clientY - startPos.current.y
    if (Math.abs(dx) > PRE_ARM_CANCEL_PX || Math.abs(dy) > PRE_ARM_CANCEL_PX) {
      // Moved before the hold threshold elapsed — this reads as a scroll
      // or pan, not a hold-to-roll; let go so native scrolling can take
      // over instead of hijacking the gesture.
      window.clearTimeout(armTimer.current)
      armTimer.current = null
      setPressing(false)
    }
  }

  const handlePointerUp = () => {
    if (armTimer.current !== null) {
      // Released before the hold threshold — a quick tap, not a roll.
      window.clearTimeout(armTimer.current)
      armTimer.current = null
      setPressing(false)
      return
    }
    if (armed) {
      const finalCount = dragCountRef.current ?? 0
      setArmed(false)
      setDragCount(null)
      dragCountRef.current = null
      if (finalCount > 0) {
        suppressClick.current = true
        rollPool(finalCount)
      }
    }
  }

  const handlePointerCancel = () => {
    // A pointercancel (e.g. the OS took over for a system gesture) always
    // aborts — never rolls, even mid-drag.
    resetGesture()
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
  // Normally exactly 6 grid columns, but Wardrobe can push the track past
  // the sheet's 1-6 ceiling — grow the column count to fit when it does,
  // so overflow slots still get their own equal-width column instead of
  // cramming into the last one.
  const totalSlots = Math.max(STAT_AND_METHOD_MAX, trackMax + wardrobeBonus)

  const rollHint = poolMax <= 0
    ? "No dice"
    : errorFlash
    ? "No more dice"
    : dragCount !== null
    ? dragCount > 0
      ? `Release to roll ${dragCount}`
      : "Drag right to choose dice"
    : "Hold and drag to roll"

  return (
    <div
      ref={boxRef}
      className={`method-row${armed ? " armed" : ""}${errorFlash ? " error" : ""}`}
    >
      <button
        type="button"
        className="method-row-roll"
        aria-label={`${label}, ${available} of ${baseRating} base dice available${wardrobeBonus > 0 ? `, plus ${wardrobeBonus} from Wardrobe` : ""}. ${rollHint}.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(event) => event.preventDefault()}
        style={{ ["--hold-progress-ms" as string]: `${DRAG_ARM_MS}ms` } as React.CSSProperties}
      >
        <span className={`hold-progress-fill${pressing ? " active" : ""}`} aria-hidden="true" />
        <span className="method-row-name">{label}</span>
      </button>

      {/* The track is a CSS Grid with one equal-width (1fr) column per
          slot, rather than a flex row — every pip gets an explicit
          gridColumn (its slot number), so the 6 columns always line up
          at the exact same x-position across every Method row (Force's
          circle in slot 3 sits directly above Guts's locked pip in slot
          3), while still stretching to fill the row's full width. The
          "Charges Spent" overlay also gets an explicit column span
          (1 to trackMax) so it only covers the Method's own circles,
          painting over them (same grid area, later in DOM order) rather
          than needing position:absolute. trackRef lets the drag gesture
          read the track's live rendered bounds to map pointer X to a pip
          count. */}
      <div
        className="method-row-track"
        role="group"
        aria-label={`${label} dice track`}
        ref={trackRef}
        style={{ ["--method-track-columns" as string]: totalSlots }}
      >
        {Array.from({ length: trackMax }, (_, index) => {
          const slot = index + 1
          const isCurrent = slot === trackCurrent
          const isGhost = slot === trackMax && trackMax !== trackCurrent
          const isPreview = dragCount !== null && slot <= dragCount
          return (
            <span
              key={slot}
              className={`method-die-pip${isCurrent ? " current" : ""}${isGhost ? " ghost" : ""}${isPreview ? " drag-preview" : ""}`}
              style={{ gridColumn: slot }}
              aria-hidden="true"
            >
              {slot}
            </span>
          )
        })}
        {/* When the pool is fully depleted (every die Overloaded away),
            cover the whole track — not just the Method's own circles —
            with a plain banner instead of a "0" marker. A partial-width
            banner reads as broken (locked pips dangling past its edge);
            the full track covered reads as "this Method is spent". */}
        {isDepleted && (
          <div
            className="method-row-track-overlay"
            style={{ gridColumn: `1 / span ${totalSlots}` }}
            aria-hidden="true"
          >
            Charges Spent
          </div>
        )}
        {/* Wardrobe dice are folded directly into the track as the same
            round pip as the Method's own circles, just tinted gold —
            "Wardrobe adds dice to that Method's roll only." They're
            always rolled but never trackable/Overload-spendable, so
            they never get a current/ghost marker and tapping them does
            nothing. Numbered the same way the circles are, continuing
            the slot sequence; the gold tint is just a visual cue for
            where the dice come from, not a different track mechanic. */}
        {Array.from({ length: wardrobeBonus }, (_, index) => {
          const slot = trackMax + index + 1
          const isPreview = dragCount !== null && slot <= dragCount
          return (
            <span
              key={`wardrobe-${index}`}
              className={`method-die-pip wardrobe${isPreview ? " drag-preview" : ""}`}
              style={{ gridColumn: slot }}
              title={`Wardrobe bonus die${wardrobeItems.length ? ` (${wardrobeItems.join(", ")})` : ""}. Always rolled; not part of the Overload pool.`}
            >
              {slot}
            </span>
          )
        })}
        {/* Remaining slots up to the sheet's 1-6 ceiling that neither the
            Method's own rating nor Wardrobe have reached yet — hollow,
            dashed potential the Method hasn't grown into. */}
        {Array.from({ length: Math.max(0, STAT_AND_METHOD_MAX - trackMax - wardrobeBonus) }, (_, index) => (
          <span
            key={`locked-${index}`}
            className="method-die-pip locked"
            style={{ gridColumn: trackMax + wardrobeBonus + index + 1 }}
            aria-hidden="true"
          >
            {trackMax + wardrobeBonus + index + 1}
          </span>
        ))}
      </div>

      {(rolling || result) && createPortal(
        <div
          ref={popupRef}
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
