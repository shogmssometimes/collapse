// Engram rules engine.
//
// An EngramDef describes a kind of Engram a character can own (its Capacity
// cost per copy, how it activates, and how many charges a single copy
// holds). An EquippedEngram is an instance on a character sheet: how many
// copies they own and how many charges remain.
//
// Rules (confirmed with the table):
//   - Equipping an Engram costs Capacity equal to its Level, per copy.
//   - Total equipped Level cost must not exceed the character's Capacity.
//   - Duplicate copies stack: owning N copies lets you roll 1..N dice when
//     activating (player's choice each time), as flat d4s that do NOT
//     explode (unlike Approach dice).
//   - Activation is either Standard (on your turn) or Hold (reserved,
//     usable off-turn as a reaction) — a fixed property of the Engram.
//   - Charges recover via Gear (not modeled here), a Short Rest (+1d4,
//     capped at max), or a Full Rest (restored to max).

export type EngramActivation = "standard" | "hold"

export const ENGRAM_DICE_SIDES = 4

export type EngramDef = {
  id: string
  name: string
  /** Capacity cost per copy. */
  level: number
  activation: EngramActivation
  /** Charges a single copy holds before needing to recover. */
  maxCharges: number
}

export type EquippedEngram = {
  defId: string
  copies: number
  charges: number
}

export type EngramRollResult = {
  dice: number[]
  total: number
}

function assertNonNegativeInt(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer.`)
  }
}

/** Total Capacity spent by a set of equipped Engrams. */
export function capacityUsed(equipped: EquippedEngram[], defs: Record<string, EngramDef>): number {
  return equipped.reduce((sum, engram) => {
    const def = defs[engram.defId]
    if (!def) return sum
    return sum + def.level * engram.copies
  }, 0)
}

/** Whether adding `addCopies` of `def` would stay within `capacity`. */
export function canEquip(
  equipped: EquippedEngram[],
  defs: Record<string, EngramDef>,
  capacity: number,
  def: EngramDef,
  addCopies: number = 1
): boolean {
  assertNonNegativeInt(addCopies, "addCopies")
  return capacityUsed(equipped, defs) + def.level * addCopies <= capacity
}

function rollFlatDie(sides: number, random: () => number): number {
  const sample = random()
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new RangeError("Random source must return a finite number in the range [0, 1).")
  }
  return Math.floor(sample * sides) + 1
}

/**
 * Rolls `diceCount` Engram dice (flat d4s, no explosions). `diceCount` must
 * be between 1 and the Engram's owned copies, and no more than the charges
 * currently available.
 */
export function rollEngramDice(
  diceCount: number,
  random: () => number = Math.random
): EngramRollResult {
  assertNonNegativeInt(diceCount, "diceCount")
  const dice = Array.from({ length: diceCount }, () => rollFlatDie(ENGRAM_DICE_SIDES, random))
  return { dice, total: dice.reduce((sum, value) => sum + value, 0) }
}

/** The largest number of dice this Engram can currently roll (limited by copies owned and charges left). */
export function maxRollableDice(engram: EquippedEngram): number {
  return Math.max(0, Math.min(engram.copies, engram.charges))
}

/** Spends `amount` charges (one per die rolled), clamped at zero. */
export function spendCharges(engram: EquippedEngram, amount: number): EquippedEngram {
  assertNonNegativeInt(amount, "amount")
  return { ...engram, charges: Math.max(0, engram.charges - amount) }
}

/** Short Rest: recover 1d4 charges, capped at the Engram's max. */
export function shortRestEngram(
  engram: EquippedEngram,
  def: EngramDef,
  random: () => number = Math.random
): EquippedEngram {
  const recovered = rollFlatDie(ENGRAM_DICE_SIDES, random)
  return { ...engram, charges: Math.min(def.maxCharges, engram.charges + recovered) }
}

/** Full Rest: charges are fully restored. */
export function fullRestEngram(engram: EquippedEngram, def: EngramDef): EquippedEngram {
  return { ...engram, charges: def.maxCharges }
}
