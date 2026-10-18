import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { ApproachRollResult, DieSides } from "../../domain/approachDice"

export type ApproachDieRollResult = ApproachRollResult

const POPUP_TIMEOUT_MS = 5000
const ROLL_ANIM_TICKS = 8
const ROLL_ANIM_INTERVAL_MS = 60
const LONG_PRESS_MS = 500
const ERROR_FLASH_MS = 420

const dieLabel = (die: DieSides) => `D${die}`

// Approach dice card: tapping arms one die (up to the Approach's available
// pool); a long press rolls using however many dice are currently armed, then
// resets the armed count back to 0. Adding a point to an Approach (via the
// Core distribution popout) already implies the extra die is available — no
// separate "breakout" indicator is needed here.
export function ApproachDie({
  label,
  rating,
  available,
  die,
  onRoll,
  onOverload,
}: {
  label: string
  /** Full Approach rating, i.e. the size of the Overload dice pool. */
  rating: number
  /** Dice currently available to arm (rating minus any Overloaded-and-spent dice). */
  available: number
  die: DieSides
  onRoll: (count: number) => ApproachDieRollResult
  /** Doubles one rolled die's value and spends it from the Overload pool. Returns false if the pool is exhausted. */
  onOverload?: (dieIndex: number) => boolean
}) {
  const [armed, setArmed] = useState(0)
  const [errorFlash, setErrorFlash] = useState(false)
  const [result, setResult] = useState<ApproachDieRollResult | null>(null)
  const [overloaded, setOverloaded] = useState<Set<number>>(new Set())
  const [rolling, setRolling] = useState(false)
  const [pressing, setPressing] = useState(false)
  const popupTimer = useRef<number | null>(null)
  const rollAnimTimer = useRef<number | null>(null)
  const errorFlashTimer = useRef<number | null>(null)
  const longPressTimer = useRef<number | null>(null)
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
    if (popupTimer.current !== null) {
      window.clearTimeout(popupTimer.current)
      popupTimer.current = null
    }
    if (rollAnimTimer.current !== null) {
      window.clearInterval(rollAnimTimer.current)
      rollAnimTimer.current = null
    }
  }, [])

  useEffect(() => {
    if (!result) return
    popupTimer.current = window.setTimeout(closePopup, POPUP_TIMEOUT_MS)
    const handleOutside = (event: PointerEvent) => {
      if (boxRef.current && event.target instanceof Node && !boxRef.current.contains(event.target)) closePopup()
    }
    document.addEventListener("pointerdown", handleOutside)
    return () => {
      document.removeEventListener("pointerdown", handleOutside)
      if (popupTimer.current !== null) window.clearTimeout(popupTimer.current)
    }
  }, [result, closePopup])

  useEffect(() => () => {
    if (rollAnimTimer.current !== null) window.clearInterval(rollAnimTimer.current)
    if (errorFlashTimer.current !== null) window.clearTimeout(errorFlashTimer.current)
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current)
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

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    setPressing(false)
  }

  const handlePointerDown = () => {
    suppressClick.current = false
    setPressing(true)
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null
      suppressClick.current = true
      setPressing(false)
      rollArmed()
    }, LONG_PRESS_MS)
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

  return (
    <button
      ref={boxRef}
      type="button"
      className={`approach-die${pressing ? " pressing" : ""}${errorFlash ? " error" : ""}`}
      aria-label={`${label}: ${rating}D${die}, ${armed} armed of ${available} available. Tap to arm a die, hold to roll.`}
      onPointerDown={handlePointerDown}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onClick={handleClick}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="approach-die-label">{label}</span>
      <span className="approach-die-value">{rating}D{die}</span>
      <div className="approach-die-pips" aria-hidden="true">
        {Array.from({ length: available }, (_, index) => (
          <span key={index} className={`approach-die-pip${index < armed ? " armed" : ""}`} />
        ))}
      </div>
      <span className="approach-die-sub">
        {available <= 0 ? "No dice" : errorFlash ? "No more dice" : "Tap: arm · Hold: roll"}
      </span>

      {(rolling || result) && createPortal(
        <div className="approach-die-popup" onPointerDown={(event) => event.stopPropagation()}>
          <div className="approach-die-popup-label">{label}</div>
          {rolling ? (
            <div className="approach-die-popup-value rolling" aria-label="Rolling dice">…</div>
          ) : result && (
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
                    {overloaded.has(index) && " ×2"}
                  </button>
                ))}
              </div>
              {onOverload && (
                <div className="approach-die-popup-pool">
                  Overload pool: {overloadPoolRemaining}/{rating}
                </div>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </button>
  )
}
