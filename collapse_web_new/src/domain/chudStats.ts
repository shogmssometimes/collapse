import type { ApproachStats, CoreStats, SecondaryStats } from '../types/chud'

export const DEFAULT_CORE: CoreStats = { vigor: 3, inference: 2, personality: 2 };
export const DEFAULT_WT = 3;
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

// Derived Vitals, per the handbook's Phase 6 example (YOU/Vie):
//   HP (Max)        = 6 + Vigor + Inference
//   Capacity        = 4 + Inference + Personality
//   Readiness (RDY) = Vigor + Personality
export function computeDerived(core: CoreStats) {
  return {
    hp: 6 + core.vigor + core.inference,
    capacity: 4 + core.inference + core.personality,
    readyness: core.vigor + core.personality,
  };
}

// Inventory Slots = Vigor (handbook rule) — always derived from Core
// stats, never a separately set/leveled value. (Not to be confused with
// the Fumble Number, which is V+I+P.)
export function computeInventorySlots(core: CoreStats): number {
  return core.vigor;
}

// Fumble Number = V+I+P — the margin by which an opponent must beat you to
// cause a Fumble (see the Combat section). Not yet surfaced in any UI.
export function computeFumbleNumber(core: CoreStats): number {
  return core.vigor + core.inference + core.personality;
}

// Skills = Inference — how many Skills the character knows.
export function computeSkillCount(core: CoreStats): number {
  return core.inference;
}

// Ganbare Charges = Personality — how many times a day you can give
// Ganbare! to an ally.
export function computeGanbareCharges(core: CoreStats): number {
  return core.personality;
}
