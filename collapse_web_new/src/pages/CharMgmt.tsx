import React, { useRef, useState } from 'react'
import { deckBuilderKey, gearSlotsKey, wardrobeKey, chudStateKey, notesKey, CHAR_ACTIVE_KEY, charSlotKey } from '../utils/slotKeys'

export const SLOT_DECK_KEYS: Record<number, string> = {
  1: deckBuilderKey(1),
  2: deckBuilderKey(2),
  3: deckBuilderKey(3),
}

export const CHAR_SWITCH_EVENT = 'collapse-char-switch'

const SLOT_COUNT = 3

interface SlotMeta {
  name: string
}

function readActiveSlot(): number {
  const raw = localStorage.getItem(CHAR_ACTIVE_KEY)
  const n = raw ? parseInt(raw, 10) : 1
  return isNaN(n) || n < 1 || n > SLOT_COUNT ? 1 : n
}

function readSlotMeta(n: number): SlotMeta {
  const raw = localStorage.getItem(charSlotKey(n))
  if (!raw) return { name: '' }
  try { return JSON.parse(raw) as SlotMeta } catch { return { name: '' } }
}

const CharMgmt: React.FC = () => {
  const [slotMeta, setSlotMeta] = useState<SlotMeta[]>(() =>
    Array.from({ length: SLOT_COUNT }, (_, i) => readSlotMeta(i + 1))
  )
  const [activeSlot, setActiveSlot] = useState<number>(() => readActiveSlot())
  const [slotHasData, setSlotHasData] = useState<boolean[]>(() =>
    Array.from({ length: SLOT_COUNT }, (_, i) => {
      const s = i + 1
      return !!(
        localStorage.getItem(deckBuilderKey(s)) ||
        localStorage.getItem(gearSlotsKey(s)) ||
        localStorage.getItem(wardrobeKey(s)) ||
        localStorage.getItem(chudStateKey(s)) ||
        localStorage.getItem(notesKey(s))
      )
    })
  )
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<string | null>(null)
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>(Array(SLOT_COUNT).fill(null))

  const activateSlot = (slotNum: number) => {
    if (slotNum === activeSlot) return
    localStorage.setItem(CHAR_ACTIVE_KEY, String(slotNum))
    window.dispatchEvent(new CustomEvent(CHAR_SWITCH_EVENT, { detail: slotNum }))
    setActiveSlot(slotNum)
  }

  const renameSlot = (slotNum: number, name: string) => {
    const updated = [...slotMeta]
    updated[slotNum - 1] = { name }
    setSlotMeta(updated)
    localStorage.setItem(charSlotKey(slotNum), JSON.stringify({ name }))
  }

  const deleteSlot = (slotNum: number) => {
    const name = slotMeta[slotNum - 1].name || `Character ${slotNum}`
    if (!window.confirm(`Delete "${name}"? All save data for this slot will be permanently removed.`)) return
    localStorage.removeItem(deckBuilderKey(slotNum))
    localStorage.removeItem(gearSlotsKey(slotNum))
    localStorage.removeItem(wardrobeKey(slotNum))
    localStorage.removeItem(chudStateKey(slotNum))
    localStorage.removeItem(notesKey(slotNum))
    localStorage.removeItem(charSlotKey(slotNum))
    const updatedMeta = [...slotMeta]
    updatedMeta[slotNum - 1] = { name: '' }
    setSlotMeta(updatedMeta)
    const updatedHasData = [...slotHasData]
    updatedHasData[slotNum - 1] = false
    setSlotHasData(updatedHasData)
    if (slotNum === activeSlot) {
      window.dispatchEvent(new CustomEvent(CHAR_SWITCH_EVENT, { detail: slotNum }))
    }
  }

  const exportSlot = (slotNum: number) => {
    const meta = slotMeta[slotNum - 1]
    const exportData = {
      name: meta.name || `Character ${slotNum}`,
      slotData: {
        deckBuilder: localStorage.getItem(deckBuilderKey(slotNum)),
        gearSlots: localStorage.getItem(gearSlotsKey(slotNum)),
        wardrobe: localStorage.getItem(wardrobeKey(slotNum)),
        chudState: localStorage.getItem(chudStateKey(slotNum)),
        notes: localStorage.getItem(notesKey(slotNum)),
      },
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${exportData.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-character.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importSlot = (slotNum: number, file: File) => {
    setImportError(null)
    setImportSuccess(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string
        const data = JSON.parse(raw) as {
          name?: string
          slotData?: {
            deckBuilder?: string | null
            gearSlots?: string | null
            wardrobe?: string | null
            chudState?: string | null
            notes?: string | null
          }
          deckState?: string | null
        }
        const name = typeof data.name === 'string' ? data.name : `Character ${slotNum}`

        const updatedMeta = [...slotMeta]
        updatedMeta[slotNum - 1] = { name }
        setSlotMeta(updatedMeta)
        localStorage.setItem(charSlotKey(slotNum), JSON.stringify({ name }))

        const restoreKey = (key: string, value: string | null | undefined) => {
          if (value) localStorage.setItem(key, value)
          else localStorage.removeItem(key)
        }

        if (data.slotData) {
          restoreKey(deckBuilderKey(slotNum), data.slotData.deckBuilder)
          restoreKey(gearSlotsKey(slotNum), data.slotData.gearSlots)
          restoreKey(wardrobeKey(slotNum), data.slotData.wardrobe)
          restoreKey(chudStateKey(slotNum), data.slotData.chudState)
          restoreKey(notesKey(slotNum), data.slotData.notes)
        } else if (data.deckState !== undefined) {
          restoreKey(deckBuilderKey(slotNum), data.deckState)
        }

        const updatedHasData = [...slotHasData]
        updatedHasData[slotNum - 1] = !!(data.slotData || data.deckState)
        setSlotHasData(updatedHasData)

        setImportSuccess(`Imported "${name}" into slot ${slotNum}.`)
      } catch {
        setImportError(`Slot ${slotNum}: Failed to import. Make sure it's a valid character file.`)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="muted" style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Player Tools
          </div>
          <h1 style={{ margin: '0.15rem 0 0.35rem 0' }}>Character Management</h1>
          <p className="muted" style={{ margin: 0 }}>
            Each slot saves independently. Switching loads that character across all pages.
          </p>
        </div>
      </div>

      <div style={{ padding: '0 1rem 2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {importError && (
          <div className="status-error text-body">{importError}</div>
        )}
        {importSuccess && (
          <div className="text-body" style={{ color: 'var(--accent, #0ff)' }}>{importSuccess}</div>
        )}

        {Array.from({ length: SLOT_COUNT }, (_, i) => {
          const slotNum = i + 1
          const meta = slotMeta[i]
          const isActive = slotNum === activeSlot
          const hasData = isActive
            ? !!(
                localStorage.getItem(deckBuilderKey(slotNum)) ||
                localStorage.getItem(gearSlotsKey(slotNum)) ||
                localStorage.getItem(wardrobeKey(slotNum)) ||
                localStorage.getItem(chudStateKey(slotNum)) ||
                localStorage.getItem(notesKey(slotNum))
              )
            : slotHasData[i]

          return (
            <div
              key={slotNum}
              style={{
                border: `1px solid ${isActive ? 'var(--accent, #0ff)' : 'var(--border)'}`,
                borderRadius: 8,
                padding: '1rem',
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span className="muted" style={{ fontSize: '0.85rem', minWidth: 52 }}>Slot {slotNum}</span>
                {isActive && (
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: 999,
                    border: '1px solid var(--accent, #0ff)',
                    color: 'var(--accent, #0ff)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}>
                    Active
                  </span>
                )}
                {!isActive && hasData && (
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Has save data</span>
                )}
                {!isActive && !hasData && (
                  <span className="muted" style={{ fontSize: '0.75rem' }}>Empty</span>
                )}
              </div>

              <input
                type="text"
                value={meta.name}
                onChange={(e) => renameSlot(slotNum, e.target.value)}
                placeholder={`Character ${slotNum}`}
                aria-label={`Name for slot ${slotNum}`}
                style={{
                  background: 'var(--bg-dark)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  padding: '0.4rem 0.65rem',
                  color: 'inherit',
                  fontSize: '1rem',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {!isActive && (
                  <button onClick={() => activateSlot(slotNum)}>Load Character</button>
                )}
                <button onClick={() => exportSlot(slotNum)} disabled={!hasData}>Export</button>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    ref={(el) => { fileInputRefs.current[i] = el }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        importSlot(slotNum, file)
                        e.target.value = ''
                      }
                    }}
                  />
                  <span
                    className="button-like"
                    style={{
                      display: 'inline-block',
                      padding: '0.4rem 0.85rem',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      background: 'var(--surface)',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    Import
                  </span>
                </label>
                <div style={{ marginLeft: 'auto' }}>
                  <button
                    onClick={() => deleteSlot(slotNum)}
                    disabled={!hasData}
                    style={{ color: 'var(--error, #f66)', borderColor: 'var(--error, #f66)' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CharMgmt
