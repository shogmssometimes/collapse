// Thin write-side bridge into the vanilla (non-React) HUD widgets that live
// in public/chud/meter-bridge.js. Both surfaces share the same origin, so
// writing these exact localStorage shapes (and re-dispatching a synthetic
// "storage" event, since same-tab writes don't fire one automatically) keeps
// the HUD in sync immediately rather than only on next load/cross-tab event.

const STATUS_ROLLS_KEY = "chud.statusRolls";
const COMBAT_KEY = "combat.v1";

type StatusRollRow = { id: string; name: string; effect: string; roll: number };
type StatusRollsState = { rows: StatusRollRow[] };
type CombatState = { reactionTokens: number; chipDesynced: boolean; [key: string]: unknown };

function notify(key: string, json: string) {
  try {
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: json, storageArea: window.localStorage }));
  } catch {
    // StorageEvent construction can fail in non-browser test environments — ignore.
  }
}

/**
 * Prepends a new Set Roll row (HUD "Set Rolls" widget) with the given value,
 * leaving its Name blank for the player to label at the HUD. Placed at the
 * front of the list so it survives the widget's 10-row display cap.
 */
export function addSetRollRow(value: number): void {
  try {
    const raw = window.localStorage.getItem(STATUS_ROLLS_KEY);
    const parsed: StatusRollsState = raw ? JSON.parse(raw) : { rows: [] };
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    const row: StatusRollRow = {
      id: `sr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: "",
      effect: "",
      roll: value,
    };
    const json = JSON.stringify({ rows: [row, ...rows] });
    window.localStorage.setItem(STATUS_ROLLS_KEY, json);
    notify(STATUS_ROLLS_KEY, json);
  } catch {
    // storage unavailable — ignore
  }
}

/** Flips the HUD's Chip Sync indicator between Synced/Desynced. */
export function setChipDesynced(desynced: boolean): void {
  try {
    const raw = window.localStorage.getItem(COMBAT_KEY);
    const parsed: CombatState = raw ? JSON.parse(raw) : { reactionTokens: 0, chipDesynced: false };
    const json = JSON.stringify({ ...parsed, chipDesynced: desynced });
    window.localStorage.setItem(COMBAT_KEY, json);
    notify(COMBAT_KEY, json);
  } catch {
    // storage unavailable — ignore
  }
}
