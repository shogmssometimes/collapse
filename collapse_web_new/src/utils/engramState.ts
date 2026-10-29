// Read/write bridge for the player's equipped Engrams (spell-slot style:
// copies owned = capacity spent & max charges; charges = current uses left
// before a Rest). Lives at the same per-slot storage key the old card-game
// deck builder used (`deckBuilderKey(slot)`), so Character Management's
// opaque export/import/delete still works unchanged.
//
// Exposed as plain functions (not a hook) so both the live Engram Manager
// page and notification-resolution code elsewhere (RestWidget, the header
// bell, Chud.tsx) can apply the same effects consistently, whether or not
// the Engram Manager page is currently mounted.

export type EquippedEngramState = { copies: number; charges: number }

export type EngramManagerState = {
  equipped: Record<string, EquippedEngramState>
  /** Short Rest "Restore Engrams": how many charges the player may still
   * distribute (their choice, across any equipped Engram) before this
   * resets to 0. */
  pendingEngramRestoreBudget: number
}

const DEFAULT_STATE: EngramManagerState = { equipped: {}, pendingEngramRestoreBudget: 0 }

function notify(key: string, json: string) {
  try {
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: json, storageArea: window.localStorage }))
  } catch {
    // StorageEvent construction can fail outside a browser — ignore.
  }
}

export function readEngramState(storageKey: string): EngramManagerState {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return { ...DEFAULT_STATE, equipped: {} }
    const parsed = JSON.parse(raw) as Partial<EngramManagerState>
    return {
      equipped: parsed.equipped ?? {},
      pendingEngramRestoreBudget: parsed.pendingEngramRestoreBudget ?? 0,
    }
  } catch {
    return { ...DEFAULT_STATE, equipped: {} }
  }
}

function writeEngramState(storageKey: string, next: EngramManagerState): void {
  try {
    const json = JSON.stringify(next)
    window.localStorage.setItem(storageKey, json)
    notify(storageKey, json)
  } catch {
    // storage unavailable — ignore
  }
}

/** Sets how many copies of an Engram are equipped, clamping charges to the
 * new copies count (copies are the max-charges pool). */
export function setEngramCopies(storageKey: string, engramId: string, copies: number): void {
  const state = readEngramState(storageKey)
  const safeCopies = Math.max(0, Math.round(copies))
  const equipped = { ...state.equipped }
  if (safeCopies <= 0) {
    delete equipped[engramId]
  } else {
    const prevCharges = equipped[engramId]?.charges ?? safeCopies
    equipped[engramId] = { copies: safeCopies, charges: Math.min(prevCharges, safeCopies) }
  }
  writeEngramState(storageKey, { ...state, equipped })
}

/** Spends `amount` charges from one Engram (floor at 0). */
export function spendEngramCharges(storageKey: string, engramId: string, amount: number): void {
  const state = readEngramState(storageKey)
  const current = state.equipped[engramId]
  if (!current) return
  const equipped = {
    ...state.equipped,
    [engramId]: { ...current, charges: Math.max(0, current.charges - Math.max(0, amount)) },
  }
  writeEngramState(storageKey, { ...state, equipped })
}

/** Short Rest "Restore Engrams": grants a restore budget the player then
 * spends (their choice of which Engram) via `restoreEngramCharge`. */
export function grantEngramRestoreBudget(storageKey: string, amount: number): void {
  const state = readEngramState(storageKey)
  writeEngramState(storageKey, {
    ...state,
    pendingEngramRestoreBudget: Math.max(0, state.pendingEngramRestoreBudget + amount),
  })
}

/** Spends 1 point of the pending restore budget to restore 1 charge to the
 * given Engram, capped at its copies (max charges). No-op if there's no
 * budget left or the Engram is already full. */
export function restoreEngramCharge(storageKey: string, engramId: string): void {
  const state = readEngramState(storageKey)
  if (state.pendingEngramRestoreBudget <= 0) return
  const current = state.equipped[engramId]
  if (!current || current.charges >= current.copies) return
  writeEngramState(storageKey, {
    ...state,
    equipped: { ...state.equipped, [engramId]: { ...current, charges: current.charges + 1 } },
    pendingEngramRestoreBudget: state.pendingEngramRestoreBudget - 1,
  })
}

/** Full Rest: every equipped Engram's charges refill to its copies count;
 * any leftover Short Rest restore budget is cleared. */
export function fullRestEngrams(storageKey: string): void {
  const state = readEngramState(storageKey)
  const equipped = Object.fromEntries(
    Object.entries(state.equipped).map(([id, e]) => [id, { ...e, charges: e.copies }])
  )
  writeEngramState(storageKey, { equipped, pendingEngramRestoreBudget: 0 })
}
