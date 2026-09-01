import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Card } from '../../domain/decks/DeckEngine'

const DETAIL_LONG_PRESS_MS = 500

type CardDetailPopoverNameProps = {
  card: Card | undefined
  name: string
}

// Card name label that shows a details pop-up (target/extra actions/rarity,
// plus card text) on long press. The pop-up closes when clicking/pressing
// anywhere outside of it. Renders via position:fixed (computed from the
// anchor's bounding rect) so it isn't clipped by ancestor rows that use
// overflow:hidden for text-ellipsis truncation.
export default function CardDetailPopoverName({ card, name }: CardDetailPopoverNameProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const timerRef = useRef<number | null>(null)
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const startPress = () => {
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect) {
        const left = Math.min(rect.left, window.innerWidth - 300)
        setCoords({ top: rect.bottom + 6, left: Math.max(8, left) })
      }
      setOpen(true)
    }, DETAIL_LONG_PRESS_MS)
  }

  const cancelPress = () => {
    clearTimer()
  }

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: PointerEvent) => {
      if (popoverRef.current && e.target instanceof Node && popoverRef.current.contains(e.target)) return
      setOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => window.removeEventListener('pointerdown', handlePointerDown, true)
  }, [open])

  return (
    <span
      ref={anchorRef}
      className="card-detail-press-target"
      style={{ position: 'relative', display: 'inline-block' }}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
    >
      {name}
      {open && coords && createPortal(
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            zIndex: 10000,
            minWidth: 220,
            maxWidth: 280,
            background: '#0d0b09',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 8,
            padding: 12,
            boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
            whiteSpace: 'normal',
            textAlign: 'left',
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6, color: '#fff' }}>{card?.name ?? name}</div>
          {card?.text && (
            <div className="muted text-body" style={{ marginBottom: 8 }}>{card.text}</div>
          )}
          {card?.details && card.details.length > 0 && (
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px' }}>
              {card.details.map((detail) => (
                <div key={detail.label} style={{ display: 'contents' }}>
                  <dt style={{ fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{detail.label}</dt>
                  <dd style={{ margin: 0, color: '#fff' }}>{detail.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>,
        document.body
      )}
    </span>
  )
}
