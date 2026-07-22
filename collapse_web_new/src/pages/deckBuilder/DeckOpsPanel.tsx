import type { ReactNode } from 'react'

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
        <h2 style={{ textAlign: 'center' }}>Deck Operations</h2>
        <div className="ops-toolbar ops-toolbar-column">
          <button
            className={`draw-health-btn draw-health-${drawHealthVariant}`}
            onClick={onDraw}
            disabled={handAtLimit}
            title={drawHealthLabel}
          >
            <span>Draw 1</span>
            <span className="draw-health-percent">{drawHealthPercent}%</span>
          </button>
          <div className="ops-btn-standard">
            <button
              className={isLocked && hasBuiltDeck && !hasShuffledDeck ? 'cta-pulse' : undefined}
              onClick={onShuffle}
            >
              Shuffle
            </button>
          </div>
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
          <div style={{ marginTop: 8 }}>
            <label style={{ fontWeight: 600, display: 'block', textAlign: 'center' }}>Draw</label>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                marginTop: 8,
                textAlign: 'center',
              }}
            >
              {chudDraw !== null ? (
                <>
                  <div style={{ fontWeight: 600, fontSize: '1.1em' }}>{handLimit}</div>
                  <div className="muted text-body" style={{ fontSize: '0.75em' }}>Synced from cHUD</div>
                </>
              ) : (
                <>
                  <input
                    type="number"
                    min={0}
                    max={maxHandLimit}
                    value={handLimit}
                    onChange={(e) => {
                      const next = Number.parseInt(e.target.value, 10)
                      onHandLimitChange(next)
                    }}
                    style={{ width: 80, maxWidth: '100%', textAlign: 'center' }}
                  />
                  <div className="muted text-body">Active cap for hand cards.</div>
                </>
              )}
            </div>
          </div>
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
