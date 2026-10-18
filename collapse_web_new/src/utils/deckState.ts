import type { Card } from '../domain/decks/DeckEngine'
import { buildInitialCounts, clamp, filterCounts, type CountMap } from './deckBuilding'

export const DEFAULT_HAND_LIMIT = 5
export const MAX_HAND_LIMIT = 20

export type DeckBuilderState = {
  baseCounts: CountMap
  modCounts: CountMap
  nullCount: number
  modifierCapacity: number
  hasBuiltDeck?: boolean
  hasShuffledDeck?: boolean
  // runtime deck state
  deck?: string[]
  hand?: { id: string; state: 'unspent' | 'played' }[]
  discard?: { id: string; origin: 'played' | 'discarded' }[]
  exile?: string[]
  isLocked?: boolean
  deckName?: string
  savedDecks?: Record<string, {
    name: string
    deck: string[]
    baseCounts: CountMap
    modCounts: CountMap
    nullCount: number
    modifierCapacity: number
    hasBuiltDeck?: boolean
    hasShuffledDeck?: boolean
    createdAt: string
  }>
  handLimit?: number
  actionCounts?: CountMap
  reactionCounts?: CountMap
  /** Charges remaining per owned Engram (mod card id), capped at DEFAULT_ENGRAM_MAX_CHARGES. */
  engramCharges?: Record<string, number>
}

export const defaultState = (
  baseCards: Card[],
  modCards: Card[],
  minNulls: number,
  defaultModCapacity: number
): DeckBuilderState => ({
  baseCounts: buildInitialCounts(baseCards),
  modCounts: buildInitialCounts(modCards),
  nullCount: minNulls,
  modifierCapacity: defaultModCapacity,
  hasBuiltDeck: false,
  hasShuffledDeck: false,
  deck: [],
  hand: [],
  discard: [],
  exile: [],
  isLocked: false,
  deckName: '',
  savedDecks: {},
  handLimit: DEFAULT_HAND_LIMIT,
  actionCounts: {},
  reactionCounts: {},
  engramCharges: {},
})

export const loadState = (
  baseCards: Card[],
  modCards: Card[],
  storageKey: string,
  minNulls: number,
  defaultModCapacity: number
): DeckBuilderState => {
  if (typeof window === 'undefined') return defaultState(baseCards, modCards, minNulls, defaultModCapacity)
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return defaultState(baseCards, modCards, minNulls, defaultModCapacity)
    const parsed = JSON.parse(raw) as DeckBuilderState
    const baseIdSet = new Set(baseCards.map((card) => card.id))
    const modIdSet = new Set(modCards.map((card) => card.id))
    const parsedBaseCounts = filterCounts(parsed.baseCounts ?? {}, baseIdSet)
    const parsedModCounts = filterCounts(parsed.modCounts ?? {}, modIdSet)
    return {
      baseCounts: { ...buildInitialCounts(baseCards), ...parsedBaseCounts },
      modCounts: { ...buildInitialCounts(modCards), ...parsedModCounts },
      nullCount: Math.max(parsed.nullCount ?? minNulls, minNulls),
      modifierCapacity: parsed.modifierCapacity ?? defaultModCapacity,
      hasBuiltDeck: parsed.hasBuiltDeck ?? false,
      hasShuffledDeck: parsed.hasShuffledDeck ?? false,
      deck: parsed.deck ?? [],
      hand: parsed.hand ?? [],
      discard: parsed.discard ?? [],
      exile: parsed.exile ?? [],
      isLocked: parsed.isLocked ?? false,
      deckName: parsed.deckName ?? '',
      handLimit: clamp(parsed.handLimit ?? DEFAULT_HAND_LIMIT, 0, MAX_HAND_LIMIT),
      savedDecks: parsed.savedDecks ?? {},
      actionCounts: parsed.actionCounts ?? {},
      reactionCounts: parsed.reactionCounts ?? {},
      engramCharges: parsed.engramCharges ?? {},
    }
  } catch {
    return defaultState(baseCards, modCards, minNulls, defaultModCapacity)
  }
}
