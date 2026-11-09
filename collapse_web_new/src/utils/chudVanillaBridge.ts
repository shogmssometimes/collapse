// Thin write-side bridge into the vanilla (non-React) HUD widgets that live
// in public/chud/meter-bridge.js. Both surfaces share the same origin, so
// writing these exact localStorage shapes (and re-dispatching a synthetic
// "storage" event, since same-tab writes don't fire one automatically) keeps
// the HUD in sync immediately rather than only on next load/cross-tab event.

const STATUS_ROLLS_KEY = "chud.statusRolls";
const COMBAT_KEY = "combat.v1";
const CSMATRIX_KEY = "csmatrix.graph";
const METER_MAX = 6;

type StatusRollRow = { id: string; name: string; effect: string; roll: number };
type StatusRollsState = { rows: StatusRollRow[] };
type CombatState = { reactionTokens: number; chipDesynced: boolean; [key: string]: unknown };
type GlobalMeters = { collapse?: number; grit?: number };
type CSMatrixGraph = { nodes?: unknown[]; edges?: unknown[]; meta?: { globalMeters?: GlobalMeters; [key: string]: unknown } };

const clampMeter = (n: number) => Math.max(0, Math.min(METER_MAX, n));

function notify(key: string, json: string) {
  try {
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: json, storageArea: window.localStorage }));
  } catch {
    // StorageEvent construction can fail in non-browser test environments — ignore.
  }
}

/**
 * Prepends a new Set Roll row (HUD "Set Rolls" widget) with the given value.
 * Defaults the Name to "New Effect" (edit at the HUD) rather than leaving it
 * blank, since a roll sent this way is nearly always meant to back a new
 * status/effect entry. Placed at the front of the list so it survives the
 * widget's 10-row display cap.
 */
export function addSetRollRow(value: number): void {
  try {
    const raw = window.localStorage.getItem(STATUS_ROLLS_KEY);
    const parsed: StatusRollsState = raw ? JSON.parse(raw) : { rows: [] };
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    const row: StatusRollRow = {
      id: `sr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: "New Effect",
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

/**
 * Applies a delta to the CS Matrix's Grit/Collapse global meters (mirrors
 * the clamp/maxGrit math in meter-bridge.js's buildGritCollapseMeter so both
 * surfaces agree on the result). Used when a notification is accepted.
 */
export function adjustGlobalMeters(delta: { grit?: number; collapse?: number }): void {
  try {
    const raw = window.localStorage.getItem(CSMATRIX_KEY);
    const graph: CSMatrixGraph = raw ? JSON.parse(raw) : { nodes: [], edges: [], meta: {} };
    graph.meta = graph.meta || {};
    const meta = graph.meta.globalMeters || {};
    const nextCollapse = clampMeter((meta.collapse ?? 0) + (delta.collapse ?? 0));
    const maxGrit = Math.max(0, METER_MAX - nextCollapse);
    const nextGrit = Math.min(maxGrit, Math.max(0, (meta.grit ?? 0) + (delta.grit ?? 0)));
    graph.meta.globalMeters = { ...meta, collapse: nextCollapse, grit: nextGrit };
    const json = JSON.stringify(graph);
    window.localStorage.setItem(CSMATRIX_KEY, json);
    notify(CSMATRIX_KEY, json);
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

/**
 * Applies a delta to the HP counter stored at the given (slot-aware)
 * `chud.state.v1`-style key, clamped at 0 (no upper bound here — only
 * decrements currently flow through notification effects). Used when a
 * notification is accepted from outside the CHUD iframe (e.g. the outer
 * app's header bell), where there's no live Chud.tsx instance to apply it.
 */
export function adjustHpCounter(delta: number, chudStateKey: string): void {
  try {
    const raw = window.localStorage.getItem(chudStateKey);
    const parsed: Record<string, unknown> = raw ? JSON.parse(raw) : {};
    const current = typeof parsed.hpCounter === "number" ? parsed.hpCounter : 0;
    const json = JSON.stringify({ ...parsed, hpCounter: Math.max(0, current + delta) });
    window.localStorage.setItem(chudStateKey, json);
    notify(chudStateKey, json);
  } catch {
    // storage unavailable — ignore
  }
}

/**
 * Persists the player's one-time "Choose Your Path" answer (live/survive/die)
 * directly to the slot's CHUD state, for when the choice notification is
 * resolved from the outer app's header bell rather than the live iframe.
 */
export function setCollapsePath(path: string, chudStateKey: string): void {
  try {
    const raw = window.localStorage.getItem(chudStateKey);
    const parsed: Record<string, unknown> = raw ? JSON.parse(raw) : {};
    const json = JSON.stringify({ ...parsed, collapsePath: path });
    window.localStorage.setItem(chudStateKey, json);
    notify(chudStateKey, json);
  } catch {
    // storage unavailable — ignore
  }
}

/** Reads the current Grit/Collapse global meters (for computing Full Rest's
 * absolute "set Grit" as a delta against whatever it currently is). */
export function readGlobalMeters(): { grit: number; collapse: number } {
  try {
    const raw = window.localStorage.getItem(CSMATRIX_KEY);
    const graph: CSMatrixGraph = raw ? JSON.parse(raw) : { meta: {} };
    const meta = graph.meta?.globalMeters ?? {};
    return { grit: meta.grit ?? 0, collapse: meta.collapse ?? 0 };
  } catch {
    return { grit: 0, collapse: 0 };
  }
}

/** Reads the current HP counter for the given (slot-aware) `chud.state.v1`
 * key, for computing Full Rest's "HP to max" as a delta. */
export function readHpCounter(chudStateKey: string): number {
  try {
    const raw = window.localStorage.getItem(chudStateKey);
    const parsed: Record<string, unknown> = raw ? JSON.parse(raw) : {};
    return typeof parsed.hpCounter === "number" ? parsed.hpCounter : 0;
  } catch {
    return 0;
  }
}

/** Resets the Approach Overload pool (Method dice) to fully unspent for the
 * given (slot-aware) `chud.state.v1` key — Full Rest only. */
export function resetApproachOverload(chudStateKey: string): void {
  try {
    const raw = window.localStorage.getItem(chudStateKey);
    const parsed: Record<string, unknown> = raw ? JSON.parse(raw) : {};
    const prevSpent = (parsed.approachOverloadSpent as Record<string, number>) ?? {};
    const resetSpent = Object.fromEntries(Object.keys(prevSpent).map((k) => [k, 0]));
    const json = JSON.stringify({ ...parsed, approachOverloadSpent: resetSpent });
    window.localStorage.setItem(chudStateKey, json);
    notify(chudStateKey, json);
  } catch {
    // storage unavailable — ignore
  }
}

/** Restores all Ganbare! Charges (spent count back to 0) for the given
 * (slot-aware) `chud.state.v1` key — Full Rest only. */
export function resetGanbareCharges(chudStateKey: string): void {
  try {
    const raw = window.localStorage.getItem(chudStateKey);
    const parsed: Record<string, unknown> = raw ? JSON.parse(raw) : {};
    const json = JSON.stringify({ ...parsed, ganbareSpent: 0 });
    window.localStorage.setItem(chudStateKey, json);
    notify(chudStateKey, json);
  } catch {
    // storage unavailable — ignore
  }
}

/** Reads the current Core stats for the given (slot-aware) `chud.state.v1`
 * key, for computing Full Rest's HP-to-max delta. */
export function readCore(chudStateKey: string): { vigor: number; inference: number; personality: number } | undefined {
  try {
    const raw = window.localStorage.getItem(chudStateKey);
    const parsed: Record<string, unknown> = raw ? JSON.parse(raw) : {};
    return parsed.core as { vigor: number; inference: number; personality: number } | undefined;
  } catch {
    return undefined;
  }
}


export function readCollapsePath(chudStateKey: string): string | undefined {
  try {
    const raw = window.localStorage.getItem(chudStateKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return typeof parsed.collapsePath === "string" ? parsed.collapsePath : undefined;
  } catch {
    return undefined;
  }
}
