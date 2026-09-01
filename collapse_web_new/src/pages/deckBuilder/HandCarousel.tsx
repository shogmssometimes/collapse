import type { ActivePlay } from '../../utils/playFlow'
import type { Card } from '../../domain/decks/DeckEngine'
import type { CSSProperties, ReactNode } from 'react'
import PlayQueueCard from './PlayQueueCard'

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
  playOrigin: 'combat' | 'roleplay'
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
  playOrigin,
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
        {activePlay?.baseId && (
          <div style={{ marginTop: 8 }}>
            <PlayQueueCard
              activePlay={activePlay}
              cardLookup={cardLookup}
              origin={playOrigin}
              onFinalizePlay={onFinalizePlay}
              onCancelPlay={onCancelPlay}
            />
          </div>
        )}
      </div>
    </section>
  )
}
