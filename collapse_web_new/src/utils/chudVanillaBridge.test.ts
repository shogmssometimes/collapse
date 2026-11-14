import { beforeEach, describe, expect, it } from "vitest";
import { adjustGlobalMeters, adjustHpCounter, maxGritForCollapse, readGlobalMeters } from "./chudVanillaBridge";
import { hasPendingNotification, listNotifications } from "../domain/notifications";

// Minimal localStorage + window.dispatchEvent polyfill — same approach as
// notifications.test.ts, since this module is normally only exercised in a
// browser (the outer app's pages, with no live Chud.tsx instance mounted).
function installFakeWindow() {
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
    dispatchEvent: () => true,
  };
}

const STATE_KEY = "chud.state.v1";

beforeEach(() => {
  installFakeWindow();
});

describe("maxGritForCollapse", () => {
  it("is always 6 - Collapse, floored at 0", () => {
    expect(maxGritForCollapse(0)).toBe(6);
    expect(maxGritForCollapse(2)).toBe(4);
    expect(maxGritForCollapse(6)).toBe(0);
    expect(maxGritForCollapse(9)).toBe(0);
  });
});

describe("adjustGlobalMeters", () => {
  it("clamps Grit gains to the Collapse-reduced max, matching the Rest Widget's preview math", () => {
    // Regression for: Rest/Dig Deep notification text promising a Grit gain
    // that the Collapse-reduced max would silently swallow on accept.
    window.localStorage.setItem(
      "csmatrix.graph",
      JSON.stringify({ nodes: [], edges: [], meta: { globalMeters: { grit: 0, collapse: 6 } } })
    );

    adjustGlobalMeters({ grit: 1 });

    expect(readGlobalMeters().grit).toBe(0);
    expect(maxGritForCollapse(readGlobalMeters().collapse)).toBe(0);
  });
});

describe("adjustHpCounter", () => {
  it("queues the hp-zero (and first-time choose-path) notification when HP crosses to 0 from outside the CHUD iframe", () => {
    // Regression test for: reaching 0 HP via a Rest/Dig Deep notification
    // accepted from the outer app's header bell (a separate route from the
    // HUD, so no live Chud.tsx instance exists to notice the transition)
    // used to silently skip the whole Down flow.
    window.localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ hpCounter: 1, core: { vigor: 2, inference: 0, personality: 0 }, hasBeenDownedBefore: false })
    );

    adjustHpCounter(-2, STATE_KEY);

    const saved = JSON.parse(window.localStorage.getItem(STATE_KEY) || "{}");
    expect(saved.hpCounter).toBe(0);
    expect(saved.hasBeenDownedBefore).toBe(true);
    expect(hasPendingNotification("hp-zero")).toBe(true);
    expect(hasPendingNotification("choose-path")).toBe(true);
  });

  it("clamps HP to the slot's derived max instead of growing unbounded", () => {
    window.localStorage.setItem(STATE_KEY, JSON.stringify({ hpCounter: 5, core: { vigor: 1, inference: 0, personality: 0 } }));

    adjustHpCounter(999, STATE_KEY);

    const saved = JSON.parse(window.localStorage.getItem(STATE_KEY) || "{}");
    expect(saved.hpCounter).toBeLessThan(999);
  });

  it("does not re-queue hp-zero or choose-path once already downed before", () => {
    window.localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ hpCounter: 1, core: { vigor: 2, inference: 0, personality: 0 }, hasBeenDownedBefore: true })
    );

    adjustHpCounter(-5, STATE_KEY);

    expect(hasPendingNotification("hp-zero")).toBe(true);
    expect(hasPendingNotification("choose-path")).toBe(false);
    expect(listNotifications().filter((n) => n.kind === "hp-zero")).toHaveLength(1);
  });
});
