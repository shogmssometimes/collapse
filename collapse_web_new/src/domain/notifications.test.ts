import { beforeEach, describe, expect, it } from "vitest";
import { hasPendingNotification, listNotifications, queueHpZeroNotificationsIfNeeded } from "./notifications";

// Minimal localStorage + window.dispatchEvent polyfill — this module is
// normally loaded in a browser (CHUD iframe) or jsdom-less Node test here,
// so we stub just enough of `window` for its try/catch-wrapped read()/write()
// to actually persist between calls within a test.
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

beforeEach(() => {
  installFakeWindow();
});

describe("queueHpZeroNotificationsIfNeeded", () => {
  it("does nothing when HP doesn't cross from >0 to <=0", () => {
    expect(queueHpZeroNotificationsIfNeeded(5, 3, true)).toBe(false);
    expect(listNotifications()).toHaveLength(0);

    expect(queueHpZeroNotificationsIfNeeded(0, 0, true)).toBe(false);
    expect(listNotifications()).toHaveLength(0);
  });

  it("queues hp-zero and choose-path, and reports hasBeenDownedBefore should flip true the first time", () => {
    const shouldFlip = queueHpZeroNotificationsIfNeeded(1, 0, false);
    expect(shouldFlip).toBe(true);
    expect(hasPendingNotification("hp-zero")).toBe(true);
    expect(hasPendingNotification("choose-path")).toBe(true);
  });

  it("only queues hp-zero (not choose-path again) once already downed before", () => {
    const shouldFlip = queueHpZeroNotificationsIfNeeded(1, 0, true);
    expect(shouldFlip).toBe(false);
    expect(hasPendingNotification("hp-zero")).toBe(true);
    expect(hasPendingNotification("choose-path")).toBe(false);
  });

  it("doesn't queue a duplicate hp-zero notification if one is already pending", () => {
    queueHpZeroNotificationsIfNeeded(1, 0, true);
    queueHpZeroNotificationsIfNeeded(1, 0, true);
    expect(listNotifications().filter((n) => n.kind === "hp-zero")).toHaveLength(1);
  });
});
