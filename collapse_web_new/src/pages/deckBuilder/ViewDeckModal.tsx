import type { ActivePlay } from '../../utils/playFlow'
import type { Card } from '../../domain/decks/DeckEngine'
import ViewDeckContent from './ViewDeckContent'

type DeckSummaryEntry = { id: string; count: number; name: string }

type ViewDeckModalProps = {
  show: boolean
  onClose: () => void
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

export default function ViewDeckModal({
  show,
  onClose,
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
}: ViewDeckModalProps) {
  if (!show) return null
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="View Deck Overlay"
    >
      <div
        style={{ background: '#0d0b09', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 20, width: 'min(420px, 90vw)', color: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>View Deck</div>
          <button className="ghost-btn" onClick={onClose} aria-label="Close View Deck">✕</button>
        </div>
        <ViewDeckContent
          opsError={opsError}
          deckSummary={deckSummary}
          nullId={nullId}
          deckCounts={deckCounts}
          pendingDeckCounts={pendingDeckCounts}
          overlayHasPending={overlayHasPending}
          overlayBaseId={overlayBaseId}
          overlayModCounts={overlayModCounts}
          onPlaySpecificCard={onPlaySpecificCard}
          onExileCard={onExileCard}
          onDiscardCard={onDiscardCard}
          needsLock={needsLock}
          needsBuild={needsBuild}
          needsShuffle={needsShuffle}
          activePlay={activePlay}
          cardLookup={cardLookup}
          activePlayCost={activePlayCost}
          modifierCapacity={modifierCapacity}
          onFinalizePlay={onFinalizePlay}
        />
      </div>
    </div>
  )
}
