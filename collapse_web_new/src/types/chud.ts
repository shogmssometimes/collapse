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

export type CollapsePath = "live" | "survive" | "die";

export interface SaveState {
  core: CoreStats;
  hpCounter: number;
  approach: ApproachStats;
  damageDieSize?: import('../domain/approachDice').DieSides;
  approachOverloadSpent?: Partial<Record<keyof ApproachStats, number>>;
  wt: number;
  /** Derived as Vigor — persisted as an echo for pages that read it (Gear,
   * GearPanel, HPPanel), never set directly. */
  inventorySlots: number;
  secondary?: SecondaryStats;
  shortRest?: boolean;
  /** Whether this character has ever been downed (HP hit 0) before — gates
   * the one-time "Choose Your Path" (Live/Survive/Die) notification. */
  hasBeenDownedBefore?: boolean;
  /** The table the player chose to roll on each time they're downed, set by
   * the one-time "Choose Your Path" notification. */
  collapsePath?: CollapsePath;
}

export type GearSlotEntry = { name: string; units: string; qty: string };
export type GearData = { entries: GearSlotEntry[]; slotsUsed: number };

export type WardrobeEntry = { name: string; approach: string; quality: string };
