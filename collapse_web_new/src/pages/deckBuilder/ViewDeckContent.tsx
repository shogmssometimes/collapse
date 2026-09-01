import type { ActivePlay } from '../../utils/playFlow'
import type { Card } from '../../domain/decks/DeckEngine'
import CardDetailPopoverName from './CardDetailPopoverName'
import HoldButton from './HoldButton'

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
  cardLookup: Map<string, Card>
  activePlayCost: number
  modifierCapacity: number
  onFinalizePlay: () => void
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
  cardLookup,
  activePlayCost,
  modifierCapacity,
  onFinalizePlay,
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
          <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: 4 }}>
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
                    gap: 8,
                    padding: '6px 4px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    background: isOverlayBase || overlayAttachedCount ? 'rgba(0,255,200,0.06)' : 'transparent',
                    borderRadius: 8,
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
                    ariaLabel={`Discard ${entry.name} (hold to confirm)`}
                  />
                  <HoldButton
                    label="Exile"
                    holdMs={500}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}
                    onHold={() => onExileCard(entry.id)}
                    ariaLabel={`Exile ${entry.name} (hold to confirm)`}
                  />
                </div>
              )
            })}
          </div>
          <div style={{ textAlign: 'right', color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>Total cards: {deckSummary.reduce((sum, e) => sum + e.count, 0)}</div>
        </div>
      )}
      <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>
          <span>Play Selection</span>
          <span style={{ fontWeight: 600, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>Finalize here</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
            <span className="muted">Base</span>
            <span style={{ color: '#fff', fontWeight: 700 }}>{activePlay?.baseId ? cardLookup.get(activePlay.baseId)?.name ?? activePlay.baseId : '—'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Modifiers</span>
            {activePlay?.mods?.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {activePlay.mods.map((m) => (
                  <span key={m} className="play-attach-pill" style={{ background: 'rgba(0, 255, 200, 0.12)', border: '1px solid rgba(0,255,200,0.35)', color: '#b9fff3' }}>
                    {cardLookup.get(m)?.name ?? m}
                  </span>
                ))}
              </div>
            ) : (
              <span className="muted">None</span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
            <span className="muted">Mod Cost</span>
            <span style={{ color: '#fff', fontWeight: 700 }}>
              {activePlayCost} / {modifierCapacity}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            className="counter-btn"
            style={{ flex: '1 1 160px', minWidth: 140 }}
            onClick={onFinalizePlay}
            disabled={!activePlay?.baseId}
          >
            Finalize Play
          </button>
        </div>
      </div>
    </div>
  )
}
