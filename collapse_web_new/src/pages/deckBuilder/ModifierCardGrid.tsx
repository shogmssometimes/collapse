import { createLongPressHandlers } from '../../utils/createLongPressHandlers'
import type { Card } from '../../domain/decks/DeckEngine'

type ModifierCardGridProps = {
  sectionRef: React.MutableRefObject<HTMLDivElement | null>
  modifierOverlayPinned: boolean
  onToggleModifierHelper: () => void
  modCapacityRemaining: number
  activeCostFilter: number | null
  costFilterLabel: string
  onCycleCostFilter: () => void
  activeTargetFilter: string | null
  targetFilterLabel: string
  onCycleTargetFilter: () => void
  activeRarityFilter: string | null
  rarityFilterLabel: string
  onCycleRarityFilter: () => void
  filteredModCards: Card[]
  modCounts: Record<string, number>
  activeMods: string[] | undefined
  canAddModCard: (cardId: string) => boolean
  isLocked: boolean
  modLongPressTimer: React.MutableRefObject<number | null>
  modLongPressFired: React.MutableRefObject<boolean>
  onIncrement: (cardId: string) => void
  onContext: (cardId: string) => void
  showCardDetails: boolean
  renderDetails: (card: Card) => React.ReactNode
}

export default function ModifierCardGrid({
  sectionRef,
  modifierOverlayPinned,
  onToggleModifierHelper,
  modCapacityRemaining,
  activeCostFilter,
  costFilterLabel,
  onCycleCostFilter,
  activeTargetFilter,
  targetFilterLabel,
  onCycleTargetFilter,
  activeRarityFilter,
  rarityFilterLabel,
  onCycleRarityFilter,
  filteredModCards,
  modCounts,
  activeMods,
  canAddModCard,
  isLocked,
  modLongPressTimer,
  modLongPressFired,
  onIncrement,
  onContext,
  showCardDetails,
  renderDetails,
}: ModifierCardGridProps) {
  return (
    <section ref={sectionRef} className="compact" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="modifier-header-row">
        <div className="modifier-header-text">
          <h2 style={{ marginBottom: 4 }}>Modifier Cards</h2>
        </div>
        <button
          type="button"
          className={`mod-helper-btn ${modifierOverlayPinned ? 'is-active' : ''}`}
          onClick={onToggleModifierHelper}
          aria-pressed={modifierOverlayPinned}
          title="Pin the modifier counter helper"
        >
          <span className="mod-helper-label">Counter Helper</span>
          <span className="mod-helper-state">{modCapacityRemaining} left</span>
        </button>
      </div>
      <div className="filter-pill-row" role="group" aria-label="Modifier filters">
        <button type="button" className={`filter-pill ${activeCostFilter !== null ? 'is-active' : ''}`} onClick={onCycleCostFilter}>
          <span className="filter-pill-label">Cost</span>
          <span className="filter-pill-value">{costFilterLabel}</span>
        </button>
        <button type="button" className={`filter-pill ${activeTargetFilter ? 'is-active' : ''}`} onClick={onCycleTargetFilter}>
          <span className="filter-pill-label">Target</span>
          <span className="filter-pill-value">{targetFilterLabel}</span>
        </button>
        <button type="button" className={`filter-pill ${activeRarityFilter ? 'is-active' : ''}`} onClick={onCycleRarityFilter}>
          <span className="filter-pill-label">Rarity</span>
          <span className="filter-pill-value">{rarityFilterLabel}</span>
        </button>
      </div>

      <div className="card-grid mod-card-grid">
        {filteredModCards.map((card) => {
          const qty = modCounts[card.id] ?? 0
          const cost = card.cost ?? 0
          const isAttached = activeMods?.includes(card.id)
          const canAddMore = canAddModCard(card.id)
          let modText = card.text ?? ''
          let modTarget: string | null = null
          if (card.text) {
            const m = card.text.match(/^(.*?)(?:\s*[•·]\s*|\s+)Target:\s*(.*)$/i)
            if (m) {
              modText = m[1].trim()
              modTarget = m[2]?.trim() || null
            }
          }
          const modLongPressHandlers = createLongPressHandlers(
            modLongPressTimer,
            modLongPressFired,
            () => onIncrement(card.id),
            () => onContext(card.id),
            { disabled: isLocked || qty <= 0 }
          )
          return (
            <div
              key={card.id}
              className={`card mod-card ${isAttached ? 'is-selected' : ''}`}
              data-touch-blocker-ignore
              {...modLongPressHandlers}
            >
              <div className="card-header" style={{ gap: 12 }}>
                <div className="card-title" style={{ minWidth: 0, flex: '1 1 auto' }}>
                  <div className="card-name">{card.name}</div>
                  <div className="muted text-body">Cost {cost}</div>
                  {isAttached && <div className="accent text-footnote" style={{ marginTop: 4 }}>Attached</div>}
                </div>
                <div className="counter-value counter-pill" style={{ minWidth: 34, textAlign: 'center' }}>{qty}</div>
              </div>
              {!canAddMore && <div className="capacity-reached">Capacity reached</div>}
              {showCardDetails && (!card.details || card.details.length === 0) && (
                <div className="text-body card-text" style={{ marginTop: 15, marginBottom: 0 }}>
                  {modText && <div>{modText}</div>}
                  {modTarget && <div className="target-line">Target: {modTarget}</div>}
                  {!modText && !modTarget && card.text && <div>{card.text}</div>}
                </div>
              )}
              {renderDetails(card)}
            </div>
          )
        })}
      </div>
    </section>
  )
}
