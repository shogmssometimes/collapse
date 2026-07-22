import type { Card } from '../domain/decks/DeckEngine'

export type CountMap = Record<string, number>

export const clamp = (value: number, min: number, max?: number) => {
  if (value < min) return min
  if (typeof max === 'number' && value > max) return max
  return value
}

export const sumCounts = (counts: CountMap) => Object.values(counts).reduce((sum, qty) => sum + qty, 0)

export const buildInitialCounts = (cards: Card[]) =>
  cards.reduce<CountMap>((acc, card) => {
    acc[card.id] = 0
    return acc
  }, {})

export const filterCounts = (counts: CountMap, allowedIds: Set<string>) =>
  Object.entries(counts).reduce<CountMap>((acc, [id, qty]) => {
    if (allowedIds.has(id)) acc[id] = qty
    return acc
  }, {})

// Expand base/mod/null counts into a flat array of card ids (one entry per copy).
export const buildDeckArray = (
  baseCounts: CountMap,
  modCounts: CountMap,
  nullCount: number,
  nullCardId?: string
): string[] => {
  const out: string[] = []
  Object.entries(baseCounts).forEach(([id, qty]) => {
    for (let i = 0; i < qty; i++) out.push(id)
  })
  Object.entries(modCounts).forEach(([id, qty]) => {
    for (let i = 0; i < qty; i++) out.push(id)
  })
  if (nullCount && nullCardId) {
    for (let i = 0; i < nullCount; i++) out.push(nullCardId)
  }
  return out
}

// Fisher-Yates shuffle using crypto-strength randomness. Mutates and returns arr.
export const shuffleInPlace = <T,>(arr: T[]): T[] => {
  const rand = new Uint32Array(arr.length)
  crypto.getRandomValues(rand)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand[i] % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
