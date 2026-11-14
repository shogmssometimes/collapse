export type DieSides = 4 | 6 | 8 | 10 | 12 | 20

export const DIE_LADDER: readonly DieSides[] = [4, 6, 8, 10, 12, 20]
export const DEFAULT_DIE_SIZE: DieSides = 8

/**
 * Collapse uses one primary dice engine: Xd10. Every Method and every
 * player uses the same die size — there is no per-Approach die-size
 * selection anymore. The Weapon Quality / Wound die (see DIE_LADDER above)
 * is a separate, still-variable die size.
 */
export const METHOD_DIE: DieSides = 10

export type ApproachDieResult = {
  rolls: number[]
  total: number
}

export type ApproachRollResult = {
  die: DieSides
  dice: ApproachDieResult[]
  total: number
}

export function isDieSides(value: unknown): value is DieSides {
  return typeof value === "number" && DIE_LADDER.some((die) => die === value)
}

export function stepUp(die: DieSides): DieSides {
  const index = DIE_LADDER.indexOf(die)
  return DIE_LADDER[Math.min(index + 1, DIE_LADDER.length - 1)]
}

export function stepDown(die: DieSides): DieSides {
  const index = DIE_LADDER.indexOf(die)
  return DIE_LADDER[Math.max(index - 1, 0)]
}

function rollDie(sides: DieSides, random: () => number): number {
  const sample = random()
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new RangeError("Random source must return a finite number in the range [0, 1).")
  }
  return Math.floor(sample * sides) + 1
}

/**
 * Overload lets a player double the value of any rolled die, but each
 * doubled die is spent from that Approach's dice pool until a Full Rest.
 * The pool size is the Approach rating; `spent` tracks how many of those
 * dice are currently unavailable because they were overloaded.
 */
export function clampOverloadSpent(rating: number, spent: number): number {
  if (!Number.isSafeInteger(rating) || rating < 0) {
    throw new RangeError("Approach rating must be a non-negative integer.")
  }
  return Math.min(Math.max(spent, 0), rating)
}

export function availableApproachDice(rating: number, spent: number): number {
  return rating - clampOverloadSpent(rating, spent)
}

/** Spends one die from the pool for Overload. Returns the new spent count, unchanged if the pool is already exhausted. */
export function spendOverloadDie(rating: number, spent: number): number {
  const current = clampOverloadSpent(rating, spent)
  return current >= rating ? current : current + 1
}

/** Full Rest restores the entire Approach dice pool. */
export function fullRestOverload(): number {
  return 0
}

/**
 * Negative Margin (a failed roll against Opposition) inflicts Wounds,
 * scaled to how badly the roll failed by. Table from the handbook:
 *   0–2   -> 1 Wound
 *   3–6   -> 2 Wounds
 *   7–12  -> 3 Wounds
 *   13–20 -> 4 Wounds
 * A non-negative Margin (success or tie) inflicts none. Anything beyond
 * 20 is treated the same as 13-20 (no higher tier specified).
 */
export function computeMarginWounds(margin: number): number {
  if (margin >= 0) return 0
  const magnitude = Math.abs(margin)
  if (magnitude <= 2) return 1
  if (magnitude <= 6) return 2
  if (magnitude <= 12) return 3
  return 4
}

/**
 * Flat, non-exploding dice roll — used for the Wound/Severity roll
 * (quantity = Margin, die size = Weapon Quality) and any other roll where
 * the individual die faces matter more than a summed total. No roll in
 * Collapse explodes.
 */
export function rollFlatDice(
  count: number,
  die: DieSides,
  random: () => number = Math.random
): number[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("Dice count must be a non-negative integer.")
  }
  return Array.from({ length: count }, () => rollDie(die, random))
}

/**
 * Rolls a Method's dice pool: count d10s, nothing Explodes, and the Total is
 * the single highest die rolled (not a sum). Overload (doubling a die's
 * value) is applied afterward by the caller/UI layer, since it's a player
 * choice made after seeing the roll.
 */
export function rollApproachDice(
  count: number,
  random: () => number = Math.random
): ApproachRollResult {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("Approach dice count must be a non-negative integer.")
  }

  const dice = Array.from({ length: count }, () => {
    const rolls = [rollDie(METHOD_DIE, random)]
    return {
      rolls,
      total: rolls[0],
    }
  })

  return {
    die: METHOD_DIE,
    dice,
    total: dice.reduce((max, result) => Math.max(max, result.total), 0),
  }
}
