import type { ReactNode } from 'react'

type ExilePileProps = {
  exileCount: number
  groupedExileElements: ReactNode[]
}

// Second discard-style pile for cards that get exiled. Wiring for what sends
// cards here is not implemented yet; this is the UI shell only.
export default function ExilePile({
  exileCount,
  groupedExileElements,
}: ExilePileProps) {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
      <div>
        <h3 style={{ textAlign: 'center' }}>Exile</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, textAlign: 'center', alignItems: 'center' }}>
          <div className="text-body">Exile Count: <strong>{exileCount}</strong></div>
          <div className="muted text-body">Duplicates stacked</div>
        </div>
        <div className="discard-list">
          {groupedExileElements}
          {(groupedExileElements?.length ?? 0) === 0 && <div className="muted">Exile is empty</div>}
        </div>
      </div>
    </section>
  )
}
