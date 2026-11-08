// Engram catalog — the handbook's actual Engram table (Phase 8_Engrams),
// LVL/NAME/NOTE/EFFECT, transcribed from the v10 rulebook. Engram names,
// status effects, and costs here are the source of truth for the Engram
// Manager; they are not the old card-game "mod cards" dataset.
import rawEngrams from './raw/engrams.json'

export type EngramCatalogEntry = {
  id: string
  name: string
  /** Capacity cost per copy equipped (handbook "LVL"). */
  level: number
  /** Handbook "Effect" column. */
  effect: string
  /** Handbook "Note" column (may be empty — some Engrams apply automatically, with no roll notation). */
  note: string
}

const normalize = (value?: string) => (value ? value.trim() : '')

export const engramCatalog: EngramCatalogEntry[] = rawEngrams.map((entry) => ({
  id: entry.id,
  name: entry.name,
  level: entry.level,
  effect: normalize(entry.effect),
  note: normalize(entry.note),
}))

export const engramCatalogById: Record<string, EngramCatalogEntry> = Object.fromEntries(
  engramCatalog.map((entry) => [entry.id, entry])
)

export default engramCatalog
