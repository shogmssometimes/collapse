import { useRef } from 'react'
import type { ActivePlay } from '../../utils/playFlow'
import type { Card } from '../../domain/decks/DeckEngine'

type PlayQueueCardProps = {
  activePlay: ActivePlay
  cardLookup: Map<string, Card>
  origin: 'combat' | 'roleplay'
  onFinalizePlay: () => void
  onCancelPlay: () => void
}

const LONG_PRESS_MS = 600

// Universal "play in progress" queue card. Shared by Combat (hand carousel)
// and Roleplay (deck summary) so a play started in either mode is visible
// (with an origin badge) no matter which mode is currently active.
export default function PlayQueueCard({ activePlay, cardLookup, origin, onFinalizePlay, onCancelPlay }: PlayQueueCardProps) {
  const timerRef = useRef<number | null>(null)
  const firedRef = useRef(false)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handlePointerDown = () => {
    firedRef.current = false
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      firedRef.current = true
      window.location.hash = '#/combat'
    }, LONG_PRESS_MS)
  }

  const handlePointerUp = () => {
    clearTimer()
  }

  if (!activePlay?.baseId) return null
  const originLabel = origin === 'roleplay' ? 'Roleplay' : 'Combat'
  return (
    <div
      className="play-overlay"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      title="Hold to jump to the Combat page"
    >
      <div className="play-overlay-header">
        <div>
          <div className="muted text-body" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Current Play
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 999,
                background: origin === 'roleplay' ? 'rgba(0,191,255,0.18)' : 'rgba(255,180,0,0.18)',
                color: origin === 'roleplay' ? '#b4e6ff' : '#ffd980',
                border: `1px solid ${origin === 'roleplay' ? 'rgba(0,191,255,0.35)' : 'rgba(255,180,0,0.35)'}`,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 700,
              }}
            >
              {originLabel}
            </span>
          </div>
        </div>
        <button onClick={onCancelPlay}>Clear</button>
      </div>
      <div className="play-overlay-body">
        <div className="play-overlay-list">
          <div className="muted text-body" style={{ fontWeight: 800, color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem' }}>Base</div>
          <div>{cardLookup.get(activePlay.baseId)?.name ?? activePlay.baseId}</div>
        </div>
        <div className="play-overlay-list">
          <div className="muted text-body" style={{ fontWeight: 800, color: 'rgba(255,255,255,0.9)', fontSize: '0.95rem' }}>Modifiers</div>
          {activePlay.mods.length === 0 && <div className="muted">None</div>}
          {activePlay.mods.map((m) => (
            <div key={m} className="play-overlay-mod">
              <span className="play-overlay-mod-name">{cardLookup.get(m)?.name ?? m}</span>
              <span className="play-attach-pill">Attached</span>
            </div>
          ))}
        </div>
      </div>
      <div className="play-overlay-actions">
        <button onClick={onFinalizePlay}>Finalize Play</button>
        <button onClick={onCancelPlay}>Cancel</button>
      </div>
    </div>
  )
}
