import { describe, expect, it } from "vitest";
import { computeWardrobeBonuses } from "./wardrobeBonus";

describe("computeWardrobeBonuses", () => {
  it("sums one item's quality bonus onto its assigned Approach", () => {
    const { bonus, items } = computeWardrobeBonuses([
      { name: "Silver Cloak", approach: "Finesse", quality: "+2" },
    ]);
    expect(bonus.finesse).toBe(2);
    expect(items.finesse).toEqual(["Silver Cloak (+2)"]);
  });

  it("sums multiple items assigned to the same Approach", () => {
    const { bonus, items } = computeWardrobeBonuses([
      { name: "Silver Cloak", approach: "Finesse", quality: "+2" },
      { name: "Gloves", approach: "Finesse", quality: "+1" },
    ]);
    expect(bonus.finesse).toBe(3);
    expect(items.finesse).toEqual(["Silver Cloak (+2)", "Gloves (+1)"]);
  });

  it("keeps different Approaches separate", () => {
    const { bonus } = computeWardrobeBonuses([
      { name: "Silver Cloak", approach: "Finesse", quality: "+2" },
      { name: "Boots", approach: "Force", quality: "+1" },
    ]);
    expect(bonus.finesse).toBe(2);
    expect(bonus.force).toBe(1);
  });

  it("ignores rows with no Approach, no quality, or an invalid Approach", () => {
    const { bonus } = computeWardrobeBonuses([
      { name: "Empty", approach: "", quality: "+2" },
      { name: "No Quality", approach: "Finesse", quality: "" },
      { name: "Bogus", approach: "NotAnApproach", quality: "+2" },
    ]);
    expect(bonus).toEqual({});
  });

  it("names an unnamed item in the tooltip list", () => {
    const { items } = computeWardrobeBonuses([
      { name: "", approach: "Finesse", quality: "+2" },
    ]);
    expect(items.finesse).toEqual(["Unnamed item (+2)"]);
  });
});
