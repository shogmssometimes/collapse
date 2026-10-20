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
  invSlots: number;
}

export interface SaveState {
  core: CoreStats;
  hpCounter: number;
  approach: ApproachStats;
  approachDieSize?: import('../domain/approachDice').DieSides;
  damageDieSize?: import('../domain/approachDice').DieSides;
  approachOverloadSpent?: Partial<Record<keyof ApproachStats, number>>;
  wt: number;
  inventorySlots: number;
  secondary?: SecondaryStats;
  statReps?: StatReps;
  shortRest?: boolean;
}

export type GearSlotEntry = { name: string; units: string; qty: string };
export type GearData = { entries: GearSlotEntry[]; slotsUsed: number };

export type WardrobeEntry = { name: string; approach: string; quality: string };
