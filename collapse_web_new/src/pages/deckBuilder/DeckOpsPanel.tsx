import type { ReactNode } from 'react'
import ReshuffleButton from './ReshuffleButton'
import HoldButton from './HoldButton'

type DeckOpsPanelProps = {
  drawHealthVariant: string
  onDraw: () => void
  handAtLimit: boolean
  drawHealthLabel: string
  drawHealthPercent: number
  isLocked: boolean
  hasBuiltDeck: boolean
  hasShuffledDeck: boolean
  onShuffle: () => void
  onReshuffle: () => void
  reshuffleMessage: string | null
  lockControlsInOps: boolean
  needsLock: boolean
  onToggleLock: () => void
  lockPill: ReactNode
  opsError: string | null
  onViewDeck: () => void
  chudDraw: number | null
  handLimit: number
  maxHandLimit: number
  onHandLimitChange: (next: number) => void
  cardsRemaining: number
  shuffledRecently: boolean
  onShuffleFlashEnd: () => void
}

export default function DeckOpsPanel({
  drawHealthVariant,
  onDraw,
  handAtLimit,
  drawHealthLabel,
  drawHealthPercent,
  isLocked,
  hasBuiltDeck,
  hasShuffledDeck,
  onShuffle,
  onReshuffle,
  reshuffleMessage,
  lockControlsInOps,
  needsLock,
  onToggleLock,
  lockPill,
  opsError,
  onViewDeck,
  chudDraw,
  handLimit,
  maxHandLimit,
  onHandLimitChange,
  cardsRemaining,
  shuffledRecently,
  onShuffleFlashEnd,
}: DeckOpsPanelProps) {
  return (
    <section className="compact">
      <div>
        <div className="ops-toolbar ops-toolbar-column">
          <button
            className={`draw-health-btn draw-health-${drawHealthVariant}`}
            onClick={onDraw}
            disabled={handAtLimit}
            title={drawHealthLabel}
          >
            <span className="draw-health-label">Draw 1</span>
            <span className="draw-health-percent">{drawHealthPercent}%</span>
          </button>
          <div className="ops-btn-standard">
            <HoldButton
              label="Shuffle"
              onHold={onShuffle}
              className={isLocked && hasBuiltDeck && !hasShuffledDeck ? 'cta-pulse' : undefined}
            />
          </div>
          <div className="ops-btn-standard">
            <ReshuffleButton onReshuffle={onReshuffle} />
          </div>
          {reshuffleMessage && (
            <div className="muted text-body" style={{ textAlign: 'center', marginTop: -4 }}>{reshuffleMessage}</div>
          )}
          {lockControlsInOps && (
            <button
              className={needsLock ? 'cta-pulse' : undefined}
              onClick={onToggleLock}
            >
              {isLocked ? 'Unlock Deck' : 'Lock Deck'}
            </button>
          )}
          {lockPill}
        </div>
        {opsError && <div className="ops-error">{opsError}</div>}
        <div className="ops-btn-standard" style={{ marginTop: 12 }}>
          <button type="button" aria-label="View Deck" className="view-deck-btn" onClick={onViewDeck}>View Deck</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ marginTop: 12, textAlign: 'center' }} className="text-body">
            <div>Cards Remaining:</div>
            <strong
              className={shuffledRecently ? 'shuffle-flash' : undefined}
              onAnimationEnd={onShuffleFlashEnd}
            >{cardsRemaining}</strong>
          </div>
          <div style={{ marginTop: 8 }}>
            {/* Saved decks section removed */}
          </div>
        </div>
      </div>
    </section>
  )
}
