import { describe, expect, it } from "vitest"
import { canAttachEngramType, startPlaySelection, toggleAttach, type ActivePlay } from "./playFlow"

const handCounts = { pyro: 3, shield: 2 }
const cardCosts = { pyro: 1, shield: 1 }
const capacity = 10

describe("canAttachEngramType", () => {
  it("allows any Engram when none is held", () => {
    expect(canAttachEngramType([], "pyro")).toBe(true)
  })

  it("allows more copies of the same held Engram (stacking)", () => {
    expect(canAttachEngramType(["pyro", "pyro"], "pyro")).toBe(true)
  })

  it("rejects a different Engram type while one is held", () => {
    expect(canAttachEngramType(["pyro"], "shield")).toBe(false)
  })
})

describe("toggleAttach with the single-active-Engram rule", () => {
  it("attaches the first copy of an Engram", () => {
    let play: ActivePlay = startPlaySelection(null, "base-1", 0)
    play = toggleAttach(play, "pyro", handCounts, cardCosts, capacity)
    expect(play?.mods).toEqual(["pyro"])
  })

  it("refuses to attach a different Engram type once one is held", () => {
    let play: ActivePlay = startPlaySelection(null, "base-1", 0)
    play = toggleAttach(play, "pyro", handCounts, cardCosts, capacity)
    play = toggleAttach(play, "shield", handCounts, cardCosts, capacity)
    expect(play?.mods).toEqual(["pyro"])
  })

  it("allows a different Engram after the held one is fully detached", () => {
    let play: ActivePlay = startPlaySelection(null, "base-1", 0)
    play = toggleAttach(play, "pyro", handCounts, cardCosts, capacity)
    play = toggleAttach(play, "pyro", handCounts, cardCosts, capacity) // detach (toggle off)
    play = toggleAttach(play, "shield", handCounts, cardCosts, capacity)
    expect(play?.mods).toEqual(["shield"])
  })
})
