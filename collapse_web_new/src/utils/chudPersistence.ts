import type { GearData, SaveState, SecondaryStats } from '../types/chud'
import { DEFAULT_SECONDARY } from '../domain/chudStats'

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
