import { useRef, useState } from 'react'

const DEFAULT_HOLD_MS = 900

type HoldButtonProps = {
  label: string
  onHold: () => void
  holdMs?: number
  className?: string
  style?: React.CSSProperties
  ariaLabel?: string
}

// Generic long-press button: holding it down for holdMs fires onHold. A fill
// sweeps across the button while held to visually register the press;
// releasing early resets the fill instantly and cancels the action.
export default function HoldButton({ label, onHold, holdMs = DEFAULT_HOLD_MS, className, style, ariaLabel }: HoldButtonProps) {
  const [holding, setHolding] = useState(false)
  const timerRef = useRef<number | null>(null)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const startHold = () => {
    clearTimer()
    setHolding(true)
    timerRef.current = window.setTimeout(() => {
      setHolding(false)
      onHold()
    }, holdMs)
  }

  const cancelHold = () => {
    clearTimer()
    setHolding(false)
  }

  return (
    <button
      type="button"
      className={`reshuffle-btn${className ? ` ${className}` : ''}`}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      style={{ ['--reshuffle-hold-ms' as string]: `${holdMs}ms`, ...style } as React.CSSProperties}
      aria-label={ariaLabel ?? `${label} (hold to confirm)`}
    >
      <span className={`reshuffle-progress${holding ? ' active' : ''}`} aria-hidden="true" />
      <span className="reshuffle-label">{label}</span>
    </button>
  )
}
