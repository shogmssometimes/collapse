// Reads derived values from the cHUD character sheet's localStorage entry so
// other apps (e.g. the Deck Builder) can sync capacity/draw without owning
// the cHUD state themselves.

export function readChudCapacity(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (typeof s?.core?.inference === 'number') return s.core.inference + 10
    return null
  } catch {
    return null
  }
}

export function readChudDraw(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (typeof s?.draw === 'number') return s.draw
    return null
  } catch {
    return null
  }
}
