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
  /** Overload spend tracked separately for each Method's Wardrobe bonus dice
   * — they're their own depletable pool (same Overload/rest mechanic as the
   * base pool), capped at that Method's current Wardrobe bonus instead of
   * its base rating. */
  approachWardrobeOverloadSpent?: Partial<Record<keyof ApproachStats, number>>;
  /** Timestamp (ms) when the Ganbare! "glass cover" was last shattered (8
   * taps) — the control stays visibly broken and disabled until the
   * cooldown elapses, then the glass restores itself. */
  ganbareGlassBrokenAt?: number | null;
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
  /** Ganbare! Charges spent (max = Personality, see computeGanbareCharges).
   * Restored to 0 by a Full Rest. Charges do not use Capacity. */
  ganbareSpent?: number;
}

export type GearSlotEntry = { name: string; units: string; qty: string };
export type GearData = { entries: GearSlotEntry[]; slotsUsed: number };

export type WardrobeEntry = { name: string; approach: string; quality: string };
