import { describe, expect, it } from "vitest"
import {
  computeDerived,
  computeFumbleNumber,
  computeGanbareCharges,
  computeInventorySlots,
  computeSkillCount,
} from "./chudStats"

// Handbook's Phase 6 worked example (YOU/Vie): Vigor 4, Inference 3,
// Personality 2 → HP 13, Capacity 9, Readiness 6, Slots 4, Skills 3,
// Ganbare Charges 2, Fumble Number 9.
const EXAMPLE_CORE = { vigor: 4, inference: 3, personality: 2 }

describe("Derived Vitals", () => {
  it("computes HP (Max) = 6 + Vigor + Inference", () => {
    expect(computeDerived(EXAMPLE_CORE).hp).toBe(13)
    expect(computeDerived({ vigor: 0, inference: 0, personality: 0 }).hp).toBe(6)
  })

  it("computes Capacity = 4 + Inference + Personality", () => {
    expect(computeDerived(EXAMPLE_CORE).capacity).toBe(9)
    expect(computeDerived({ vigor: 0, inference: 0, personality: 0 }).capacity).toBe(4)
  })

  it("computes Readiness (RDY) = Vigor + Personality", () => {
    expect(computeDerived(EXAMPLE_CORE).readyness).toBe(6)
    expect(computeDerived({ vigor: 0, inference: 0, personality: 0 }).readyness).toBe(0)
  })

  it("computes Inventory Slots = Vigor", () => {
    expect(computeInventorySlots(EXAMPLE_CORE)).toBe(4)
  })

  it("computes Skills = Inference", () => {
    expect(computeSkillCount(EXAMPLE_CORE)).toBe(3)
  })

  it("computes Ganbare Charges = Personality", () => {
    expect(computeGanbareCharges(EXAMPLE_CORE)).toBe(2)
  })

  it("computes Fumble Number = V+I+P", () => {
    expect(computeFumbleNumber(EXAMPLE_CORE)).toBe(9)
  })
})
