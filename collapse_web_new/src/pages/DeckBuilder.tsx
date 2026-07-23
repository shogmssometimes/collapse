import React, {useEffect, useMemo, useState, useCallback, useRef} from 'react'
import ImportExportJSON from '../components/ImportExportJSON'
import { startPlaySelection, toggleAttach, finalizeSelection, cancelSelection, ActivePlay } from '../utils/playFlow'
import { getModCapacityUsed, canAddModCardFrom } from '../utils/modCapacity'
import Handbook from '../data/handbook'
import { Card, CardDetail } from '../domain/decks/DeckEngine'
import { buildDeckArray, shuffleInPlace, sumCounts, clamp } from '../utils/deckBuilding'
import { DEFAULT_HAND_LIMIT, MAX_HAND_LIMIT, defaultState, loadState, type DeckBuilderState } from '../utils/deckState'
import { buildCostFilterOptions, buildStringFilterOptions, type FilterOption } from '../utils/cardFilters'
import { readChudCapacity, readChudDraw } from '../utils/chudStorage'
import { useHandNavigation } from '../hooks/useHandNavigation'
import { useScrollDetection } from '../hooks/useScrollDetection'
import BaseCardGrid from './deckBuilder/BaseCardGrid'
import ModifierCardGrid from './deckBuilder/ModifierCardGrid'
import HandCarousel from './deckBuilder/HandCarousel'
import DeckOpsPanel from './deckBuilder/DeckOpsPanel'
import DiscardPile from './deckBuilder/DiscardPile'
import ViewDeckModal from './deckBuilder/ViewDeckModal'

const DEFAULT_BASE_TARGET = 26
const DEFAULT_MIN_NULLS = 5
const DEFAULT_STORAGE_KEY = 'collapse.deck-builder.v2'
const DEFAULT_MODIFIER_CAPACITY = 10
const DEFAULT_CHUD_STATE_KEY = 'chud.state.v1'

type DeckBuilderProps = {
  storageKey?: string
  exportPrefix?: string
  baseCardsOverride?: Card[]
  modCardsOverride?: Card[]
  nullCardOverride?: Card
  actionCardsOverride?: Card[]
  reactionCardsOverride?: Card[]
  baseTarget?: number
  minNulls?: number
  modifierCapacityDefault?: number
  showCardDetails?: boolean
  simpleCounters?: boolean
  modCapacityAsCount?: boolean
  baseInitialCount?: number
  modInitialCount?: number
  showBuilderSections?: boolean
  showOpsSections?: boolean
  showModifierCards?: boolean
  showModifierCardCounter?: boolean
  showModifierCapacity?: boolean
  showBaseCounters?: boolean
  showBaseAdjusters?: boolean
  lockControlsInOps?: boolean
  chudStateStorageKey?: string
  syncWithChud?: boolean
  showActionReactionCards?: boolean
  independentPlay?: boolean
}

export default function DeckBuilder({
  storageKey = DEFAULT_STORAGE_KEY,
  exportPrefix = 'collapse-deck',
  baseCardsOverride,
  modCardsOverride,
  nullCardOverride,
  actionCardsOverride,
  reactionCardsOverride,
  baseTarget = DEFAULT_BASE_TARGET,
  minNulls = DEFAULT_MIN_NULLS,
  modifierCapacityDefault = DEFAULT_MODIFIER_CAPACITY,
  showCardDetails = true,
  simpleCounters = false,
  modCapacityAsCount = false,
  baseInitialCount,
  modInitialCount,
  showBuilderSections = true,
  showOpsSections = true,
  showModifierCards = true,
  showModifierCardCounter = true,
  showModifierCapacity = true,
  showBaseCounters = true,
  showBaseAdjusters = true,
  lockControlsInOps = true,
  chudStateStorageKey = DEFAULT_CHUD_STATE_KEY,
  syncWithChud = true,
  showActionReactionCards = false,
  independentPlay = false,
}: DeckBuilderProps){
  const baseCards = baseCardsOverride ?? (Handbook.baseCards ?? [])
  const modCards = modCardsOverride ?? (Handbook.modCards ?? [])
  const nullCard = nullCardOverride ?? Handbook.nullCards?.[0]
  const actionCards = actionCardsOverride ?? []
  const reactionCards = reactionCardsOverride ?? []

  const primaryBaseId = baseCards[0]?.id
  const primaryModId = modCards[0]?.id
  const primaryActionId = actionCards[0]?.id
  const primaryReactionId = reactionCards[0]?.id

  const applyInitialCounts = useCallback(
    (state: DeckBuilderState): DeckBuilderState => {
      if (!simpleCounters) return state
      const next: DeckBuilderState = {
        ...state,
        baseCounts: { ...state.baseCounts },
        modCounts: { ...state.modCounts },
        actionCounts: { ...(state.actionCounts ?? {}) },
        reactionCounts: { ...(state.reactionCounts ?? {}) },
      }
      const totalBase = sumCounts(next.baseCounts)
      const totalMod = sumCounts(next.modCounts)
      if (primaryBaseId && totalBase === 0) {
        next.baseCounts[primaryBaseId] = baseInitialCount ?? baseTarget
      }
      if (primaryModId && totalMod === 0) {
        next.modCounts[primaryModId] = modInitialCount ?? modifierCapacityDefault
      }
      return next
    },
    [baseInitialCount, baseTarget, modInitialCount, modifierCapacityDefault, primaryBaseId, primaryModId, simpleCounters]
  )

  const initialState = applyInitialCounts(loadState(baseCards, modCards, storageKey, minNulls, modifierCapacityDefault))
  const [builderState, setBuilderState] = useState(initialState)
  const [costFilterIndex, setCostFilterIndex] = useState(0)
  const [targetFilterIndex, setTargetFilterIndex] = useState(0)
  const [rarityFilterIndex, setRarityFilterIndex] = useState(0)
  const [deckSeed, setDeckSeed] = useState(0)
  const [activePlay, setActivePlay] = useState<ActivePlay>(null)
  const [modifierOverlayPinned, setModifierOverlayPinned] = useState(false)
  const [attachWarningId, setAttachWarningId] = useState<string | null>(null)
  const [hasBuiltDeck, setHasBuiltDeck] = useState(initialState.hasBuiltDeck ?? false)
  const [hasShuffledDeck, setHasShuffledDeck] = useState(initialState.hasShuffledDeck ?? false)
  const [opsError, setOpsError] = useState<string | null>(null)
  const [shuffledRecently, setShuffledRecently] = useState(false)
  const [showViewDeck, setShowViewDeck] = useState(false)
  const [pendingDeckPlay, setPendingDeckPlay] = useState<string[]>([])
  const handCount = (builderState.hand ?? []).length
  const { handListRef, handNavState, updateHandNav, scrollHand } = useHandNavigation(handCount)
  const { sectionRef: modifierSectionRef, inView: modifierOverlayInView } = useScrollDetection(!simpleCounters && showModifierCards)

  const modLongPressTimer = useRef<number | null>(null)
  const modLongPressFired = useRef(false)

  const [chudCapacity, setChudCapacity] = useState<number | null>(() =>
    syncWithChud && typeof window !== 'undefined' ? readChudCapacity(chudStateStorageKey) : null
  )
  const [chudDraw, setChudDraw] = useState<number | null>(() =>
    syncWithChud && typeof window !== 'undefined' ? readChudDraw(chudStateStorageKey) : null
  )

  useEffect(() => {
    if (!syncWithChud || chudCapacity === null) return
    setBuilderState(prev => ({ ...prev, modifierCapacity: chudCapacity }))
  }, [chudCapacity, syncWithChud])

  useEffect(() => {
    if (!syncWithChud || chudDraw === null) return
    setBuilderState(prev => ({ ...prev, handLimit: chudDraw }))
  }, [chudDraw, syncWithChud])

  useEffect(() => {
    if (!syncWithChud) return
    const handler = (e: StorageEvent) => {
      if (e.key !== chudStateStorageKey) return
      setChudCapacity(readChudCapacity(chudStateStorageKey))
      setChudDraw(readChudDraw(chudStateStorageKey))
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [chudStateStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload = { ...builderState, hasBuiltDeck, hasShuffledDeck }
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  }, [builderState, storageKey, hasBuiltDeck, hasShuffledDeck])

  const baseTotal = sumCounts(builderState.baseCounts)
  const modCapacityUsed = useMemo(
    () => (modCapacityAsCount ? sumCounts(builderState.modCounts) : getModCapacityUsed(modCards, builderState.modCounts)),
    [builderState.modCounts, modCards, modCapacityAsCount]
  )
  const modCapacityTotal = builderState.modifierCapacity ?? 0
  const modCapacityRemaining = Math.max(modCapacityTotal - modCapacityUsed, 0)
  const modOverlayLabel = modCapacityAsCount ? 'Modifier Slots Left' : 'Capacity Left'
  const cardsRemaining = builderState.deck?.length ?? 0
  const totalCards = cardsRemaining + (builderState.hand?.length ?? 0) + (builderState.discard?.length ?? 0)
  const deckPercent = totalCards > 0 ? cardsRemaining / totalCards : 0
  const drawHealthVariant = useMemo(() => {
    if (deckPercent >= 0.9) return 'healthy'
    if (deckPercent >= 0.7) return 'ready'
    if (deckPercent >= 0.5) return 'caution'
    if (deckPercent >= 0.3) return 'warning'
    if (deckPercent >= 0.1) return 'critical'
    return 'depleted'
  }, [deckPercent])
  const drawHealthPercent = Math.round(deckPercent * 100)
  const drawHealthLabel = totalCards > 0 ? `${drawHealthPercent}% deck remaining` : 'Deck empty'

  const getModUsedSnapshot = useCallback(
    (state: DeckBuilderState) => (modCapacityAsCount ? sumCounts(state.modCounts ?? {}) : getModCapacityUsed(modCards, state.modCounts ?? {})),
    [modCapacityAsCount, modCards]
  )

  // pure helper: test if a card can be added given a state snapshot
  const canAddModCardSnapshot = useCallback(
    (state: DeckBuilderState, cardId: string) => {
      if (simpleCounters && modCapacityAsCount) return true
      if (modCapacityAsCount) {
        return getModUsedSnapshot(state) < (state.modifierCapacity ?? 0)
      }
      return canAddModCardFrom(modCards, state, cardId)
    },
    [getModUsedSnapshot, modCapacityAsCount, modCards, simpleCounters]
  )

  // enforce mod capacity when adding a modifier
  const canAddModCard = useCallback(
    (cardId: string) => canAddModCardSnapshot(builderState, cardId),
    [builderState, canAddModCardSnapshot]
  )

  const baseValid = simpleCounters ? true : baseTotal === baseTarget
  const nullValid = builderState.nullCount >= minNulls
  const modValid = simpleCounters && modCapacityAsCount ? true : modCapacityUsed <= builderState.modifierCapacity
  const deckIsValid = baseValid && nullValid && modValid
  const lockLabel = builderState.isLocked && hasBuiltDeck && hasShuffledDeck ? 'Deck Locked + Primed' : (builderState.isLocked ? 'Deck Locked' : 'Deck Unlocked')
  const lockPill = builderState.isLocked ? <span className="lock-pill locked">{lockLabel}</span> : <span className="lock-pill unlocked">{lockLabel}</span>

  const costFilterOptions = useMemo(() => buildCostFilterOptions(modCards), [modCards])
  const targetFilterOptions = useMemo(() => buildStringFilterOptions(modCards, (card) => card.target), [modCards])
  const rarityFilterOptions = useMemo(() => buildStringFilterOptions(modCards, (card) => card.rarity), [modCards])

  useEffect(() => {
    setCostFilterIndex((idx) => (costFilterOptions.length ? idx % costFilterOptions.length : 0))
  }, [costFilterOptions.length])
  useEffect(() => {
    setTargetFilterIndex((idx) => (targetFilterOptions.length ? idx % targetFilterOptions.length : 0))
  }, [targetFilterOptions.length])
  useEffect(() => {
    setRarityFilterIndex((idx) => (rarityFilterOptions.length ? idx % rarityFilterOptions.length : 0))
  }, [rarityFilterOptions.length])

  const activeCostFilter = costFilterOptions[costFilterIndex]?.value ?? null
  const activeTargetFilter = targetFilterOptions[targetFilterIndex]?.value ?? null
  const activeRarityFilter = rarityFilterOptions[rarityFilterIndex]?.value ?? null
  const costFilterLabel = costFilterOptions[costFilterIndex]?.label ?? 'Any'
  const targetFilterLabel = targetFilterOptions[targetFilterIndex]?.label ?? 'Any'
  const rarityFilterLabel = rarityFilterOptions[rarityFilterIndex]?.label ?? 'Any'

  const cycleCostFilter = useCallback(() => {
    setCostFilterIndex((idx) => (costFilterOptions.length ? (idx + 1) % costFilterOptions.length : 0))
  }, [costFilterOptions.length])

  const cycleTargetFilter = useCallback(() => {
    setTargetFilterIndex((idx) => (targetFilterOptions.length ? (idx + 1) % targetFilterOptions.length : 0))
  }, [targetFilterOptions.length])

  const cycleRarityFilter = useCallback(() => {
    setRarityFilterIndex((idx) => (rarityFilterOptions.length ? (idx + 1) % rarityFilterOptions.length : 0))
  }, [rarityFilterOptions.length])

  useEffect(() => {
    if (simpleCounters || !showModifierCards) {
      setModifierOverlayPinned(false)
    }
  }, [showModifierCards, simpleCounters])

  const filteredModCards = useMemo(() => {
    if (simpleCounters) return modCards
    return modCards.filter((card) => {
      if (activeCostFilter !== null && card.cost !== activeCostFilter) return false
      if (activeTargetFilter && (card.target?.toLowerCase() ?? '') !== activeTargetFilter) return false
      if (activeRarityFilter && (card.rarity?.toLowerCase() ?? '') !== activeRarityFilter) return false
      return true
    })
  }, [activeCostFilter, activeRarityFilter, activeTargetFilter, modCards, simpleCounters])

  const cardLookup = useMemo(() => {
    const all: Card[] = [...baseCards, ...modCards, ...actionCards, ...reactionCards]
    if (nullCard) all.push(nullCard)
    return new Map(all.map((c) => [c.id, c]))
  }, [baseCards, modCards, actionCards, reactionCards, nullCard])
  const cardCosts = useMemo(() => {
    return Array.from(cardLookup.values()).reduce<Record<string, number>>((acc, c) => {
      acc[c.id] = c.cost ?? 0
      return acc
    }, {})
  }, [cardLookup])
  const baseIdSet = useMemo(() => new Set(baseCards.map((c) => c.id)), [baseCards])
  const modIdSet = useMemo(() => new Set(modCards.map((c) => c.id)), [modCards])
  const nullId = nullCard?.id ?? null

  const getCard = useCallback(
    (id: string) => cardLookup.get(id) ?? Handbook.getAllCards().find((c) => c.id === id),
    [cardLookup]
  )

  const deckSummary = useMemo(() => {
    const deckIds = builderState.deck ?? []
    const counts: Record<string, number> = {}
    deckIds.forEach((id) => {
      counts[id] = (counts[id] ?? 0) + 1
    })
    return Object.entries(counts)
      .map(([id, count]) => ({ id, count, name: getCard(id)?.name ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [builderState.deck, getCard])

  const deckCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    ;(builderState.deck ?? []).forEach((id) => {
      counts[id] = (counts[id] ?? 0) + 1
    })
    return counts
  }, [builderState.deck])

  const pendingDeckCounts = useMemo(() => {
    return pendingDeckPlay.reduce<Record<string, number>>((acc, id) => {
      acc[id] = (acc[id] ?? 0) + 1
      return acc
    }, {})
  }, [pendingDeckPlay])

  const overlayHasPending = pendingDeckPlay.length > 0
  const overlayBaseId = overlayHasPending ? pendingDeckPlay[0] : null
  const overlayModCounts = useMemo(() => {
    if (!overlayHasPending) return {}
    return (activePlay?.mods ?? []).reduce<Record<string, number>>((acc, id) => {
      acc[id] = (acc[id] ?? 0) + 1
      return acc
    }, {})
  }, [activePlay?.mods, overlayHasPending])

  const activePlayCost = useMemo(() => {
    if (!activePlay) return 0
    return (activePlay.mods ?? []).reduce((sum, id) => sum + (cardCosts[id] ?? 0), 0)
  }, [activePlay, cardCosts])

  const shuffleDeck = () => {
    if (hasShuffledDeck) {
      const confirmed = window.confirm('Commit a Hard Shuffle? This will randomize the remaining cards.')
      if (!confirmed) return
    }
    setBuilderState((prev) => {
      const currentDeck = prev.deck ?? []
      const nextDeck = currentDeck.length ? shuffleInPlace([...currentDeck]) : currentDeck
      return {
        ...prev,
        deck: nextDeck,
        hasShuffledDeck: true,
      }
    })
    setDeckSeed((s) => s + 1)
    setHasShuffledDeck(true)
    setOpsError(null)
    setShuffledRecently(true)
  }

  // Draw a single card to hand (only allowed when deck is locked)
  const draw = () => {
    let drewCard = false
    let depleted = false
    setBuilderState((prev) => {
      if (!prev.isLocked) return prev
      if ((prev.hand ?? []).length >= (prev.handLimit ?? DEFAULT_HAND_LIMIT)) return prev
      const deck = [...(prev.deck ?? [])]
      const hand = [...(prev.hand ?? [])]
      const discard = [...(prev.discard ?? [])]
      if (deck.length === 0) {
        depleted = true
        return prev
      }
      const cardId = deck.pop()
      if (!cardId) {
        depleted = true
        return prev
      }
      hand.push({ id: cardId, state: 'unspent' })
      drewCard = true
      return { ...prev, deck, hand, discard }
    })
    if (drewCard) {
      setDeckSeed((s) => s + 1)
      setOpsError(null)
    } else if (depleted) {
      setOpsError('Deck depleted. Refill or rebuild to continue drawing.')
    }
  }

  const returnDiscardToDeck = (shuffle = true, toTop = true) => {
    setBuilderState((prev) => {
      const deck = [...(prev.deck ?? [])]
      const discard = [...(prev.discard ?? [])]
      // when returning discard to deck for FIFO, push them to the end (bottom) after shuffling
      const ids = discard.map((d) => d.id)
      if (shuffle) shuffleInPlace(ids)
      // For LIFO model: 'top' is the end of the array
      if (toTop) deck.push(...ids)
      else deck.unshift(...ids)
      if (shuffle) shuffleInPlace(deck)
      return { ...prev, deck, discard: [] }
    })
    setDeckSeed((s) => s + 1)
  }

  const resetDeck = () => {
    const newDeck = buildDeckArray(builderState.baseCounts, builderState.modCounts, builderState.nullCount, nullCard?.id, [builderState.actionCounts ?? {}, builderState.reactionCounts ?? {}])
    setBuilderState((prev) => ({ ...prev, deck: shuffleInPlace(newDeck), hand: [], discard: [], hasBuiltDeck: true, hasShuffledDeck: true }))
    setDeckSeed((s) => s + 1)
    setHasBuiltDeck(true)
    setHasShuffledDeck(true)
    setOpsError(null)
  }

  // Toggle compact view already exists; ensure HUD page can be navigated
  const needsLock = !builderState.isLocked
  const needsBuild = builderState.isLocked && !hasBuiltDeck
  const needsShuffle = builderState.isLocked && hasBuiltDeck && !hasShuffledDeck

  const handleDraw = () => {
    if (needsLock) {
      setOpsError('Lock the deck before drawing.')
      return
    }
    if (needsBuild) {
      setOpsError('Build the deck before drawing.')
      return
    }
    if (needsShuffle) {
      setOpsError('Shuffle the deck before drawing.')
      return
    }
    draw()
  }

  // Play a specific card from the deck via the overlay; mirrors hand rules (base then attach), but resolves to discard on finalize
  const playSpecificCard = (cardId: string) => {
    if (needsLock) {
      setOpsError('Lock the deck before playing a card.')
      return
    }
    if (needsBuild) {
      setOpsError('Build the deck before playing a card.')
      return
    }
    if (needsShuffle) {
      setOpsError('Shuffle the deck before playing a card.')
      return
    }

    const card = getCard(cardId)
    if (!card) return
    if (nullId && card.id === nullId) {
      setOpsError('Null cards can only be discarded.')
      return
    }
    const isMod = modIdSet.has(card.id)
    if (isMod && !activePlay?.baseId) {
      setOpsError('Select a base before attaching modifiers.')
      return
    }

    const available = (deckCounts[cardId] ?? 0) - (pendingDeckCounts[cardId] ?? 0)
    if (available <= 0) {
      setOpsError('No copies of that card are available in the deck.')
      return
    }

    const handCountsFromPending = [...pendingDeckPlay, cardId].reduce<Record<string, number>>((acc, id) => {
      acc[id] = (acc[id] ?? 0) + 1
      return acc
    }, {})

    if (isMod) {
      if (!activePlay?.baseId) {
        setOpsError('Select a base before attaching modifiers.')
        return
      }
      setActivePlay((prev) => toggleAttach(prev, cardId, handCountsFromPending, cardCosts, builderState.modifierCapacity))
      setPendingDeckPlay((prev) => [...prev, cardId])
      setOpsError(null)
      return
    }

    // Selecting a base from the deck overlay starts a fresh play selection scoped to the overlay
    setActivePlay({ baseId: cardId, baseHandIndex: -1, mods: [], modIndices: [] })
    setPendingDeckPlay([cardId])
    setOpsError(null)
  }

  // Lock / Unlock the deck (save)
  const toggleLockDeck = () => {
    setBuilderState((prev) => {
      const nextLocked = !prev.isLocked
      if (nextLocked) {
        const built = shuffleInPlace(buildDeckArray(prev.baseCounts, prev.modCounts, prev.nullCount, nullCard?.id, [prev.actionCounts ?? {}, prev.reactionCounts ?? {}]))
        setHasBuiltDeck(true)
        setHasShuffledDeck(false)
        setOpsError('Shuffle the deck before drawing.')
        return { ...prev, isLocked: nextLocked, deck: built, hand: [], discard: [], hasBuiltDeck: true, hasShuffledDeck: false }
      }
      setHasBuiltDeck(false)
      setHasShuffledDeck(false)
      setOpsError(null)
      return { ...prev, isLocked: nextLocked, hasBuiltDeck: false, hasShuffledDeck: false }
    })
    setDeckSeed((s) => s + 1)
  }

  const loadSavedDeck = (name: string) => {
    setBuilderState((prev) => {
      const sd = prev.savedDecks?.[name]
      if (!sd) return prev
      return {
        ...prev,
        deck: [...sd.deck],
        baseCounts: { ...sd.baseCounts },
        modCounts: { ...sd.modCounts },
        nullCount: sd.nullCount,
        modifierCapacity: sd.modifierCapacity,
        deckName: sd.name,
        isLocked: false,
        hand: [],
        discard: [],
        hasBuiltDeck: false,
        hasShuffledDeck: false,
      }
    })
    setHasBuiltDeck(false)
    setHasShuffledDeck(false)
    setOpsError(null)
  }

  const deleteSavedDeck = (name: string) => {
    setBuilderState((prev) => {
      if (!prev.savedDecks) return prev
      const copy = { ...prev.savedDecks }
      delete copy[name]
      return { ...prev, savedDecks: copy }
    })
  }

  // drawSize removed - we only allow Draw 1

  const adjustBaseCount = (cardId: string, delta: number) => {
    setBuilderState((prev) => {
      const current = prev.baseCounts[cardId] ?? 0
      const next = clamp(current + delta, 0)
      const prevTotal = sumCounts(prev.baseCounts)
      const newTotal = prevTotal - current + next
      if (!simpleCounters && newTotal > baseTarget) return prev
      return {
        ...prev,
        baseCounts: { ...prev.baseCounts, [cardId]: next },
      }
    })
  }

  const adjustPrimaryBaseCount = (delta: number) => {
    if (!primaryBaseId) return
    adjustBaseCount(primaryBaseId, delta)
  }

  // tap-to-add and long-press/right-click to remove (base cards)
  const longPressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    longPressFired.current = false
  }

  const handleBaseIncrement = (cardId: string) => {
    if (builderState.isLocked) return
    adjustBaseCount(cardId, 1)
  }

  const handleBaseContext = (cardId: string) => {
    if (builderState.isLocked) return
    adjustBaseCount(cardId, -1)
  }

  const adjustModCount = (cardId: string, delta: number) => {
    setBuilderState((prev) => {
      if (prev.isLocked) return prev
      // use snapshot helper to determine if we can add this mod
      if (delta > 0 && !canAddModCardSnapshot(prev, cardId)) return prev

      return {
        ...prev,
        modCounts: {
          ...prev.modCounts,
          [cardId]: clamp((prev.modCounts[cardId] ?? 0) + delta, 0),
        },
      }
    })
  }

  const adjustPrimaryModCount = (delta: number) => {
    if (!primaryModId) return
    adjustModCount(primaryModId, delta)
  }

  const adjustActionCount = (cardId: string, delta: number) => {
    setBuilderState((prev) => {
      if (prev.isLocked) return prev
      return {
        ...prev,
        actionCounts: {
          ...(prev.actionCounts ?? {}),
          [cardId]: clamp((prev.actionCounts?.[cardId] ?? 0) + delta, 0),
        },
      }
    })
  }

  const adjustPrimaryActionCount = (delta: number) => {
    if (!primaryActionId) return
    adjustActionCount(primaryActionId, delta)
  }

  const adjustReactionCount = (cardId: string, delta: number) => {
    setBuilderState((prev) => {
      if (prev.isLocked) return prev
      return {
        ...prev,
        reactionCounts: {
          ...(prev.reactionCounts ?? {}),
          [cardId]: clamp((prev.reactionCounts?.[cardId] ?? 0) + delta, 0),
        },
      }
    })
  }

  const adjustPrimaryReactionCount = (delta: number) => {
    if (!primaryReactionId) return
    adjustReactionCount(primaryReactionId, delta)
  }

  const handleModIncrement = (cardId: string) => {
    if (builderState.isLocked) return
    adjustModCount(cardId, 1)
  }

  const handleModContext = (cardId: string) => {
    if (builderState.isLocked) return
    adjustModCount(cardId, -1)
  }

  const adjustNullCount = (delta: number) => {
    setBuilderState((prev) => ({
      ...prev,
      nullCount: clamp(prev.nullCount + delta, minNulls),
    }))
  }

  const adjustModifierCapacity = (delta: number) => {
    setBuilderState((prev) => ({
      ...prev,
      modifierCapacity: Math.max((prev.modifierCapacity ?? 0) + delta, 0),
    }))
  }

  const resetBuilder = () => {
    setBuilderState(applyInitialCounts(defaultState(baseCards, modCards, minNulls, modifierCapacityDefault)))
    setCostFilterIndex(0)
    setTargetFilterIndex(0)
    setRarityFilterIndex(0)
    setHasBuiltDeck(false)
    setHasShuffledDeck(false)
    setOpsError(null)
  }

  // Moves a discard item back to the top of the deck
  const returnDiscardItemToDeck = (idx: number) => {
    setBuilderState((prev) => {
      const d = [...(prev.discard ?? [])]
      const it = d.splice(idx, 1)[0]
      const deck = [...(prev.deck ?? [])]
      deck.push(it.id)
      return { ...prev, discard: d, deck }
    })
  }

  // Moves exactly one discard card of a given id back to the deck (top)
  function returnDiscardGroupToDeck(cardId: string) {
    setBuilderState((prev) => {
      const deck = [...(prev.deck ?? [])]
      const discard = [...(prev.discard ?? [])]
      const idx = discard.findIndex((d) => d.id === cardId)
      if (idx === -1) return prev
      const it = discard.splice(idx, 1)[0]
      deck.push(it.id)
      return { ...prev, discard, deck }
    })
  }

  // Moves a discard item back to the hand (unspent)
  function returnDiscardItemToHand(idx: number) {
    setBuilderState((prev) => {
      const handLimit = prev.handLimit ?? DEFAULT_HAND_LIMIT
      if ((prev.hand ?? []).length >= handLimit) {
        // prevent returns that would exceed hand limit
        return prev
      }
      const d = [...(prev.discard ?? [])]
      const it = d.splice(idx, 1)[0]
      return { ...prev, discard: d, hand: [...(prev.hand ?? []), { id: it.id, state: 'unspent' }] }
    })
  }

  function returnDiscardGroupToHand(cardId: string) {
    setBuilderState((prev) => {
      const handLimit = prev.handLimit ?? DEFAULT_HAND_LIMIT
      const space = Math.max(0, handLimit - (prev.hand ?? []).length)
      if (space <= 0) return prev
      const discard = [...(prev.discard ?? [])]
      const moved: { id: string; origin: 'played' | 'discarded' }[] = []
      for (let i = discard.length - 1; i >= 0 && moved.length < space; i--) {
        if (discard[i].id === cardId) {
          moved.push(discard.splice(i, 1)[0])
          break
        }
      }
      if (moved.length === 0) return prev
      const newHand = [...(prev.hand ?? []), ...(moved.map((m) => ({ id: m.id, state: 'unspent' })) as { id: string; state: 'unspent' | 'played' }[])]
      return { ...prev, discard, hand: newHand }
    })
  }

  const groupedDiscardElements = useMemo(() => {
    const groups = (builderState.discard ?? []).reduce((acc: Record<string, {count:number, idxs:number[]}>, d, i) => {
      const g = acc[d.id] ?? {count:0, idxs:[]}
      g.count++
      g.idxs.push(i)
      acc[d.id] = g
      return acc
    }, {} as Record<string, {count:number, idxs:number[]}>)
    return Object.entries(groups).map(([id,g]) => {
      const card = getCard(id)
      return (
        <div key={id} className="discard-row">
          <div className="discard-name">{card?.name ?? id}</div>
          <div className="discard-actions">
            <span className="discard-count">x{g.count}</span>
            <button className="counter-btn" onClick={()=>returnDiscardGroupToDeck(id)}>Deck</button>
            <button
              className="counter-btn"
              onClick={()=>returnDiscardGroupToHand(id)}
              disabled={(builderState.hand ?? []).length >= (builderState.handLimit ?? DEFAULT_HAND_LIMIT)}
            >
              Hand
            </button>
          </div>
        </div>
      )
    })
  }, [builderState.discard, builderState.hand, builderState.handLimit, getCard, returnDiscardGroupToDeck, returnDiscardGroupToHand])

  const groupedHandStacks = useMemo(() => {
    const handList = builderState.hand ?? []
    const idOccurrenceCount: Record<string, number> = {}
    return handList.map((entry, index) => {
      const id = entry.id
      idOccurrenceCount[id] = (idOccurrenceCount[id] ?? 0) + 1
      const thisOccurrence = idOccurrenceCount[id]
      const card = getCard(id)
      const typeLabel = card?.type ?? 'Base'
      const isBase = typeLabel.toLowerCase() === 'base'
      const isNull = (card?.type ?? '').toLowerCase() === 'null'
      const modsCount = activePlay?.mods?.filter((m) => m === id).length ?? 0
      const isQueuedModifier = !isBase && !isNull && (activePlay?.modIndices?.includes(index) ?? false)
      const showAttachWarning = !isBase && attachWarningId === id
      const isSelectedBase = isBase && activePlay?.baseHandIndex === index
      const highlight = isSelectedBase
        ? 'Selected Base'
        : (isQueuedModifier ? 'Queued' : null)
      const canPlayBase = isBase && !activePlay
      const canAttach = !isBase && !!activePlay
      let modText: string | null = null
      let modTarget: string | null = null
      const details = card?.details ?? []
      if (!isBase && card?.text) {
        const m = card.text.match(/^(.*?)(?:\s*[•·]\s*|\s+)Target:\s*(.*)$/i)
        if (m) {
          modText = m[1]?.trim() || null
          modTarget = m[2]?.trim() || null
        } else {
          modText = card.text
        }
      }
      const effectDetails = !isBase && !isNull ? details.filter((d: CardDetail) => d.label?.toLowerCase() === 'effect') : []
      const metaDetails = !isBase && !isNull ? details.filter((d: CardDetail) => d.label?.toLowerCase() !== 'effect') : []

      const cardStyle: React.CSSProperties = {
        zIndex: 100 - index,
        flex: '0 0 215px',
        minWidth: 185,
        maxWidth: 226,
        scrollSnapAlign: 'start',
      }
      const typeClass = isBase ? 'base-type' : isNull ? 'null-type' : 'mod-type'

      return (
        <div key={`${id}-${index}`} className={`hand-card ${typeClass}`} style={cardStyle}>
          <div className="hand-content">
            <div className="hand-meta">
              <div>
                <div className="hand-title">{card?.name ?? id}</div>
                <div className="hand-subtitle">
                  <span className="hand-type">{typeLabel}</span>
                  {highlight && <span className="hand-pill accent">{highlight}</span>}
                </div>
              </div>
            </div>
            {!isBase && !isNull && (
              <div className="text-body card-text hand-text">
                {showCardDetails ? (
                  <>
                    {effectDetails.length > 0 && (
                      <div className="effect-block">
                        {effectDetails.map((detail: CardDetail) => (
                          <div key={`${card?.id ?? id}-effect-${detail.label}`} className="effect-line">
                            {detail.value}
                          </div>
                        ))}
                      </div>
                    )}
                    {metaDetails.length > 0 && (
                      <dl className="meta-block">
                        {metaDetails.map((detail: CardDetail) => (
                          <React.Fragment key={`${card?.id ?? id}-meta-${detail.label}`}>
                            <dt>{detail.label}</dt>
                            <dd>{detail.value}</dd>
                          </React.Fragment>
                        ))}
                      </dl>
                    )}
                  </>
                ) : (
                  <>
                    <div className="effect-block">
                      {modText && <div className="effect-line">{modText}</div>}
                      {!modText && card?.text && <div className="effect-line">{card.text}</div>}
                    </div>
                    <div className="meta-block">
                      {modTarget && <div className="target-line">Target: {modTarget}</div>}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="hand-actions" style={{ justifyContent: isNull ? 'flex-end' : undefined }}>
            {isNull ? null : independentPlay ? (
              <button onClick={() => playCardIndependently(id)}>Play {card?.name ?? id}</button>
            ) : isBase ? (
              <button onClick={() => startPlayBase(id, index)} disabled={!canPlayBase}>Play Base</button>
            ) : (
              isQueuedModifier
                ? <button onClick={() => detachModifier(index)}>Remove</button>
                : <button onClick={() => attachModifier(id, index)} disabled={!canAttach}>Attach</button>
            )}
            <button onClick={() => discardGroupFromHand(id, false, 'discarded')}>Discard</button>
          </div>
          {showAttachWarning && (
            <div className="hand-warning-overlay" role="status">
              <div className="hand-warning-text">Select a base before attaching modifiers.</div>
              <button className="hand-warning-dismiss" onClick={() => setAttachWarningId(null)} aria-label="Dismiss warning">Got it</button>
            </div>
          )}
        </div>
      )
    })
  }, [activePlay, builderState.hand, getCard, renderDetails, showCardDetails, independentPlay])

  const handGhostCard = (
    <div key="hand-ghost" className="hand-card ghost-hand-card" aria-hidden="true">
      <div className="hand-content">
        <div className="hand-meta">
          <div>
            <div className="hand-title">Deck Ready</div>
            <div className="hand-subtitle">
              <span className="hand-type">Awaiting Draw</span>
            </div>
          </div>
        </div>
        <div className="text-body card-text hand-text" style={{ opacity: 0.65 }}>
          Draw to populate your hand.
        </div>
      </div>
    </div>
  )

  const handDisplayCards = groupedHandStacks.length > 0 ? groupedHandStacks : [handGhostCard]

  // Move grouped items from hand to discard (single or all)
  function discardGroupFromHand(cardId: string, all = false, origin: 'played' | 'discarded' = 'discarded') {
    setBuilderState((prev) => {
      const hand = [...(prev.hand ?? [])]
      const removed: { id: string; state: 'unspent' | 'played' }[] = []
      if (all) {
        for (let i = hand.length - 1; i >= 0; i--) {
          if (hand[i].id === cardId) removed.push(hand.splice(i, 1)[0])
        }
      } else {
        const idx = hand.findIndex((h) => h.id === cardId)
        if (idx >= 0) removed.push(hand.splice(idx, 1)[0])
      }
      if (removed.length === 0) return prev
      const discard = [...(prev.discard ?? []), ...removed.map(r => ({ id: r.id, origin }))]
      return { ...prev, hand, discard }
    })
  }

  // Plays a single card independently (GM mode): no base/attach requirement, just
  // moves straight from hand to discard marked as "played".
  function playCardIndependently(cardId: string) {
    discardGroupFromHand(cardId, false, 'played')
  }

  // Play flow handlers (use pure helpers)
  function startPlayBase(cardId: string, handIndex: number) {
    if (nullId && cardId === nullId) {
      setOpsError('Null cards can only be discarded.')
      return
    }
    if (modIdSet.has(cardId)) {
      setOpsError('Select a base before playing modifiers.')
      return
    }
    setOpsError(null)
    setAttachWarningId(null)
    setActivePlay((prev) => startPlaySelection(prev, cardId, handIndex))
  }

  function attachModifier(cardId: string, handIndex: number) {
    if (nullId && cardId === nullId) {
      setOpsError('Null cards can only be discarded.')
      return
    }
    if (!activePlay?.baseId) {
      setOpsError('Select a base before attaching modifiers.')
      setAttachWarningId(cardId)
      return
    }
    if (!modIdSet.has(cardId)) return
    const handCounts = (builderState.hand ?? []).reduce<Record<string, number>>((acc, it) => {
      acc[it.id] = (acc[it.id] ?? 0) + 1
      return acc
    }, {})
    const alreadyAttached = activePlay.mods.filter((m) => m === cardId).length
    if ((handCounts[cardId] ?? 0) - alreadyAttached <= 0) return
    const cardCosts = Array.from(cardLookup.values()).reduce<Record<string, number>>((acc, c) => { acc[c.id] = c.cost ?? 0; return acc }, {})
    const currentCost = activePlay.mods.reduce((s, m) => s + (cardCosts[m] ?? 0), 0)
    if (currentCost + (cardCosts[cardId] ?? 0) > builderState.modifierCapacity) {
      setOpsError('Adding this card would exceed modifier capacity.')
      return
    }
    setOpsError(null)
    setAttachWarningId(null)
    setActivePlay((prev) => prev ? { ...prev, mods: [...prev.mods, cardId], modIndices: [...prev.modIndices, handIndex] } : prev)
  }

  function detachModifier(handIndex: number) {
    setActivePlay((prev) => {
      if (!prev) return prev
      const pos = prev.modIndices.lastIndexOf(handIndex)
      if (pos === -1) return prev
      const mods = [...prev.mods]
      const modIndices = [...prev.modIndices]
      mods.splice(pos, 1)
      modIndices.splice(pos, 1)
      return { ...prev, mods, modIndices }
    })
  }

  function finalizePlay() {
    // If the selection originated from the deck overlay, move pending cards to discard
    if (pendingDeckPlay.length > 0) {
      const sel = finalizeSelection(activePlay)
      if (!sel) return
      setBuilderState((prev) => {
        const deck = [...(prev.deck ?? [])]
        // remove one instance per pending id
        pendingDeckPlay.forEach((id) => {
          const idx = deck.findIndex((c) => c === id)
          if (idx !== -1) deck.splice(idx, 1)
        })
        const discard = [...(prev.discard ?? []), ...pendingDeckPlay.map((id) => ({ id, origin: 'played' as const }))]
        return { ...prev, deck, discard }
      })
      setPendingDeckPlay([])
      setActivePlay(null)
      setDeckSeed((s) => s + 1)
      return
    }

    // Hand-origin flow
    const sel = finalizeSelection(activePlay)
    if (!sel) return
    discardGroupFromHand(sel.baseId, false, 'played')
    sel.mods.forEach((m) => discardGroupFromHand(m, false, 'played'))
    setActivePlay(null)
  }

  function cancelPlay() {
    if (pendingDeckPlay.length > 0) {
      setPendingDeckPlay([])
    }
    setActivePlay(cancelSelection(activePlay))
  }


  function renderDetails(card: Card) {
    if (!showCardDetails) return null
    if (!card.details || card.details.length === 0) return null
    return (
      <dl className="card-details text-body" style={{marginTop:15,marginBottom:0,width:'100%'}}>
        {card.details.map((detail) => (
          <React.Fragment key={`${card.id}-${detail.label}`}>
            <dt style={{fontWeight:600}}>{detail.label}</dt>
            <dd style={{margin:0}}>{detail.value}</dd>
          </React.Fragment>
        ))}
      </dl>
    )
  }

  const handFanStyle: React.CSSProperties = {
    marginTop: 10,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    width: 'calc(100vw + (var(--hand-bleed, 40px) * 2))',
    minWidth: 'calc(100vw + (var(--hand-bleed, 40px) * 2))',
    marginLeft: 'calc(-1 * var(--hand-bleed, 40px))',
    marginRight: 'calc(-1 * var(--hand-bleed, 40px))',
    boxSizing: 'border-box',
    padding: 'var(--hand-pad-block-start, 12px) calc(var(--hand-pad-inline, 22px) + var(--hand-bleed, 40px)) var(--hand-pad-block-end, 18px)',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    scrollPaddingInline: 'calc(var(--hand-pad-inline, 22px) + var(--hand-bleed, 40px) + 8px)',
    WebkitOverflowScrolling: 'touch',
  }

  const skillGridClass = `card-grid base-card-grid skill-grid${showBuilderSections ? ' deck-builder-skill-grid' : ''}`
  const modifierOverlayVisible = !simpleCounters && showModifierCards && (modifierOverlayPinned || modifierOverlayInView)
  const toggleModifierHelper = useCallback(() => {
    setModifierOverlayPinned((prev) => !prev)
  }, [])

  return (
    <>
    {!simpleCounters && showModifierCards && (
      <div
        className={`mod-overlay ${modifierOverlayVisible ? 'is-visible' : ''} ${modifierOverlayPinned ? 'is-pinned' : ''}`}
        data-mode={modifierOverlayPinned ? 'pinned' : 'peek'}
        role="status"
        aria-live="polite"
      >
        <div className="mod-overlay-label">{modOverlayLabel}</div>
        <div className="mod-overlay-value">{modCapacityRemaining}</div>
        <div className="mod-overlay-meta">Used {modCapacityUsed} / {modCapacityTotal}</div>
      </div>
    )}
    <main className="app-shell">

      {showBuilderSections && (
        <div className="page">
          <div className="page-header" style={{ alignItems: 'center', justifyContent: 'space-between', textAlign: 'center' }}>
            <div style={{ flex: '1 1 auto' }}>
              <h1>Engram Deck Builder</h1>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <ImportExportJSON filenamePrefix={exportPrefix} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
              {lockPill}
              <button onClick={() => toggleLockDeck()}>
                {builderState.isLocked ? 'Unlock Deck' : 'Lock Deck'}
              </button>
            </div>
          </div>
          <section className="summary-stack">
            <div>
              <div className="muted text-body">Base Cards</div>
              {showBaseCounters && <div className="stat-large">{simpleCounters ? baseTotal : `${baseTotal} / ${baseTarget}`}</div>}
              {showBaseAdjusters && (
                <div className="counter-inline" role="group" aria-label="Adjust base cards" style={{ marginTop: 8 }}>
                  <button className="counter-btn" onClick={() => adjustPrimaryBaseCount(-1)} disabled={builderState.isLocked}>-</button>
                  <div className="counter-value counter-pill">{primaryBaseId ? (builderState.baseCounts[primaryBaseId] ?? 0) : baseTotal}</div>
                  <button className="counter-btn" onClick={() => adjustPrimaryBaseCount(1)} disabled={builderState.isLocked || (!simpleCounters && baseTotal >= baseTarget)}>+</button>
                </div>
              )}
            </div>

            <div>
              <div className="muted text-body">Null Cards</div>
              <div className="counter-inline" role="group" aria-label="Adjust null cards" style={{ marginTop: 4, justifyContent: 'center' }}>
                <button className="counter-btn" onClick={() => adjustNullCount(-1)} disabled={builderState.nullCount <= minNulls || builderState.isLocked}>-</button>
                <div className="counter-value counter-pill">{builderState.nullCount}</div>
                <button className="counter-btn" onClick={() => adjustNullCount(1)} disabled={builderState.isLocked}>+</button>
              </div>
              {!nullValid && <div className="status-warning text-body">Minimum of {minNulls} Nulls required.</div>}
            </div>
            {showModifierCapacity && (
              <div>
                <div className="muted text-body">Capacity</div>
                {chudCapacity !== null ? (
                  <div style={{ marginTop: 4, textAlign: 'center' }}>
                    <div className="counter-value counter-pill">{builderState.modifierCapacity}</div>
                    <div className="muted text-body" style={{ marginTop: 4, fontSize: '0.75em' }}>Synced from HUD</div>
                  </div>
                ) : (
                  <div className="counter-inline" role="group" aria-label="Adjust capacity" style={{ marginTop: 4, justifyContent: 'center' }}>
                    <button className="counter-btn" onClick={() => adjustModifierCapacity(-1)}>-</button>
                    <div className="counter-value counter-pill">{builderState.modifierCapacity}</div>
                    <button className="counter-btn" onClick={() => adjustModifierCapacity(1)}>+</button>
                  </div>
                )}
              </div>
            )}
            {showModifierCards && showModifierCardCounter && (
              <div>
                <div className="muted text-body">Modifier Cards</div>
                <div className="stat-large">
                  {simpleCounters && modCapacityAsCount ? modCapacityUsed : `${modCapacityUsed} / ${builderState.modifierCapacity}`}
                </div>
                <div className="counter-inline" role="group" aria-label="Adjust modifier cards" style={{ marginTop: 8 }}>
                  <button className="counter-btn" onClick={() => adjustPrimaryModCount(-1)} disabled={builderState.isLocked}>-</button>
                  <div className="counter-value counter-pill">{primaryModId ? (builderState.modCounts[primaryModId] ?? 0) : modCapacityUsed}</div>
                  <button className="counter-btn" onClick={() => adjustPrimaryModCount(1)} disabled={builderState.isLocked || (!simpleCounters && !canAddModCard(primaryModId ?? ''))}>+</button>
                </div>
                <div className="muted text-body" style={{ marginTop: 6 }}>
                  {simpleCounters && modCapacityAsCount ? 'Mod Cards' : 'Mod Cards Used'}
                </div>
                {!modValid && <div className="status-error text-body">Reduce modifier cards or raise capacity.</div>}
              </div>
            )}
            {showActionReactionCards && primaryActionId && (
              <div>
                <div className="muted text-body">Action Cards</div>
                <div className="stat-large">{builderState.actionCounts?.[primaryActionId] ?? 0}</div>
                <div className="counter-inline" role="group" aria-label="Adjust action cards" style={{ marginTop: 8 }}>
                  <button className="counter-btn" onClick={() => adjustPrimaryActionCount(-1)} disabled={builderState.isLocked}>-</button>
                  <div className="counter-value counter-pill">{builderState.actionCounts?.[primaryActionId] ?? 0}</div>
                  <button className="counter-btn" onClick={() => adjustPrimaryActionCount(1)} disabled={builderState.isLocked}>+</button>
                </div>
              </div>
            )}
            {showActionReactionCards && primaryReactionId && (
              <div>
                <div className="muted text-body">Reaction Cards</div>
                <div className="stat-large">{builderState.reactionCounts?.[primaryReactionId] ?? 0}</div>
                <div className="counter-inline" role="group" aria-label="Adjust reaction cards" style={{ marginTop: 8 }}>
                  <button className="counter-btn" onClick={() => adjustPrimaryReactionCount(-1)} disabled={builderState.isLocked}>-</button>
                  <div className="counter-value counter-pill">{builderState.reactionCounts?.[primaryReactionId] ?? 0}</div>
                  <button className="counter-btn" onClick={() => adjustPrimaryReactionCount(1)} disabled={builderState.isLocked}>+</button>
                </div>
              </div>
            )}
            <div>
              <div className="muted text-body">Deck Status</div>
              <div className={`stat-large ${deckIsValid ? 'status-success' : 'status-error'}`}>{deckIsValid ? 'Ready' : 'Needs Attention'}</div>
              <button onClick={resetBuilder} style={{ marginTop: 8 }}>Reset Builder</button>
            </div>
          </section>

          {!simpleCounters && (
            <>
              <BaseCardGrid
                baseCards={baseCards}
                baseTarget={baseTarget}
                baseCounts={builderState.baseCounts}
                activeBaseId={activePlay?.baseId ?? null}
                isLocked={!!builderState.isLocked}
                skillGridClass={skillGridClass}
                longPressTimer={longPressTimer}
                longPressFired={longPressFired}
                onIncrement={handleBaseIncrement}
                onContext={handleBaseContext}
              />

              {showModifierCards && (
                <ModifierCardGrid
                  sectionRef={modifierSectionRef}
                  modifierOverlayPinned={modifierOverlayPinned}
                  onToggleModifierHelper={toggleModifierHelper}
                  modCapacityRemaining={modCapacityRemaining}
                  activeCostFilter={activeCostFilter}
                  costFilterLabel={costFilterLabel}
                  onCycleCostFilter={cycleCostFilter}
                  activeTargetFilter={activeTargetFilter}
                  targetFilterLabel={targetFilterLabel}
                  onCycleTargetFilter={cycleTargetFilter}
                  activeRarityFilter={activeRarityFilter}
                  rarityFilterLabel={rarityFilterLabel}
                  onCycleRarityFilter={cycleRarityFilter}
                  filteredModCards={filteredModCards}
                  modCounts={builderState.modCounts}
                  activeMods={activePlay?.mods}
                  canAddModCard={canAddModCard}
                  isLocked={!!builderState.isLocked}
                  modLongPressTimer={modLongPressTimer}
                  modLongPressFired={modLongPressFired}
                  onIncrement={handleModIncrement}
                  onContext={handleModContext}
                  showCardDetails={showCardDetails}
                  renderDetails={renderDetails}
                />
              )}
            </>
          )}
        </div>
      )}

      {showOpsSections && (
        <div className="page">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <HandCarousel
              handListRef={handListRef}
              handFanStyle={handFanStyle}
              onScroll={updateHandNav}
              handDisplayCards={handDisplayCards}
              handIsEmpty={groupedHandStacks.length === 0}
              handNavState={handNavState}
              onScrollLeft={() => scrollHand(-1)}
              onScrollRight={() => scrollHand(1)}
              handCount={(builderState.hand ?? []).length}
              handLimit={builderState.handLimit ?? DEFAULT_HAND_LIMIT}
              activePlay={activePlay}
              pendingDeckPlayCount={pendingDeckPlay.length}
              cardLookup={cardLookup}
              onFinalizePlay={finalizePlay}
              onCancelPlay={cancelPlay}
            />

            {/* Deck Operations directly below the hand */}
            <DeckOpsPanel
              drawHealthVariant={drawHealthVariant}
              onDraw={handleDraw}
              handAtLimit={(builderState.hand ?? []).length >= (builderState.handLimit ?? DEFAULT_HAND_LIMIT)}
              drawHealthLabel={drawHealthLabel}
              drawHealthPercent={drawHealthPercent}
              isLocked={!!builderState.isLocked}
              hasBuiltDeck={hasBuiltDeck}
              hasShuffledDeck={hasShuffledDeck}
              onShuffle={shuffleDeck}
              lockControlsInOps={lockControlsInOps}
              needsLock={needsLock}
              onToggleLock={toggleLockDeck}
              lockPill={lockPill}
              opsError={opsError}
              onViewDeck={() => setShowViewDeck(true)}
              chudDraw={chudDraw}
              handLimit={builderState.handLimit ?? DEFAULT_HAND_LIMIT}
              maxHandLimit={MAX_HAND_LIMIT}
              onHandLimitChange={(next) => {
                setBuilderState((prev) => ({
                  ...prev,
                  handLimit: Number.isNaN(next)
                    ? prev.handLimit ?? DEFAULT_HAND_LIMIT
                    : clamp(next, 0, MAX_HAND_LIMIT),
                }))
              }}
              cardsRemaining={cardsRemaining}
              shuffledRecently={shuffledRecently}
              onShuffleFlashEnd={() => setShuffledRecently(false)}
            />
          </div>

          <DiscardPile
            discardCount={(builderState.discard ?? []).length}
            groupedDiscardElements={groupedDiscardElements}
          />
        </div>
      )}

    </main>
      <ViewDeckModal
        show={showViewDeck}
        onClose={() => setShowViewDeck(false)}
        opsError={opsError}
        deckSummary={deckSummary}
        nullId={nullId}
        deckCounts={deckCounts}
        pendingDeckCounts={pendingDeckCounts}
        overlayHasPending={overlayHasPending}
        overlayBaseId={overlayBaseId}
        overlayModCounts={overlayModCounts}
        onPlaySpecificCard={playSpecificCard}
        needsLock={needsLock}
        needsBuild={!!needsBuild}
        needsShuffle={!!needsShuffle}
        activePlay={activePlay}
        cardLookup={cardLookup}
        activePlayCost={activePlayCost}
        modifierCapacity={builderState.modifierCapacity}
        onFinalizePlay={finalizePlay}
        onCancelPlay={cancelPlay}
      />

    </>
  )
}
