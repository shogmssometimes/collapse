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
  vigor: "VIG",
  inference: "INFER",
  personality: "PERSO",
};

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
