import { useEffect, useRef, useState } from "react"
import type { DieSides } from "../../domain/approachDice"

const LONG_PRESS_MS = 550
const FEEDBACK_MS = 1100
const SWIPE_THRESHOLD_PX = 40

type Feedback = { direction: "up" | "limit" | "reset"; message: string }

export function ApproachDieSizeControl({
  die,
  onIncrease,
  onReset,
  label = "SHARED APPROACH DIE",
  compact = false,
}: {
  die: DieSides
  onIncrease: () => DieSides
  /** Clears the die back to its default size (replaces the old triple-tap
   * decrease, which was dropped to avoid colliding with the Approach dice
   * arm-via-tap gesture). */
  onReset: () => DieSides
  label?: string
  /** Renders a smaller footer-style variant (used under the HUD's Approach grid). */
  compact?: boolean
}) {
  const [pressing, setPressing] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const feedbackTimer = useRef<number | null>(null)
  const suppressClick = useRef(false)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  const showFeedback = (direction: Feedback["direction"], nextDie: DieSides) => {
    setFeedback({
      direction,
      message:
        direction === "limit"
          ? `LIMIT · D${nextDie}`
          : direction === "reset"
          ? `RESET · D${nextDie}`
          : `DIE UP · D${nextDie}`,
    })
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), FEEDBACK_MS)
  }

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    setPressing(false)
  }

  useEffect(() => () => {
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current)
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current)
  }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    suppressClick.current = false
    pointerStart.current = { x: event.clientX, y: event.clientY }
    setPressing(true)
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null
      suppressClick.current = true
      pointerStart.current = null
      setPressing(false)
      const nextDie = onIncrease()
      showFeedback(nextDie === die ? "limit" : "up", nextDie)
    }, LONG_PRESS_MS)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    cancelLongPress()
    const start = pointerStart.current
    pointerStart.current = null
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    // Only a rightward swipe (dominant horizontal motion) triggers reset, so
    // it can't be mistaken for vertical scrolling and matches the
    // swipe-right convention used elsewhere in the app.
    if (dx >= SWIPE_THRESHOLD_PX && dx > Math.abs(dy)) {
      const nextDie = onReset()
      showFeedback("reset", nextDie)
    }
  }

  const handlePointerLeave = () => {
    cancelLongPress()
    pointerStart.current = null
  }

  const handleContextMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Right-click is the desktop/browser-friendly equivalent of the
    // swipe-right-to-reset gesture.
    event.preventDefault()
    cancelLongPress()
    pointerStart.current = null
    const nextDie = onReset()
    showFeedback("reset", nextDie)
  }

  return (
    <div className={`approach-die-size-control${compact ? " compact" : ""}`}>
      <button
        type="button"
        className={`approach-die-size-button${pressing ? " pressing" : ""}${feedback ? ` ${feedback.direction}` : ""}`}
        aria-label={`${label}, D${die}. Long press to increase die size; swipe right or right-click to reset it.`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
        onClick={(event) => event.preventDefault()}
        onContextMenu={handleContextMenu}
        style={{ ["--hold-progress-ms" as string]: `${LONG_PRESS_MS}ms` } as React.CSSProperties}
      >
        <span className={`hold-progress-fill${pressing ? " active" : ""}`} aria-hidden="true" />
        <span className="approach-die-size-value">D{die}</span>
        <span className="approach-die-size-hint">{label}</span>
        {feedback && (
          <span className="approach-die-size-feedback" role="status" aria-live="polite">
            {feedback.message}
          </span>
        )}
      </button>
      <span className="approach-die-size-instructions">LONG PRESS: UP · SWIPE RIGHT: RESET</span>
    </div>
  )
}
