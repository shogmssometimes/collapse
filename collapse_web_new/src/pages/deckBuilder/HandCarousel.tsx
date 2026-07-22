import type { ActivePlay } from '../../utils/playFlow'
import type { Card } from '../../domain/decks/DeckEngine'
import type { CSSProperties, ReactNode } from 'react'

type HandCarouselProps = {
  handListRef: React.MutableRefObject<HTMLDivElement | null>
  handFanStyle: CSSProperties
  onScroll: () => void
  handDisplayCards: ReactNode
  handIsEmpty: boolean
  handNavState: { left: boolean; right: boolean }
  onScrollLeft: () => void
  onScrollRight: () => void
  handCount: number
  handLimit: number
  activePlay: ActivePlay
  pendingDeckPlayCount: number
  cardLookup: Map<string, Card>
  onFinalizePlay: () => void
  onCancelPlay: () => void
}

export default function HandCarousel({
  handListRef,
  handFanStyle,
  onScroll,
  handDisplayCards,
  handIsEmpty,
  handNavState,
  onScrollLeft,
  onScrollRight,
  handCount,
  handLimit,
  activePlay,
  pendingDeckPlayCount,
  cardLookup,
  onFinalizePlay,
  onCancelPlay,
}: HandCarouselProps) {
  return (
    <section className="compact">
      <div style={{ marginBottom: 12 }}>
        <div className="hand-carousel">
          <div
            className="hand-track"
            style={handFanStyle}
            ref={handListRef}
            onScroll={onScroll}
          >
            {handDisplayCards}
          </div>
          {handIsEmpty && (
            <div className="muted" style={{ marginTop: 6, textAlign: 'center' }}>No cards in hand</div>
          )}
          <div className="hand-nav hand-nav-with-count">
            <button
              className="hand-nav-btn"
              onClick={onScrollLeft}
              disabled={!handNavState.left}
              aria-label="Scroll hand left"
              type="button"
            >
              ‹
            </button>
            <div className="hand-count-inline text-body">
              Hand: <strong>{handCount}</strong> / {handLimit}
            </div>
            <button
              className="hand-nav-btn"
              onClick={onScrollRight}
              disabled={!handNavState.right}
              aria-label="Scroll hand right"
              type="button"
            >
              ›
            </button>
          </div>
        </div>
        {activePlay && pendingDeckPlayCount === 0 && (
          <div className="play-overlay" style={{ marginTop: 8 }}>
            <div className="play-overlay-header">
              <div>
                <div className="muted text-body">Current Play</div>
                <div className="play-overlay-title">{cardLookup.get(activePlay.baseId)?.name ?? activePlay.baseId}</div>
              </div>
              <button onClick={onCancelPlay}>Clear</button>
            </div>
            <div className="play-overlay-body">
              <div className="play-overlay-list">
                <div className="muted text-body">Base</div>
                <div>{cardLookup.get(activePlay.baseId)?.name ?? activePlay.baseId}</div>
              </div>
              <div className="play-overlay-list">
                <div className="muted text-body">Modifiers</div>
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
        )}
      </div>
    </section>
  )
}
