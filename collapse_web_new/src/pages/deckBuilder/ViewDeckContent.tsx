import type { ActivePlay } from '../../utils/playFlow'
import type { Card } from '../../domain/decks/DeckEngine'
import CardDetailPopoverName from './CardDetailPopoverName'
import HoldButton from './HoldButton'
import PlayQueueCard from './PlayQueueCard'

type DeckSummaryEntry = { id: string; count: number; name: string }

export type ViewDeckContentProps = {
  opsError: string | null
  deckSummary: DeckSummaryEntry[]
  nullId: string | null
  deckCounts: Record<string, number>
  pendingDeckCounts: Record<string, number>
  overlayHasPending: boolean
  overlayBaseId: string | null
  overlayModCounts: Record<string, number>
  onPlaySpecificCard: (cardId: string) => void
  onExileCard: (cardId: string) => void
  onDiscardCard: (cardId: string) => void
  needsLock: boolean
  needsBuild: boolean
  needsShuffle: boolean
  activePlay: ActivePlay
  playOrigin: 'combat' | 'roleplay'
  cardLookup: Map<string, Card>
  onFinalizePlay: () => void
  onCancelPlay: () => void
}

// The deck-summary + play-selection content shared by the View Deck popup
// (ViewDeckModal) and the Roleplay tab of Deck Ops, which renders this
// content inline instead of as an overlay.
export default function ViewDeckContent({
  opsError,
  deckSummary,
  nullId,
  deckCounts,
  pendingDeckCounts,
  overlayHasPending,
  overlayBaseId,
  overlayModCounts,
  onPlaySpecificCard,
  onExileCard,
  onDiscardCard,
  needsLock,
  needsBuild,
  needsShuffle,
  activePlay,
  playOrigin,
  cardLookup,
  onFinalizePlay,
  onCancelPlay,
}: ViewDeckContentProps) {
  return (
    <div style={{ minHeight: 180, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {opsError && (
        <div style={{ background: 'rgba(255,64,64,0.08)', border: '1px solid rgba(255,64,64,0.25)', color: '#ffb3b3', borderRadius: 8, padding: '8px 10px', fontWeight: 600 }}>
          {opsError}
        </div>
      )}
      {deckSummary.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>Deck is empty.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
            <span>Card</span>
            <span>Qty</span>
          </div>
          <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deckSummary.map((entry) => {
              const isNull = nullId && entry.id === nullId
              const available = (deckCounts[entry.id] ?? 0) - (pendingDeckCounts[entry.id] ?? 0)
              const isOverlayBase = overlayHasPending && overlayBaseId === entry.id
              const overlayAttachedCount = overlayHasPending ? overlayModCounts[entry.id] ?? 0 : 0
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isNull ? '1fr auto auto auto' : '1fr auto auto auto auto',
                    alignItems: 'center',
                    gap: 10,
                    padding: '16px 14px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: isOverlayBase || overlayAttachedCount
                      ? 'linear-gradient(180deg, rgba(0,255,200,0.1), rgba(0,255,200,0.03))'
                      : 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))',
                    borderRadius: 12,
                    boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
                  }}
                >
                  <span style={{ color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.name}>
                    <CardDetailPopoverName card={cardLookup.get(entry.id)} name={entry.name} />
                    {isOverlayBase && (
                      <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 6px', borderRadius: 999, background: 'rgba(0,255,200,0.18)', color: '#b9fff3', border: '1px solid rgba(0,255,200,0.35)' }}>Selected</span>
                    )}
                    {!isOverlayBase && overlayAttachedCount > 0 && (
                      <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 6px', borderRadius: 999, background: 'rgba(0,191,255,0.18)', color: '#b4e6ff', border: '1px solid rgba(0,191,255,0.35)' }}>
                        Attached x{overlayAttachedCount}
                      </span>
                    )}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: 36 }}>
                    x{entry.count}
                    {pendingDeckCounts[entry.id] ? ` (avail ${Math.max(available, 0)})` : ''}
                  </span>
                  {!isNull && (
                    <button
                      className="ghost-btn"
                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}
                      onClick={() => onPlaySpecificCard(entry.id)}
                      disabled={
                        needsLock ||
                        needsBuild ||
                        needsShuffle ||
                        available <= 0
                      }
                      aria-label={`Attach ${entry.name}`}
                    >
                      Attach
                    </button>
                  )}
                  <HoldButton
                    label="Discard"
                    holdMs={500}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}
                    onHold={() => onDiscardCard(entry.id)}
                    disabled={isOverlayBase || overlayAttachedCount > 0}
                    ariaLabel={
                      isOverlayBase || overlayAttachedCount > 0
                        ? `${entry.name} is attached to the play queue; clear it before discarding`
                        : `Discard ${entry.name} (hold to confirm)`
                    }
                  />
                  <HoldButton
                    label="Exile"
                    holdMs={500}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}
                    onHold={() => onExileCard(entry.id)}
                    disabled={isOverlayBase || overlayAttachedCount > 0}
                    ariaLabel={
                      isOverlayBase || overlayAttachedCount > 0
                        ? `${entry.name} is attached to the play queue; clear it before exiling`
                        : `Exile ${entry.name} (hold to confirm)`
                    }
                  />
                </div>
              )
            })}
          </div>
          <div style={{ textAlign: 'right', color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>Total cards: {deckSummary.reduce((sum, e) => sum + e.count, 0)}</div>
        </div>
      )}
      <PlayQueueCard
        activePlay={activePlay}
        cardLookup={cardLookup}
        origin={playOrigin}
        onFinalizePlay={onFinalizePlay}
        onCancelPlay={onCancelPlay}
      />
    </div>
  )
}
