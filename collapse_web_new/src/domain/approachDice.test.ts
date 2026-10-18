import { describe, expect, it } from "vitest"
import {
  availableApproachDice,
  DEFAULT_DIE_SIZE,
  DIE_LADDER,
  fullRestOverload,
  isDieSides,
  rollApproachDice,
  spendOverloadDie,
  stepDown,
  stepUp,
} from "./approachDice"

function sequence(...values: number[]): () => number {
  let index = 0
  return () => {
    const value = values[index]
    index += 1
    if (value === undefined) throw new Error("Random sequence exhausted.")
    return value
  }
}

describe("Approach dice", () => {
  it("defaults to D8 and steps through the shared die-size ladder", () => {
    expect(DEFAULT_DIE_SIZE).toBe(8)
    expect(DIE_LADDER.map(stepUp)).toEqual([6, 8, 10, 12, 20, 20])
    expect(DIE_LADDER.map(stepDown)).toEqual([4, 4, 6, 8, 10, 12])
  })

  it("recognizes valid persisted die sizes", () => {
    expect(isDieSides(8)).toBe(true)
    expect(isDieSides(7)).toBe(false)
    expect(isDieSides("8")).toBe(false)
  })

  it("rolls a number of dice equal to the Approach rating", () => {
    const result = rollApproachDice(3, 8, sequence(0, 0.25, 0.5))

    expect(result.dice.map((die) => die.rolls)).toEqual([[1], [3], [5]])
    expect(result.total).toBe(9)
  })

  it("explodes each Approach die once on its maximum", () => {
    const result = rollApproachDice(2, 6, sequence(0.999, 0.5, 0.999, 0.999))

    expect(result.dice.map((die) => die.rolls)).toEqual([[6, 4], [6, 6]])
    expect(result.total).toBe(22)
  })

  it("allows an Approach rating of zero and rejects invalid counts", () => {
    expect(rollApproachDice(0, 8, sequence()).total).toBe(0)
    expect(() => rollApproachDice(-1, 8)).toThrow(/non-negative integer/)
    expect(() => rollApproachDice(1.5, 8)).toThrow(/non-negative integer/)
  })

  it("rejects invalid random samples instead of returning invalid rolls", () => {
    expect(() => rollApproachDice(1, 8, () => 1)).toThrow(/Random source/)
  })

  it("tracks an Overload dice pool that depletes down to zero and clamps", () => {
    let spent = 0
    expect(availableApproachDice(3, spent)).toBe(3)
    spent = spendOverloadDie(3, spent)
    spent = spendOverloadDie(3, spent)
    expect(spent).toBe(2)
    expect(availableApproachDice(3, spent)).toBe(1)
    spent = spendOverloadDie(3, spent)
    spent = spendOverloadDie(3, spent) // pool already empty, no further change
    expect(spent).toBe(3)
    expect(availableApproachDice(3, spent)).toBe(0)
  })

  it("restores the Overload pool on a Full Rest", () => {
    expect(fullRestOverload()).toBe(0)
  })

  it("rejects an invalid Approach rating when checking the Overload pool", () => {
    expect(() => availableApproachDice(-1, 0)).toThrow(/non-negative integer/)
  })
})
