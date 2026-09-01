import type { ApproachStats, CoreStats, SecondaryStats, StatReps } from '../types/chud'

export const DEFAULT_CORE: CoreStats = { vigor: 3, inference: 2, personality: 2 };
export const DEFAULT_DRAW = 5;
export const DEFAULT_WT = 3;
export const DEFAULT_INVENTORY_SLOTS = 6;
export const DEFAULT_AP = 4;
export const DEFAULT_HP_COUNTER = 1;
export const DEFAULT_APPROACH: ApproachStats = {
  force: 0,
  finesse: 0,
  guts: 0,
  logic: 0,
  show: 0,
  tell: 0,
};

export const DEFAULT_SECONDARY: SecondaryStats = {
  vigor: 0,
  inference: 0,
  personality: 0,
};

export const DEFAULT_STAT_REPS: StatReps = { ap: 0, draw: 0, invSlots: 0 };

export function computeDerived(core: CoreStats) {
  return {
    hp: 8 + core.vigor * 2,
    capacity: 6 + core.inference * 2,
    readyness: 3 + core.personality * 2,
  };
}
