import type { Card } from '../domain/decks/DeckEngine'

export type FilterOption<T> = { label: string; value: T }

export const buildCostFilterOptions = (modCards: Card[]): FilterOption<number | null>[] => {
  const costs = Array.from(
    new Set(
      modCards
        .map((card) => (typeof card.cost === 'number' ? card.cost : null))
        .filter((value): value is number => value !== null)
    )
  ).sort((a, b) => a - b)
  return [{ label: 'Any', value: null }, ...costs.map((cost) => ({ label: String(cost), value: cost }))]
}

export const buildStringFilterOptions = (
  modCards: Card[],
  extract: (card: Card) => string | undefined
): FilterOption<string | null>[] => {
  const seen = new Map<string, string>()
  modCards.forEach((card) => {
    const raw = extract(card)
    if (!raw) return
    const normalized = raw.trim()
    if (!normalized) return
    const key = normalized.toLowerCase()
    if (!seen.has(key)) seen.set(key, normalized)
  })
  const sorted = Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }))
  return [{ label: 'Any', value: null }, ...sorted.map(([key, display]) => ({ label: display, value: key }))]
}
