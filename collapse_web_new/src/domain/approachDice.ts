export type DieSides = 4 | 6 | 8 | 10 | 12 | 20

export const DIE_LADDER: readonly DieSides[] = [4, 6, 8, 10, 12, 20]
export const DEFAULT_DIE_SIZE: DieSides = 8

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
 * Flat, non-exploding dice roll — used for the Damage roll (quantity =
 * Margin) and any other "severity" style roll where the individual die
 * faces matter more than a summed total. Only the initial Resolution
 * (Approach) roll explodes.
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

export function rollApproachDice(
  count: number,
  die: DieSides,
  random: () => number = Math.random
): ApproachRollResult {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("Approach dice count must be a non-negative integer.")
  }

  const dice = Array.from({ length: count }, () => {
    const rolls = [rollDie(die, random)]
    if (rolls[0] === die) rolls.push(rollDie(die, random))
    return {
      rolls,
      total: rolls.reduce((sum, result) => sum + result, 0),
    }
  })

  return {
    die,
    dice,
    total: dice.reduce((sum, result) => sum + result.total, 0),
  }
}
