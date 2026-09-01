import type { ReactNode } from 'react'

type DiscardPileProps = {
  discardCount: number
  groupedDiscardElements: ReactNode[]
}

export default function DiscardPile({
  discardCount,
  groupedDiscardElements,
}: DiscardPileProps) {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
      <div>
        <h3 style={{ textAlign: 'center' }}>Null Space</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, textAlign: 'center', alignItems: 'center' }}>
          <div className="text-body">Discard Count: <strong>{discardCount}</strong></div>
          <div className="muted text-body">Duplicates stacked</div>
        </div>
        <div className="discard-list">
          {groupedDiscardElements}
          {(groupedDiscardElements?.length ?? 0) === 0 && <div className="muted">Discard pile is empty</div>}
        </div>
      </div>
    </section>
  )
}
