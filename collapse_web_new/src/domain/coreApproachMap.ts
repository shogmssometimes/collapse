import type { ApproachStats, CoreStats } from "../types/chud";

// Each Core stat's value is the total pool of points that can be distributed
// across its two linked Approaches (e.g. a Vigor of 3 means up to 3 points,
// combined, can be spent on Force + Finesse).
export const CORE_APPROACH_MAP: Record<keyof CoreStats, [keyof ApproachStats, keyof ApproachStats]> = {
  vigor: ["force", "finesse"],
  inference: ["guts", "logic"],
  personality: ["show", "tell"],
};

export const APPROACH_LABELS: Record<keyof ApproachStats, string> = {
  force: "Force",
  guts: "Guts",
  show: "Show",
  finesse: "Finesse",
  logic: "Logic",
  tell: "Tell",
};

export const CORE_LABELS: Record<keyof CoreStats, string> = {
  vigor: "VIGOR",
  inference: "INFER",
  personality: "PERSO",
};

// "Stats and Methods all max out at 6. Gear can temporarily exceed that
// maximum, but 6 will remain the maximum Stat or Method you can achieve."
// Applies to both a Core stat's own value and a Method's effective rating
// (Core-distributed points + Wardrobe bonus, before any Gear dice).
export const STAT_AND_METHOD_MAX = 6;

// Clamps every Core stat into [0, STAT_AND_METHOD_MAX]. Used when loading
// persisted state (in case it predates the cap, or was edited externally)
// and when applying cross-tab/cross-iframe storage updates.
export function clampCore(core: CoreStats): CoreStats {
  return {
    vigor: Math.min(STAT_AND_METHOD_MAX, Math.max(0, core.vigor)),
    inference: Math.min(STAT_AND_METHOD_MAX, Math.max(0, core.inference)),
    personality: Math.min(STAT_AND_METHOD_MAX, Math.max(0, core.personality)),
  };
}

// Clamps each Core stat's two linked Approaches so their combined total
// never exceeds that Core stat's pool (e.g. if Vigor drops to 0, Force +
// Finesse are trimmed back down to 0 too). Used both when loading persisted
// state and whenever a Core stat is lowered.
export function clampApproachToCore(approach: ApproachStats, core: CoreStats): ApproachStats {
  let next = approach;
  (Object.keys(CORE_APPROACH_MAP) as Array<keyof CoreStats>).forEach((coreField) => {
    const [a, b] = CORE_APPROACH_MAP[coreField];
    const pool = core[coreField];
    let overflow = next[a] + next[b] - pool;
    if (overflow <= 0) return;
    const trimmedB = Math.max(0, next[b] - overflow);
    overflow -= next[b] - trimmedB;
    const trimmedA = Math.max(0, next[a] - overflow);
    next = { ...next, [a]: trimmedA, [b]: trimmedB };
  });
  return next;
}
