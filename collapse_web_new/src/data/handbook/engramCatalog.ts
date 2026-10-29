// Engram catalog — the handbook's Engram table (LVL, Name, Note, Effect).
// Sourced from the same raw data the old card-game deck builder used
// (`raw/modcards.json`): those "mod cards" are the handbook's Engrams, just
// reframed here as equippable, spell-slot-style abilities instead of drawn
// cards.
import rawEngrams from './raw/modcards.json'

export type EngramCatalogEntry = {
  id: string
  name: string
  /** Capacity cost per copy equipped (handbook "LVL"). */
  level: number
  /** Handbook "Effect" column. */
  effect: string
  /** Handbook "Note" column (may be empty). */
  note: string
  target?: string
  extraActions?: string
}

const normalize = (value?: string) => (value ? value.trim() : '')

export const engramCatalog: EngramCatalogEntry[] = rawEngrams.map((entry) => ({
  id: entry.id,
  name: entry.name,
  level: entry.cost,
  effect: normalize(entry.effect),
  note: normalize(entry.notes),
  target: normalize(entry.target) || undefined,
  extraActions: normalize(entry.extraActions) || undefined,
}))

export const engramCatalogById: Record<string, EngramCatalogEntry> = Object.fromEntries(
  engramCatalog.map((entry) => [entry.id, entry])
)

export default engramCatalog
