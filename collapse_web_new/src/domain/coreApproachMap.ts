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
