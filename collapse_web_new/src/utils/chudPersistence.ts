import type { GearData, SaveState, SecondaryStats, WardrobeEntry } from '../types/chud'
import { DEFAULT_SECONDARY, DEFAULT_HP_COUNTER, DEFAULT_WT } from '../domain/chudStats'

// Normalizes a persisted counter-style field (HP, Wound Threshold, Ganbare!
// charges spent, etc.): hand-edited or corrupt saves can replace a number
// with a string, NaN-producing value, or other garbage, which otherwise
// poisons downstream arithmetic (e.g. "x" + delta => NaN) rather than being
// caught — see B5. Falls back to `fallback` for anything that isn't a
// finite number, and clamps to non-negative otherwise.
function sanitizeSavedCounter(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

// Reads & normalizes the persisted cHUD character sheet.
export function loadState(storageKey: string): Partial<SaveState> | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    // Normalize secondary: if any expected key is missing/NaN, reset to defaults
    if (parsed.secondary) {
      const s = parsed.secondary as Record<string, unknown>;
      const keys: Array<keyof SecondaryStats> = ["vigor", "inference", "personality"];
      const isValid = keys.every((k) => typeof s[k] === "number" && !Number.isNaN(s[k]));
      if (!isValid) parsed.secondary = { ...DEFAULT_SECONDARY };
    }
    // Normalize counter-style numeric fields (B5): a corrupted/hand-edited
    // or badly-imported save can otherwise leave these as a string or NaN.
    if ("hpCounter" in parsed) parsed.hpCounter = sanitizeSavedCounter(parsed.hpCounter, DEFAULT_HP_COUNTER);
    if ("wt" in parsed) parsed.wt = sanitizeSavedCounter(parsed.wt, DEFAULT_WT);
    if ("ganbareSpent" in parsed) parsed.ganbareSpent = sanitizeSavedCounter(parsed.ganbareSpent, 0);
    return parsed;
  } catch {
    return null;
  }
}

export function readSavedUI(uiKey: string): { hpOpen?: boolean } {
  try {
    const raw = window.localStorage.getItem(uiKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function readGearData(gearSlotsKey: string): GearData | null {
  try {
    const raw = window.localStorage.getItem(gearSlotsKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // new format: { entries, slotsUsed }
    if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.entries)) {
      return { entries: parsed.entries, slotsUsed: typeof parsed.slotsUsed === 'number' ? parsed.slotsUsed : 0 };
    }
    // legacy array format
    if (Array.isArray(parsed)) {
      return { entries: parsed, slotsUsed: 0 };
    }
    return null;
  } catch {
    return null;
  }
}

export function readWardrobeData(wardrobeKey: string): WardrobeEntry[] {
  try {
    const raw = window.localStorage.getItem(wardrobeKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
      .map((row) => ({
        name: typeof row.name === 'string' ? row.name : '',
        approach: typeof row.approach === 'string' ? row.approach : '',
        quality: typeof row.quality === 'string' ? row.quality : '',
      }));
  } catch {
    return [];
  }
}
