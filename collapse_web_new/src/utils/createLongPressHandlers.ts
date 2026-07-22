import type { MouseEvent } from 'react'

type TimerRef = { current: number | null }
type FiredRef = { current: boolean }

// Non-hook factory for tap-to-increment / long-press-or-right-click-to-decrement
// pointer handlers. Callers own the timer/fired refs (typically shared across a
// whole grid of cards, matching the pre-refactor behavior where only one
// long-press could be "in flight" at a time within a given card grid).
export function createLongPressHandlers(
  timerRef: TimerRef,
  firedRef: FiredRef,
  onTap: () => void,
  onLongPress: () => void,
  options?: { delay?: number; disabled?: boolean }
) {
  const delay = options?.delay ?? 600
  const disabled = options?.disabled ?? false

  const start = () => {
    if (disabled) return
    firedRef.current = false
    timerRef.current = window.setTimeout(() => {
      firedRef.current = true
      onLongPress()
    }, delay)
  }

  const cancel = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    firedRef.current = false
  }

  const end = () => {
    const fired = firedRef.current
    cancel()
    if (!fired) onTap()
  }

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    firedRef.current = true
    onLongPress()
  }

  return {
    onPointerDown: start,
    onPointerUp: end,
    onPointerLeave: cancel,
    onContextMenu,
  }
}
