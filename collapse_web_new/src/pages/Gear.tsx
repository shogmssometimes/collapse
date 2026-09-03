import React, { useState, useMemo, useEffect, useRef } from 'react'
import { gear, GearItem, GearSlot, GearRarity } from '../data/handbook/gear'

const CHUD_STATE_KEY = 'chud.state.v1'
const GEAR_SLOTS_KEY = 'gear.slots.v1'
const MAX_INVENTORY_SLOTS = 18

function readChudInventorySlots(key: string = CHUD_STATE_KEY): number | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const s = JSON.parse(raw)
    return typeof s.inventorySlots === 'number' ? s.inventorySlots : null
  } catch { return null }
}

// --- Search backbone (not yet rendered) ---
function searchGear(query: string): GearItem[] {
  if (!query.trim()) return gear
  const q = query.toLowerCase()
  return gear.filter(
    item =>
      item.name.toLowerCase().includes(q) ||
      (item.description ?? '').toLowerCase().includes(q) ||
      item.slot.toLowerCase().includes(q) ||
      item.rarity.toLowerCase().includes(q),
  )
}

const GEAR_NAME_OPTIONS = gear.map(item => item.name)

function NameAutocompleteInput({
  value,
  onChange,
  onSelect,
  options,
  placeholder,
  style,
}: {
  value: string
  onChange: (value: string) => void
  onSelect?: (value: string) => void
  options: string[]
  placeholder?: string
  style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase()
    const list = q ? options.filter(name => name.toLowerCase().includes(q)) : options
    return list.slice(0, 8)
  }, [value, options])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const selectSuggestion = (name: string) => {
    onChange(name)
    onSelect?.(name)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!open || suggestions.length === 0) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, suggestions.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); selectSuggestion(suggestions[highlight]) }
          else if (e.key === 'Escape') { setOpen(false) }
        }}
        autoComplete="off"
        style={style ?? FIELD_STYLE}
      />
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 3,
            background: '#0d1117',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 8,
            maxHeight: 170,
            overflowY: 'auto',
            zIndex: 30,
            boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
          }}
        >
          {suggestions.map((name, i) => (
            <div
              key={name}
              onMouseDown={e => { e.preventDefault(); selectSuggestion(name) }}
              style={{
                padding: '8px 10px',
                fontSize: '0.72rem',
                color: '#e9f0ff',
                cursor: 'pointer',
                borderBottom: i === suggestions.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                background: i === highlight ? 'rgba(61,232,192,0.16)' : 'transparent',
              }}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Inventory slot data ---
export type SlotEntry = { name: string; units: string; qty: string }
export type EquippedItem = { itemId: string } | null

const EMPTY_ENTRY: SlotEntry = { name: '', units: '', qty: '' }

function loadGearEntries(key: string = GEAR_SLOTS_KEY): SlotEntry[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return Array.from({ length: MAX_INVENTORY_SLOTS }, () => ({ ...EMPTY_ENTRY }))
    const parsed = JSON.parse(raw)
    // support both legacy array format and new object format
    const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.entries) ? parsed.entries : null)
    if (!arr) return Array.from({ length: MAX_INVENTORY_SLOTS }, () => ({ ...EMPTY_ENTRY }))
    return Array.from({ length: MAX_INVENTORY_SLOTS }, (_, i) => {
      const e = arr[i]
      if (!e || typeof e !== 'object') return { ...EMPTY_ENTRY }
      return {
        name: typeof e.name === 'string' ? e.name : '',
        units: typeof e.units === 'string' ? e.units : '',
        qty: typeof e.qty === 'string' ? e.qty : '',
      }
    })
  } catch { return Array.from({ length: MAX_INVENTORY_SLOTS }, () => ({ ...EMPTY_ENTRY })) }
}

// --- Wardrobe ---
export type WardrobeEntry = { name: string; approach: string; quality: string }
const WARDROBE_KEY = 'wardrobe.v1'
const EMPTY_WARDROBE_ENTRY: WardrobeEntry = { name: '', approach: '', quality: '' }
const WARDROBE_ROW_COUNT = 4
function loadWardrobe(key: string = WARDROBE_KEY): WardrobeEntry[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return Array.from({ length: WARDROBE_ROW_COUNT }, () => ({ ...EMPTY_WARDROBE_ENTRY }))
    const p = JSON.parse(raw)
    if (Array.isArray(p)) {
      return Array.from({ length: WARDROBE_ROW_COUNT }, (_, i) => {
        const row = p[i]
        return {
          name: row && typeof row.name === 'string' ? row.name : '',
          approach: row && typeof row.approach === 'string' ? row.approach : '',
          quality: row && typeof row.quality === 'string' ? row.quality : '',
        }
      })
    }
    // legacy single-row format
    return [
      {
        name: typeof p.name === 'string' ? p.name : '',
        approach: typeof p.approach === 'string' ? p.approach : '',
        quality: typeof p.quality === 'string' ? p.quality : '',
      },
      ...Array.from({ length: WARDROBE_ROW_COUNT - 1 }, () => ({ ...EMPTY_WARDROBE_ENTRY })),
    ]
  } catch { return Array.from({ length: WARDROBE_ROW_COUNT }, () => ({ ...EMPTY_WARDROBE_ENTRY })) }
}

const FIELD_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 4,
  padding: '5px 8px',
  color: 'inherit',
  fontSize: '0.82rem',
  width: '100%',
  minWidth: 0,
  minHeight: 36,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  // Override global no-input CSS rules
  userSelect: 'text',
  WebkitUserSelect: 'text',
  touchAction: 'auto',
  caretColor: 'auto',
  pointerEvents: 'auto',
}

function SlotRow({ index, entry, onChange }: {
  index: number
  entry: SlotEntry
  onChange: (entry: SlotEntry) => void
}) {
  const [holdProgress, setHoldProgress] = useState(0) // 0–100
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const HOLD_MS = 2000

  const startHold = () => {
    const start = Date.now()
    holdInterval.current = setInterval(() => {
      const pct = Math.min(((Date.now() - start) / HOLD_MS) * 100, 100)
      setHoldProgress(pct)
    }, 30)
    holdTimer.current = setTimeout(() => {
      cancelHold()
      setHoldProgress(0)
      const current = parseFloat(entry.qty)
      if (!isNaN(current) && current > 0) {
        onChange({ ...entry, qty: String(current - 1) })
      }
    }, HOLD_MS)
  }

  const cancelHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null }
    if (holdInterval.current) { clearInterval(holdInterval.current); holdInterval.current = null }
    setHoldProgress(0)
  }

  const qtyNum = parseFloat(entry.qty)
  const canUse = !isNaN(qtyNum) && qtyNum > 0

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4rem 2rem 1fr 5rem 3.5rem',
        gap: '4px 8px',
        alignItems: 'center',
      }}
    >
      <span style={{ fontSize: '0.65rem', color: 'var(--muted)', textAlign: 'right', paddingRight: 2 }}>
        {index + 1}
      </span>
      {/* Use button with hold-progress ring */}
      <div
        style={{ position: 'relative', width: 28, height: 28, flexShrink: 0 }}
        onPointerDown={e => { if (canUse) { e.currentTarget.setPointerCapture(e.pointerId); startHold() } }}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={e => e.preventDefault()}
      >
        <svg
          viewBox="0 0 28 28"
          style={{
            position: 'absolute',
            inset: 0,
            width: 28,
            height: 28,
            transform: 'rotate(-90deg)',
            pointerEvents: 'none',
          }}
        >
          <circle
            cx="14" cy="14" r="11"
            fill="none"
            stroke={canUse ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}
            strokeWidth="2"
          />
          {holdProgress > 0 && (
            <circle
              cx="14" cy="14" r="11"
              fill="none"
              stroke="var(--accent, #0ff6ff)"
              strokeWidth="2"
              strokeDasharray={`${2 * Math.PI * 11}`}
              strokeDashoffset={`${2 * Math.PI * 11 * (1 - holdProgress / 100)}`}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.55rem',
            letterSpacing: '0.04em',
            fontFamily: 'var(--font-display)',
            color: canUse ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.2)',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            cursor: canUse ? 'pointer' : 'default',
            touchAction: 'none',
          }}
        >
          USE
        </div>
      </div>
      <NameAutocompleteInput
        placeholder="—"
        value={entry.name}
        onChange={name => onChange({ ...entry, name })}
        onSelect={name => {
          const match = gear.find(item => item.name === name)
          onChange({ ...entry, name, units: match?.cost !== undefined ? String(match.cost) : entry.units })
        }}
        options={GEAR_NAME_OPTIONS}
        style={FIELD_STYLE}
      />
      <input
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={entry.units}
        onChange={e => onChange({ ...entry, units: e.target.value })}
        style={FIELD_STYLE}
      />
      <input
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={entry.qty}
        onChange={e => onChange({ ...entry, qty: e.target.value })}
        style={FIELD_STYLE}
      />
    </div>
  )
}

function InventoryEntries({ count, entries, onEntryChange }: {
  count: number
  entries: SlotEntry[]
  onEntryChange: (index: number, entry: SlotEntry) => void
}) {
  if (count === 0) return null
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4rem 2rem 1fr 5rem 3.5rem',
          gap: '4px 8px',
          alignItems: 'center',
          marginBottom: 6,
          paddingBottom: 4,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span />
        <span />
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>Name</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>Units</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>QTY</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {Array.from({ length: count }).map((_, i) => (
          <SlotRow
            key={`slot-row-${i}`}
            index={i}
            entry={entries[i] ?? EMPTY_ENTRY}
            onChange={e => onEntryChange(i, e)}
          />
        ))}
      </div>
    </div>
  )
}

function InventoryGrid({
  slots,
  synced,
  slotsUsed,
}: {
  slots: number
  synced: boolean
  slotsUsed: number
}) {
  const clamped = Math.min(Math.max(slots, 0), MAX_INVENTORY_SLOTS)
  const used = Math.min(Math.round(slotsUsed), MAX_INVENTORY_SLOTS)
  const overCapacity = used > clamped
  return (
    <div style={{ marginBottom: 0, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Inventory
        </span>
        <span style={{ fontSize: '0.72rem', color: overCapacity ? 'rgba(255,100,100,0.9)' : 'var(--muted)' }}>
          {used} / {clamped} used
          {synced && <span style={{ marginLeft: 6, fontSize: '0.65rem', opacity: 0.6 }}>· synced from HUD</span>}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[0, 1, 2].map(row => (
          <div key={row} style={{ display: 'flex', gap: 5 }}>
            {Array.from({ length: 6 }).map((_, col) => {
              const i = row * 6 + col
              const active = i < clamped
              const filled = i < used
              const over = filled && i >= clamped
              return (
                <div
                  key={i}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    position: 'relative',
                    border: over
                      ? '1px solid rgba(255,80,80,0.8)'
                      : filled
                      ? '1px solid rgba(15,246,255,0.7)'
                      : active
                      ? '1px solid rgba(255,255,255,0.18)'
                      : '1px solid rgba(255,255,255,0.06)',
                    background: over
                      ? 'linear-gradient(135deg, rgba(255,60,60,0.28), rgba(180,20,20,0.18))'
                      : filled
                      ? 'linear-gradient(135deg, rgba(15,246,255,0.22), rgba(15,246,255,0.08))'
                      : active
                      ? 'rgba(255,255,255,0.03)'
                      : 'transparent',
                    boxShadow: over
                      ? '0 0 6px rgba(255,80,80,0.4), inset 0 0 4px rgba(255,80,80,0.15)'
                      : filled
                      ? '0 0 6px rgba(15,246,255,0.3), inset 0 0 4px rgba(15,246,255,0.1)'
                      : 'none',
                    transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
                  }}
                >
                  {filled && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: 1,
                        background: over ? 'rgba(255,120,120,0.9)' : 'rgba(15,246,255,0.85)',
                        boxShadow: over ? '0 0 4px rgba(255,80,80,0.8)' : '0 0 4px rgba(15,246,255,0.9)',
                        transform: 'rotate(45deg)',
                      }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

const RARITY_ORDER: GearRarity[] = ['Common', 'Uncommon', 'Rare', 'Unique']
const SLOT_ORDER: GearSlot[] = ['Head', 'Body', 'Hands', 'Feet', 'Accessory', 'Weapon', 'Misc']

const RARITY_COLORS: Record<GearRarity, string> = {
  Common:   'rgba(154,160,166,0.8)',
  Uncommon: 'rgba(99,255,177,0.85)',
  Rare:     'rgba(15,246,255,0.85)',
  Unique:   'rgba(249,115,22,0.85)',
}

function GearCard({ item, onQuickAdd }: { item: GearItem; onQuickAdd?: (item: GearItem) => void }) {
  const [expanded, setExpanded] = useState(false)
  const rarityColor = RARITY_COLORS[item.rarity]

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        cursor: item.description || item.effect ? 'pointer' : 'default',
      }}
      onClick={() => setExpanded(e => !e)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', letterSpacing: '0.06em' }}>
          {item.name}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {item.cost !== undefined && (
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)', background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 6px' }}>
              Size {item.cost}
            </span>
          )}
          <span
            style={{
              fontSize: '0.65rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: rarityColor,
              border: `1px solid ${rarityColor}`,
              borderRadius: 4,
              padding: '2px 6px',
            }}
          >
            {item.rarity}
          </span>
          {onQuickAdd && (
            <button
              onClick={e => { e.stopPropagation(); onQuickAdd(item) }}
              title="Add 1 to Inventory"
              aria-label={`Add 1 ${item.name} to inventory`}
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(99,255,177,0.1)',
                border: '1px solid rgba(99,255,177,0.45)',
                color: '#63ffb1',
                fontSize: '0.9rem',
                fontWeight: 700,
                lineHeight: 1,
                padding: 0,
                cursor: 'pointer',
                flexShrink: 0,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              +
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
          {item.description && (
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.82rem', lineHeight: 1.45 }}>
              {item.description}
            </p>
          )}
          {item.effect && (
            <div style={{ fontSize: '0.82rem', color: 'rgba(248,250,252,0.9)', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '4px 8px' }}>
              {item.effect}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function GearPage({
  gearSlotsStorageKey = GEAR_SLOTS_KEY,
  wardrobeStorageKey = WARDROBE_KEY,
  chudStateStorageKey = CHUD_STATE_KEY,
}: {
  gearSlotsStorageKey?: string
  wardrobeStorageKey?: string
  chudStateStorageKey?: string
} = {}) {
  const [slotFilter, setSlotFilter] = useState<GearSlot | null>(null)
  const [rarityFilter, setRarityFilter] = useState<GearRarity | null>(null)
  const [search, setSearch] = useState('')
  const [chudSlots, setChudSlots] = useState<number | null>(() => readChudInventorySlots(chudStateStorageKey))
  const [entries, setEntries] = useState<SlotEntry[]>(() => loadGearEntries(gearSlotsStorageKey))
  const [wardrobe, setWardrobe] = useState<WardrobeEntry[]>(() => loadWardrobe(wardrobeStorageKey))
  // Inventory assignment backbone (search UI not yet deployed)
  const [equippedItems, setEquippedItems] = useState<EquippedItem[]>(
    () => Array.from({ length: MAX_INVENTORY_SLOTS }, () => null)
  )
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [_searchQuery, _setSearchQuery] = useState('')
  const _searchResults = useMemo(() => searchGear(_searchQuery), [_searchQuery])

  // Assign a gear item to a slot (backbone — not yet wired to UI)
  const assignToSlot = (slotIndex: number, itemId: string) => {
    setEquippedItems(prev => {
      const next = [...prev]
      next[slotIndex] = { itemId }
      return next
    })
    setSelectedSlot(null)
    _setSearchQuery('')
  }

  // Clear a slot
  const clearSlot = (slotIndex: number) => {
    setEquippedItems(prev => {
      const next = [...prev]
      next[slotIndex] = null
      return next
    })
  }

  // Toggle slot selection (clicking an active slot selects/deselects it)
  const handleSlotClick = (index: number) => {
    setSelectedSlot(prev => prev === index ? null : index)
  }

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === chudStateStorageKey) setChudSlots(readChudInventorySlots(chudStateStorageKey))
      if (e.key === gearSlotsStorageKey) setEntries(loadGearEntries(gearSlotsStorageKey))
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [chudStateStorageKey, gearSlotsStorageKey])

  const handleEntryChange = (index: number, entry: SlotEntry) => {
    setEntries(prev => {
      const next = [...prev]
      next[index] = entry
      return next
    })
  }

  // Quick-add from the gear browser: bump qty on a matching inventory slot, or
  // fill the first empty visible slot with this item at qty 1.
  const handleQuickAdd = (item: GearItem) => {
    setEntries(prev => {
      const next = [...prev]
      const existingIndex = next.slice(0, inventorySlots).findIndex(e => e.name === item.name)
      if (existingIndex !== -1) {
        const current = parseFloat(next[existingIndex].qty)
        const newQty = (!isNaN(current) ? current : 0) + 1
        next[existingIndex] = { ...next[existingIndex], qty: String(newQty) }
        return next
      }
      const emptyIndex = next.slice(0, inventorySlots).findIndex(e => !e.name)
      if (emptyIndex !== -1) {
        next[emptyIndex] = {
          name: item.name,
          units: item.cost !== undefined ? String(item.cost) : '',
          qty: '1',
        }
      }
      return next
    })
  }

  const inventorySlots = chudSlots ?? 6

  const slotsUsed = useMemo(() => {
    let total = 0
    for (let i = 0; i < inventorySlots; i++) {
      const e = entries[i]
      if (!e) continue
      const u = parseFloat(e.units)
      const q = parseFloat(e.qty)
      if (!isNaN(u) && !isNaN(q)) total += u * q
    }
    return total
  }, [entries, inventorySlots])

  useEffect(() => {
    localStorage.setItem(gearSlotsStorageKey, JSON.stringify({ entries, slotsUsed }))
  }, [entries, slotsUsed, gearSlotsStorageKey])

  useEffect(() => {
    localStorage.setItem(wardrobeStorageKey, JSON.stringify(wardrobe))
  }, [wardrobe, wardrobeStorageKey])

  const handleWardrobeChange = (index: number, field: keyof WardrobeEntry, value: string) =>
    setWardrobe(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })

  // Suppress unused-variable warnings until search UI is deployed
  void assignToSlot
  void clearSlot
  void _searchResults

  const slotsInUse = useMemo(() => {
    const s = new Set(gear.map(g => g.slot))
    return SLOT_ORDER.filter(sl => s.has(sl))
  }, [])

  const filtered = useMemo(() => {
    return gear.filter(item => {
      if (slotFilter && item.slot !== slotFilter) return false
      if (rarityFilter && item.rarity !== rarityFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!item.name.toLowerCase().includes(q) && !(item.description ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [slotFilter, rarityFilter, search])

  const grouped = useMemo(() => {
    if (slotFilter) return { [slotFilter]: filtered }
    const groups: Partial<Record<GearSlot, GearItem[]>> = {}
    for (const item of filtered) {
      if (!groups[item.slot]) groups[item.slot] = []
      groups[item.slot]!.push(item)
    }
    return groups
  }, [filtered, slotFilter])

  const orderedSlots = SLOT_ORDER.filter(s => !!grouped[s])

  const isOverEncumbered = slotsUsed > inventorySlots

  return (
    <div className="page" style={{ maxWidth: 680, margin: '0 auto', padding: '1.25rem 1rem 2rem' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 4px 0' }}>Wardrobe &amp; Gear</h1>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap' }}>
        <InventoryGrid
          slots={inventorySlots}
          synced={chudSlots !== null}
          slotsUsed={slotsUsed}
        />

        {isOverEncumbered && (
          <div
            style={{
              flex: '1 1 0',
              minWidth: 220,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid rgba(212,43,43,0.6)',
              background: 'linear-gradient(135deg, rgba(212,43,43,0.14), rgba(180,20,20,0.08))',
              boxShadow: '0 0 18px rgba(212,43,43,0.18)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>⚠</span>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,100,100,0.95)', fontWeight: 700 }}>
                Over-Encumbered
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 3 }}>
                Carrying {Math.round(slotsUsed)} / {inventorySlots} slots
              </div>
            </div>
          </div>
        )}
      </div>

      <InventoryEntries count={inventorySlots} entries={entries} onEntryChange={handleEntryChange} />

      {/* ── Wardrobe ─────────────────────────────────────── */}
      <div style={{ marginTop: 32, marginBottom: 32 }}>
        <h2 style={{
          margin: '0 0 12px 0',
          fontSize: '0.75rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          fontFamily: 'var(--font-display)',
        }}>
          Wardrobe
        </h2>
        {wardrobe.map((row, index) => (
          <div key={index} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 0', minWidth: 0 }}>
                <label style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'var(--font-display)' }}>
                  Name
                </label>
                <input
                  type="text"
                  placeholder="—"
                  value={row.name}
                  onChange={e => handleWardrobeChange(index, 'name', e.target.value)}
                  style={FIELD_STYLE}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 0', minWidth: 0 }}>
                <label style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'var(--font-display)' }}>
                  Approach
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={row.approach}
                    onChange={e => handleWardrobeChange(index, 'approach', e.target.value)}
                    style={{
                      ...FIELD_STYLE,
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      paddingRight: '2rem',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <option value="">—</option>
                    {['Force', 'Finesse', 'Guts', 'Logic', 'Show', 'Tell'].map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: 'var(--muted)',
                      fontSize: '0.7rem',
                      lineHeight: 1,
                    }}
                  >
                    ▾
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 0', minWidth: 0 }}>
                <label style={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'var(--font-display)' }}>
                  Quality
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={row.quality}
                    onChange={e => handleWardrobeChange(index, 'quality', e.target.value)}
                    style={{
                      ...FIELD_STYLE,
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      paddingRight: '2rem',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <option key={n} value={`+${n}`}>+{n}</option>
                    ))}
                  </select>
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: 'var(--muted)',
                      fontSize: '0.7rem',
                      lineHeight: 1,
                    }}
                  >
                    ▾
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Gear browser ─────────────────────────────────── */}
      {gear.length === 0 ? (
        <div className="muted" style={{ textAlign: 'center', padding: '3rem 0' }}>
          No gear data yet.
        </div>
      ) : (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <input
              type="search"
              placeholder="Search gear…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '8px 12px',
                color: 'inherit',
                fontSize: '0.9rem',
                width: '100%',
              }}
            />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {slotsInUse.map(sl => (
            <button
              key={sl}
              onClick={() => setSlotFilter(f => f === sl ? null : sl)}
              style={{
                background: slotFilter === sl ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: slotFilter === sl ? '#000' : 'inherit',
                border: '1px solid var(--border)',
                borderRadius: 20,
                padding: '4px 12px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                letterSpacing: '0.06em',
                fontFamily: 'var(--font-display)',
              }}
            >
              {sl}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RARITY_ORDER.map(r => (
            <button
              key={r}
              onClick={() => setRarityFilter(f => f === r ? null : r)}
              style={{
                background: rarityFilter === r ? RARITY_COLORS[r] : 'rgba(255,255,255,0.04)',
                color: rarityFilter === r ? '#000' : RARITY_COLORS[r],
                border: `1px solid ${RARITY_COLORS[r]}`,
                borderRadius: 20,
                padding: '4px 12px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-display)',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="muted" style={{ fontSize: '0.78rem', marginBottom: 14 }}>
        {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        {(slotFilter || rarityFilter || search) ? ' (filtered)' : ''}
      </div>

      {/* Grouped list */}
      {filtered.length === 0 ? (
        <div className="muted" style={{ textAlign: 'center', padding: '2rem 0' }}>No gear matches your filters.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {orderedSlots.map(slot => (
            <div key={slot}>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '0.75rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)' }}>
                {slot}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grouped[slot]!.map(item => (
                  <GearCard key={item.id} item={item} onQuickAdd={handleQuickAdd} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  )
}
