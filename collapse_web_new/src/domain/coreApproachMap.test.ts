import { describe, expect, it } from "vitest";
import { clampApproachToCore, clampCore, STAT_AND_METHOD_MAX } from "./coreApproachMap";

// "Stats and Methods all max out at 6. Gear can temporarily exceed that
// maximum, but 6 will remain the maximum Stat or Method you can achieve."
describe("clampCore", () => {
  it("clamps each Core stat into [0, 6]", () => {
    expect(clampCore({ vigor: 9, inference: -3, personality: 6 })).toEqual({
      vigor: 6,
      inference: 0,
      personality: 6,
    });
  });

  it("leaves in-range values untouched", () => {
    expect(clampCore({ vigor: 4, inference: 0, personality: 6 })).toEqual({
      vigor: 4,
      inference: 0,
      personality: 6,
    });
  });

  it("exposes the cap as a constant", () => {
    expect(STAT_AND_METHOD_MAX).toBe(6);
  });
});

describe("clampApproachToCore combined with the Core cap", () => {
  it("never lets two linked Methods exceed a capped Core stat's pool", () => {
    const core = clampCore({ vigor: 9, inference: 0, personality: 0 });
    const approach = clampApproachToCore({ force: 9, finesse: 9, guts: 0, logic: 0, show: 0, tell: 0 }, core);
    expect(core.vigor).toBe(6);
    expect(approach.force + approach.finesse).toBeLessThanOrEqual(core.vigor);
  });
});
