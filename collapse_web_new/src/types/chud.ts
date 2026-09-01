// Shared cHUD (character HUD) domain types.

export interface CoreStats {
  vigor: number;
  inference: number;
  personality: number;
}

export interface ApproachStats {
  force: number;
  finesse: number;
  guts: number;
  logic: number;
  show: number;
  tell: number;
}

export interface SecondaryStats {
  vigor: number;
  inference: number;
  personality: number;
}

export interface StatReps {
  ap: number;
  draw: number;
  invSlots: number;
}

export interface SaveState {
  core: CoreStats;
  hpCounter: number;
  approach: ApproachStats;
  wt: number;
  ap: number;
  draw: number;
  inventorySlots: number;
  secondary?: SecondaryStats;
  statReps?: StatReps;
  shortRest?: boolean;
}

export type GearSlotEntry = { name: string; units: string; qty: string };
export type GearData = { entries: GearSlotEntry[]; slotsUsed: number };
