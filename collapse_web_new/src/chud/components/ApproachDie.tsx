import { useCallback, useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { createPortal } from "react-dom"
import type { ApproachDieResult, ApproachRollResult, DieSides } from "../../domain/approachDice"
import { rollFlatDice } from "../../domain/approachDice"
import { addSetRollRow } from "../../utils/chudVanillaBridge"
import { STAT_AND_METHOD_MAX } from "../../domain/coreApproachMap"

export type ApproachDieRollResult = ApproachRollResult

const ROLL_ANIM_TICKS = 8
const ROLL_ANIM_INTERVAL_MS = 60
const ERROR_FLASH_MS = 420
const VIBRATE_PIP_MS = 14
// Long-press (not a tap) to double a die — a plain tap on a die that's
// already doubled cancels it instead (see handleDieClick).
const DIE_LONG_PRESS_MS = 420
// How long the Method's name box must be held before it's "armed" and
// ready to roll. Once armed, moving the pointer past METHOD_SWIPE_PX in
// any direction fires the roll; moving that far *before* arming instead
// cancels the hold (reads as an accidental drag, not a deliberate press).
const METHOD_ARM_MS = 350
const METHOD_PRE_ARM_CANCEL_PX = 8
const METHOD_SWIPE_PX = 10
// Picking up a rolled die (post-result) reuses the same long-press-then-
// swipe shape as rolling itself, but with 4 directions instead of 1:
// once armed, swiping up doubles that die, down sends the Total to the
// Set list, right starts the Margin flow, and left just cancels the
// pick-up (back to the plain result — no popup close, no action taken).
const DIE_PRE_ARM_CANCEL_PX = 8
const DIE_SWIPE_PX = 18

type PopupView = "result" | "margin-input" | "margin-result" | "damage"

const dieLabel = (die: DieSides) => `D${die}`

// Method row — printed-sheet style: the track is a fixed 1-6 numbered
// circle row (never a glowing number). A solid marker sits on the current
// (base) pool size; a faint ghost marker sits on the full (base) rating so
// a depleted pool still shows where "full" is. There's no reason to ever
// roll fewer than every die in the pool, so there's nothing left to
// "select" — rolling is a long-press-then-swipe gesture instead: holding
// the name box briefly arms it (the same gold charging glow as before),
// then any swipe in any direction while armed instantly rolls the whole
// pool (base-available + Wardrobe) and opens the result popup. Releasing
// before it's armed, or holding without swiping, does nothing — only the
// swipe fires the roll.
//
// Wardrobe dice are folded directly into the same track as a non-depleting
// gold-tinted pip (same round shape, just colored, continuing the circle
// sequence) right after the Method's own circles ("Wardrobe adds dice to
// that Method's roll only") — they're always rolled, but are never part
// of the Overload-spendable pool, so they never get a current/ghost
// marker and can't be Overloaded away.
//
// Past the roll, the popup offers Overload: long-press a die to double it
// (spending 1 from the base pool, resolved together with any other
// pending doubles the moment the player leaves this screen — Send to Set,
// Create Margin, or closing the popup). A quick tap on an already-doubled
// die undoes it while the popup is still open. From there, two paths
// continue: send the Total to the HUD's Set Roll list, or turn it into a
// Margin against an Opposition roll. A positive Margin can then be spent
// on a flat (non-exploding) Wound roll — individual dice are checked against a Wound
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
  /** Spends `count` dice from the Overload pool at once (one per doubled die, resolved together). Returns false if the pool couldn't cover the full count. */
  onOverload?: (count: number) => boolean
}) {
  const [errorFlash, setErrorFlash] = useState(false)
  const [result, setResult] = useState<ApproachDieRollResult | null>(null)
  const [pendingOverload, setPendingOverload] = useState<Set<number>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [armed, setArmed] = useState(false)
  const [chargeProgress, setChargeProgress] = useState(0) // 0-100, grows from the instant of press, independent of `armed`
  const [rollingPreview, setRollingPreview] = useState<number[]>([])
  const [pressingDieIndex, setPressingDieIndex] = useState<number | null>(null)
  const [armedDieIndex, setArmedDieIndex] = useState<number | null>(null)
  const [sumPressing, setSumPressing] = useState(false)
  const [sumArmed, setSumArmed] = useState(false)
  const [marginBase, setMarginBase] = useState<number | null>(null)
  const [view, setView] = useState<PopupView>("result")
  const [oppositionInput, setOppositionInput] = useState("")
  const [margin, setMargin] = useState<number | null>(null)
  const [damageDice, setDamageDice] = useState<number[]>([])
  const [woundValue, setWoundValue] = useState("")
  const [woundMode, setWoundMode] = useState<"threshold" | "target">("threshold")
  const rollAnimTimer = useRef<number | null>(null)
  const errorFlashTimer = useRef<number | null>(null)
  const armTimer = useRef<number | null>(null)
  const chargeInterval = useRef<number | null>(null)
  const armedRef = useRef(false)
  const gestureStart = useRef<{ x: number; y: number } | null>(null)
  const rolledThisGesture = useRef(false)
  const resolvedRef = useRef(false)
  const diePressTimer = useRef<number | null>(null)
  const dieSuppressClick = useRef(false)
  const dieGestureStart = useRef<{ x: number; y: number } | null>(null)
  const dieSwipedThisGesture = useRef(false)
  const sumPressTimer = useRef<number | null>(null)
  const sumGestureStart = useRef<{ x: number; y: number } | null>(null)
  const sumSwipedThisGesture = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  // Spends the pending Overloads from the base pool (one die each, resolved
  // together in a single call so the parent's state update can't miss any —
  // see the module doc comment on why resolving dice one-at-a-time in a
  // loop used to under-spend). Idempotent via resolvedRef: once resolved,
  // repeat calls (e.g. both a button press and the popup's own close) are
  // no-ops rather than double-spending.
  const resolveOverloadIfNeeded = useCallback(() => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    if (onOverload && pendingOverload.size > 0) onOverload(pendingOverload.size)
    setResolved(true)
  }, [onOverload, pendingOverload])

  const closePopup = useCallback(() => {
    // Closing the popup (via the X button or tapping outside) with
    // Overloads still pending commits them — there's no separate
    // Resolve/Undo step; un-doing a die happens by tapping it again while
    // the popup is still open (see handleDieClick).
    resolveOverloadIfNeeded()
    resolvedRef.current = false
    setResult(null)
    setRolling(false)
    setPendingOverload(new Set())
    setResolved(false)
    setView("result")
    setOppositionInput("")
    setMargin(null)
    setMarginBase(null)
    setDamageDice([])
    setWoundValue("")
    setWoundMode("threshold")
    setArmedDieIndex(null)
    setSumArmed(false)
    setSumPressing(false)
    if (rollAnimTimer.current !== null) {
      window.clearInterval(rollAnimTimer.current)
      rollAnimTimer.current = null
    }
  }, [resolveOverloadIfNeeded])

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
    if (diePressTimer.current !== null) window.clearTimeout(diePressTimer.current)
    if (sumPressTimer.current !== null) window.clearTimeout(sumPressTimer.current)
    if (armTimer.current !== null) window.clearTimeout(armTimer.current)
    if (chargeInterval.current !== null) window.clearInterval(chargeInterval.current)
  }, [])

  const flashError = () => {
    setErrorFlash(true)
    if (errorFlashTimer.current !== null) window.clearTimeout(errorFlashTimer.current)
    errorFlashTimer.current = window.setTimeout(() => setErrorFlash(false), ERROR_FLASH_MS)
  }

  // The current pool this Method can roll right now — always the whole
  // pool; there's nothing left to pick since a roll always uses every die.
  const poolMax = Math.max(0, available) + Math.max(0, wardrobeBonus)

  const rollPool = (count: number) => {
    if (count <= 0) {
      flashError()
      return
    }
    const rolled = onRoll(count)
    resolvedRef.current = false
    setResult(null)
    setPendingOverload(new Set())
    setResolved(false)
    setView("result")
    setRolling(true)
    // "Numbers rolling" visual: re-roll a throwaway D10 face per die, every
    // tick, so the popup looks like the dice are actually tumbling before
    // settling on the real result.
    setRollingPreview(Array.from({ length: count }, () => Math.floor(Math.random() * 10) + 1))
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
        return
      }
      setRollingPreview(Array.from({ length: count }, () => Math.floor(Math.random() * 10) + 1))
    }, ROLL_ANIM_INTERVAL_MS)
  }

  const cancelGesture = () => {
    if (armTimer.current !== null) {
      window.clearTimeout(armTimer.current)
      armTimer.current = null
    }
    if (chargeInterval.current !== null) {
      window.clearInterval(chargeInterval.current)
      chargeInterval.current = null
    }
    armedRef.current = false
    setArmed(false)
    setChargeProgress(0)
    gestureStart.current = null
  }

  // Holding the name box arms the gesture (same gold "charging" glow the
  // row already had); only a swipe — in any direction, by any amount past
  // METHOD_SWIPE_PX — while armed actually fires the roll, and it always
  // rolls the whole pool. Moving too far *before* arming cancels instead,
  // so an accidental drag (e.g. scrolling past the row) doesn't arm it.
  // The charge-up glow itself starts growing the instant the pointer goes
  // down (see chargeProgress below) rather than waiting for the full
  // METHOD_ARM_MS to elapse before showing anything — a press that
  // doesn't visibly react right away reads as broken and players let go
  // before it ever arms.
  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (poolMax <= 0) return
    rolledThisGesture.current = false
    gestureStart.current = { x: event.clientX, y: event.clientY }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture isn't critical — move/up still fire on this
      // element for mouse, and most touch browsers grant it anyway.
    }
    const pressStart = Date.now()
    setChargeProgress(1) // immediate, visible reaction on the very first paint after press
    chargeInterval.current = window.setInterval(() => {
      setChargeProgress(Math.min(100, ((Date.now() - pressStart) / METHOD_ARM_MS) * 100))
    }, 30)
    armTimer.current = window.setTimeout(() => {
      armTimer.current = null
      armedRef.current = true
      setArmed(true)
      setChargeProgress(100)
      vibrate(VIBRATE_PIP_MS)
    }, METHOD_ARM_MS)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (rolledThisGesture.current || !gestureStart.current) return
    const dx = event.clientX - gestureStart.current.x
    const dy = event.clientY - gestureStart.current.y
    const dist = Math.hypot(dx, dy)
    if (!armedRef.current) {
      if (dist > METHOD_PRE_ARM_CANCEL_PX) cancelGesture()
      return
    }
    if (dist > METHOD_SWIPE_PX) {
      rolledThisGesture.current = true
      cancelGesture()
      vibrate(VIBRATE_PIP_MS * 2)
      rollPool(poolMax)
    }
  }

  const handlePointerUp = () => {
    cancelGesture()
  }

  const handlePointerCancel = () => {
    // A pointercancel (e.g. the OS took over for a system gesture) always
    // aborts — never rolls, even mid-gesture.
    cancelGesture()
  }

  // Overload doubles a die's face value. Nothing Explodes, so the Total is
  // simply the single highest die in the pool after any Overloads.
  const overloadedValue = (dieRoll: ApproachDieResult) => dieRoll.rolls[0] * 2
  const displayTotal = result
    ? result.dice.reduce(
        (max, dieRoll, index) => Math.max(max, pendingOverload.has(index) ? overloadedValue(dieRoll) : dieRoll.total),
        0
      )
    : 0
  // Once a 2nd die is Overloaded, a separate Summed value — the doubled
  // dice added together, not just the pool's highest — becomes available
  // as its own pick-up-able total (no further Doubling from it, since it's
  // already a derived value, not a rolled die).
  const summedValue =
    result && pendingOverload.size >= 2
      ? Array.from(pendingOverload).reduce((sum, index) => sum + overloadedValue(result.dice[index]), 0)
      : null

  // Picking up a die previews doubling it, but only once confirmed with a
  // long-press (a plain tap would be too easy to trigger by accident while
  // reading the result) — it's then auto-resolved (spent from the base
  // pool) the moment the player moves past this screen: Send to Set,
  // Create Margin, or just closing the popup. A quick tap on an
  // already-doubled die un-does it while the popup is still open; there's
  // no separate Resolve/Undo step. Any number of dice can be Overloaded,
  // as long as the base pool still has one available to spend.
  const addOverload = (index: number) => {
    if (!onOverload || resolvedRef.current) return
    setPendingOverload((prev) => {
      if (prev.has(index)) return prev
      if (prev.size >= available) {
        flashError()
        return prev
      }
      const next = new Set(prev)
      next.add(index)
      return next
    })
  }

  const removeOverload = (index: number) => {
    if (resolvedRef.current) return
    setPendingOverload((prev) => {
      if (!prev.has(index)) return prev
      const next = new Set(prev)
      next.delete(index)
      return next
    })
  }

  const cancelDiePress = () => {
    if (diePressTimer.current !== null) {
      window.clearTimeout(diePressTimer.current)
      diePressTimer.current = null
    }
    setPressingDieIndex(null)
    setArmedDieIndex(null)
    dieGestureStart.current = null
  }

  const sendToSet = (total: number) => {
    resolveOverloadIfNeeded()
    addSetRollRow(total)
    closePopup()
  }

  const startMargin = (total: number) => {
    setMarginBase(total)
    setView("margin-input")
  }

  // Long-pressing a die "picks it up": once armed (same hold duration as
  // the old immediate-double long-press), any swipe past DIE_SWIPE_PX in
  // one of the 4 cardinal directions fires that direction's action —
  // up doubles *this* die, down sends the Total to the Set list, right
  // starts the Margin flow, left just cancels the pick-up (no action, no
  // popup close). Moving too far before arming cancels the whole press,
  // same guard the Method row's own hold-then-swipe uses.
  const handleDiePointerDown = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (resolvedRef.current) return
    dieSuppressClick.current = false
    dieSwipedThisGesture.current = false
    dieGestureStart.current = { x: event.clientX, y: event.clientY }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture isn't critical — move/up still fire on this
      // element for mouse, and most touch browsers grant it anyway.
    }
    setPressingDieIndex(index)
    diePressTimer.current = window.setTimeout(() => {
      diePressTimer.current = null
      dieSuppressClick.current = true
      setPressingDieIndex(null)
      setArmedDieIndex(index)
      vibrate(VIBRATE_PIP_MS)
    }, DIE_LONG_PRESS_MS)
  }

  const handleDiePointerMove = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (dieSwipedThisGesture.current || !dieGestureStart.current) return
    const dx = event.clientX - dieGestureStart.current.x
    const dy = event.clientY - dieGestureStart.current.y
    const dist = Math.hypot(dx, dy)
    if (armedDieIndex !== index) {
      // Not armed yet — too much movement before the long-press lands
      // reads as an accidental drag, not a deliberate pick-up.
      if (dist > DIE_PRE_ARM_CANCEL_PX) cancelDiePress()
      return
    }
    if (dist <= DIE_SWIPE_PX) return
    dieSwipedThisGesture.current = true
    vibrate(VIBRATE_PIP_MS * 2)
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) addOverload(index) // swipe up: Doubled
      else sendToSet(displayTotal) // swipe down: Send to Set
    } else if (dx > 0) {
      startMargin(displayTotal) // swipe right: Create Margin
    } // swipe left: Cancel — just drop the pick-up, no action
    setArmedDieIndex(null)
  }

  const handleDieClick = (index: number) => {
    if (dieSuppressClick.current) {
      // This click followed a long-press (picked up, whether or not it
      // then swiped) — don't also treat it as the "tap to cancel" gesture.
      dieSuppressClick.current = false
      return
    }
    removeOverload(index)
  }

  const cancelSumPress = () => {
    if (sumPressTimer.current !== null) {
      window.clearTimeout(sumPressTimer.current)
      sumPressTimer.current = null
    }
    setSumPressing(false)
    setSumArmed(false)
    sumGestureStart.current = null
  }

  // The Summed chip picks up the same way a die does, but only 3 of the
  // 4 directions apply — it's a derived value, not a rolled die, so
  // there's nothing to Double (swipe up just flashes the "can't" error).
  const handleSumPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (resolvedRef.current) return
    sumSwipedThisGesture.current = false
    sumGestureStart.current = { x: event.clientX, y: event.clientY }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture isn't critical — move/up still fire on this
      // element for mouse, and most touch browsers grant it anyway.
    }
    setSumPressing(true)
    sumPressTimer.current = window.setTimeout(() => {
      sumPressTimer.current = null
      setSumPressing(false)
      setSumArmed(true)
      vibrate(VIBRATE_PIP_MS)
    }, DIE_LONG_PRESS_MS)
  }

  const handleSumPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (sumSwipedThisGesture.current || !sumGestureStart.current || summedValue === null) return
    const dx = event.clientX - sumGestureStart.current.x
    const dy = event.clientY - sumGestureStart.current.y
    const dist = Math.hypot(dx, dy)
    if (!sumArmed) {
      if (dist > DIE_PRE_ARM_CANCEL_PX) cancelSumPress()
      return
    }
    if (dist <= DIE_SWIPE_PX) return
    sumSwipedThisGesture.current = true
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) {
        flashError() // swipe up: not available on the Summed value
      } else {
        vibrate(VIBRATE_PIP_MS * 2)
        sendToSet(summedValue) // swipe down: Send to Set
      }
    } else if (dx > 0) {
      vibrate(VIBRATE_PIP_MS * 2)
      startMargin(summedValue) // swipe right: Create Margin
    } // swipe left: Cancel — just drop the pick-up, no action
    setSumArmed(false)
  }

  const handleConfirmMargin = () => {
    resolveOverloadIfNeeded()
    const opposition = Number(oppositionInput)
    if (!Number.isFinite(opposition)) return
    const computed = (marginBase ?? displayTotal) - opposition
    setMargin(computed)
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
  // there yet). Within baseRating, every circle up to `available` is a
  // solid "available" pip (blue); the rest, up to baseRating, are "spent"
  // (dull red) — no single moving marker, every pip's own color says
  // whether its die is still in the pool.
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
    : armed
    ? `Swipe to roll ${poolMax}`
    : "Hold, then swipe to roll"

  return (
    <div
      ref={boxRef}
      className={`method-row${armed ? " armed" : ""}${errorFlash ? " error" : ""}`}
    >
      <button
        type="button"
        className="method-row-roll"
        aria-label={`${label}, ${available} of ${baseRating} base dice available${wardrobeBonus > 0 ? `, plus ${wardrobeBonus} from Wardrobe` : ""}. ${rollHint}.`}
        style={
          !armed && chargeProgress > 0
            ? {
                borderColor: `rgba(255,212,59,${0.18 + 0.5 * (chargeProgress / 100)})`,
                boxShadow: `0 0 ${4 + 14 * (chargeProgress / 100)}px rgba(255,212,59,${0.1 + 0.35 * (chargeProgress / 100)})`,
              }
            : undefined
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(event) => event.preventDefault()}
      >
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
          than needing position:absolute. */}
      <div
        className="method-row-track"
        role="group"
        aria-label={`${label} dice track`}
        style={{ ["--method-track-columns" as string]: totalSlots }}
      >
        {Array.from({ length: trackMax }, (_, index) => {
          const slot = index + 1
          const isAvailable = slot <= trackCurrent
          const isSpent = !isAvailable
          const isPreview = armed && isAvailable
          return (
            <span
              key={slot}
              className={`method-die-pip${isAvailable ? " available" : ""}${isSpent ? " spent" : ""}${isPreview ? " drag-preview" : ""}`}
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
          const isPreview = armed
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

          {rolling && (
            <div className="approach-die-popup-die">
              {rollingPreview.map((face, index) => {
                const previewTop = rollingPreview.length > 0 ? Math.max(...rollingPreview) : null
                const isTop = previewTop !== null && face === previewTop
                return (
                  <span key={index} className={`approach-die-chip rolling${isTop ? " top" : ""}`} aria-hidden="true">
                    {face}
                  </span>
                )
              })}
            </div>
          )}

          {!rolling && result && view === "result" && (
            <>
              <div className="approach-die-popup-die">
                {result.dice.map((dieRoll, index) => {
                  const effectiveValue = pendingOverload.has(index) ? overloadedValue(dieRoll) : dieRoll.total
                  const isTop = result.dice.length > 0 && effectiveValue === displayTotal
                  const isPressing = pressingDieIndex === index
                  const isArmed = armedDieIndex === index
                  return (
                    <button
                      key={index}
                      type="button"
                      className={`approach-die-chip${pendingOverload.has(index) ? " overloaded" : ""}${isTop ? " top" : ""}${isPressing ? " pressing" : ""}${isArmed ? " armed" : ""}`}
                      style={{ ["--hold-progress-ms" as string]: `${DIE_LONG_PRESS_MS}ms` } as CSSProperties}
                      onPointerDown={(event) => { event.stopPropagation(); handleDiePointerDown(index, event) }}
                      onPointerMove={(event) => { event.stopPropagation(); handleDiePointerMove(index, event) }}
                      onPointerUp={(event) => { event.stopPropagation(); cancelDiePress() }}
                      onPointerLeave={cancelDiePress}
                      onPointerCancel={cancelDiePress}
                      onContextMenu={(event) => event.preventDefault()}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleDieClick(index)
                      }}
                      title={
                        pendingOverload.has(index)
                          ? "Tap to undo this Overload"
                          : "Hold, then swipe: up Doubles, down sends to Set, right starts Margin, left cancels"
                      }
                    >
                      <span className={`hold-progress-fill${isPressing ? " active" : ""}`} aria-hidden="true" />
                      {dieRoll.rolls[0]}
                      {pendingOverload.has(index) && <span className="approach-die-chip-doubled">DOUBLED</span>}
                    </button>
                  )
                })}
              </div>
              {summedValue !== null && (
                <button
                  type="button"
                  className={`approach-die-chip summed${sumPressing ? " pressing" : ""}${sumArmed ? " armed" : ""}`}
                  style={{ ["--hold-progress-ms" as string]: `${DIE_LONG_PRESS_MS}ms` } as CSSProperties}
                  onPointerDown={(event) => { event.stopPropagation(); handleSumPointerDown(event) }}
                  onPointerMove={(event) => { event.stopPropagation(); handleSumPointerMove(event) }}
                  onPointerUp={(event) => { event.stopPropagation(); cancelSumPress() }}
                  onPointerLeave={cancelSumPress}
                  onPointerCancel={cancelSumPress}
                  onContextMenu={(event) => event.preventDefault()}
                  title="Hold, then swipe: down sends to Set, right starts Margin, left cancels (no Double)"
                >
                  <span className={`hold-progress-fill${sumPressing ? " active" : ""}`} aria-hidden="true" />
                  {summedValue}
                  <span className="approach-die-chip-doubled">SUM</span>
                </button>
              )}
              <div className="approach-die-popup-swipe-hint">
                {summedValue !== null
                  ? "Dice: ↑ Double · ↓ Send to Set · → Margin · ← Cancel  —  Sum: ↓ Set · → Margin · ← Cancel"
                  : "↑ Double · ↓ Send to Set · → Margin · ← Cancel"}
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
