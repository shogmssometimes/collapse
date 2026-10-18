import { describe, expect, it } from "vitest"
import {
  canEquip,
  capacityUsed,
  fullRestEngram,
  maxRollableDice,
  rollEngramDice,
  shortRestEngram,
  spendCharges,
  type EngramDef,
  type EquippedEngram,
} from "./engrams"

function sequence(...values: number[]): () => number {
  let index = 0
  return () => {
    const value = values[index]
    index += 1
    if (value === undefined) throw new Error("Random sequence exhausted.")
    return value
  }
}

const PYRO: EngramDef = { id: "pyro", name: "Pyrokinesis", level: 2, activation: "standard", maxCharges: 3 }
const SHIELD: EngramDef = { id: "shield", name: "Null Shield", level: 3, activation: "hold", maxCharges: 2 }
const DEFS: Record<string, EngramDef> = { pyro: PYRO, shield: SHIELD }

describe("Engram capacity", () => {
  it("sums Level × copies across equipped Engrams", () => {
    const equipped: EquippedEngram[] = [
      { defId: "pyro", copies: 2, charges: 3 },
      { defId: "shield", copies: 1, charges: 2 },
    ]
    expect(capacityUsed(equipped, DEFS)).toBe(2 * 2 + 3 * 1)
  })

  it("allows equipping only while within Capacity", () => {
    const equipped: EquippedEngram[] = [{ defId: "pyro", copies: 2, charges: 3 }]
    expect(canEquip(equipped, DEFS, 10, SHIELD, 2)).toBe(true) // 4 + 6 = 10
    expect(canEquip(equipped, DEFS, 9, SHIELD, 2)).toBe(false) // 4 + 6 = 10 > 9
  })
})

describe("Engram dice", () => {
  it("rolls flat d4s that never explode", () => {
    const result = rollEngramDice(3, sequence(0.999, 0.5, 0))
    expect(result.dice).toEqual([4, 3, 1])
    expect(result.total).toBe(8)
  })

  it("lets the player choose how many of their copies to roll, capped by copies and charges", () => {
    expect(maxRollableDice({ defId: "pyro", copies: 3, charges: 3 })).toBe(3)
    expect(maxRollableDice({ defId: "pyro", copies: 3, charges: 1 })).toBe(1)
    expect(maxRollableDice({ defId: "pyro", copies: 1, charges: 3 })).toBe(1)
  })
})

describe("Engram charges", () => {
  it("spends charges down to zero, never negative", () => {
    const engram: EquippedEngram = { defId: "pyro", copies: 2, charges: 2 }
    expect(spendCharges(engram, 1).charges).toBe(1)
    expect(spendCharges(engram, 5).charges).toBe(0)
  })

  it("recovers 1d4 charges on a Short Rest, capped at max", () => {
    const engram: EquippedEngram = { defId: "pyro", copies: 2, charges: 1 }
    expect(shortRestEngram(engram, PYRO, sequence(0.5)).charges).toBe(3) // 1 + 2, capped at 3
    expect(shortRestEngram(engram, PYRO, sequence(0.999)).charges).toBe(3) // 1 + 4, capped at 3
  })

  it("fully restores charges on a Full Rest", () => {
    const engram: EquippedEngram = { defId: "shield", copies: 1, charges: 0 }
    expect(fullRestEngram(engram, SHIELD).charges).toBe(2)
  })
})
