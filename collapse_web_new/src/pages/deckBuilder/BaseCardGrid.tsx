import { createLongPressHandlers } from '../../utils/createLongPressHandlers'
import type { Card } from '../../domain/decks/DeckEngine'

type BaseCardGridProps = {
  baseCards: Card[]
  baseTarget: number
  baseCounts: Record<string, number>
  activeBaseId: string | null
  isLocked: boolean
  skillGridClass: string
  longPressTimer: React.MutableRefObject<number | null>
  longPressFired: React.MutableRefObject<boolean>
  onIncrement: (cardId: string) => void
  onContext: (cardId: string) => void
}

export default function BaseCardGrid({
  baseCards,
  baseTarget,
  baseCounts,
  activeBaseId,
  isLocked,
  skillGridClass,
  longPressTimer,
  longPressFired,
  onIncrement,
  onContext,
}: BaseCardGridProps) {
  return (
    <section className="compact">
      <div className="page-header" style={{ marginBottom: 6 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Base Engrams</h2>
          <p className="muted" style={{ marginTop: 0 }}>Add base engrams until you reach {baseTarget} total base engrams.</p>
        </div>
        <div className="muted text-body">Tap a card to adjust counts.</div>
      </div>
      <div className={skillGridClass}>
        {baseCards.map((card) => {
          const qty = baseCounts[card.id] ?? 0
          const isSelectedBase = activeBaseId === card.id
          const longPressHandlers = createLongPressHandlers(
            longPressTimer,
            longPressFired,
            () => onIncrement(card.id),
            () => onContext(card.id),
            { disabled: isLocked }
          )
          return (
            <div
              key={card.id}
              className={`card base-card ${isSelectedBase ? 'is-selected' : ''}`}
              data-touch-blocker-ignore
              {...longPressHandlers}
            >
              <div className="card-header">
                <div className="card-title" style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                  <div className="card-name">{card.name}</div>
                  <div className="counter-value counter-pill">{qty}</div>
                  {isSelectedBase && <div className="accent text-footnote">Selected Base</div>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
