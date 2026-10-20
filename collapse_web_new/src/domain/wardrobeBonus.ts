import type { ApproachStats, WardrobeEntry } from "../types/chud";
import { DEFAULT_APPROACH } from "./chudStats";

export interface WardrobeBonusResult {
  bonus: Partial<Record<keyof ApproachStats, number>>;
  items: Partial<Record<keyof ApproachStats, string[]>>;
}

/**
 * Sums each Wardrobe row's "+N" quality bonus onto the Approach it's
 * assigned to, and keeps the contributing item names for a tooltip. This is
 * a bonus layered on top of the Core-distributed Approach rating — it never
 * touches the distribution/overflow validation, only rolling availability.
 */
export function computeWardrobeBonuses(entries: WardrobeEntry[]): WardrobeBonusResult {
  const bonus: Partial<Record<keyof ApproachStats, number>> = {};
  const items: Partial<Record<keyof ApproachStats, string[]>> = {};
  for (const row of entries) {
    const field = row.approach.trim().toLowerCase() as keyof ApproachStats;
    if (!field || !(field in DEFAULT_APPROACH)) continue;
    const match = /^\+(\d+)$/.exec(row.quality.trim());
    if (!match) continue;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    bonus[field] = (bonus[field] ?? 0) + amount;
    const label = row.name.trim() || "Unnamed item";
    items[field] = [...(items[field] ?? []), `${label} (+${amount})`];
  }
  return { bonus, items };
}
