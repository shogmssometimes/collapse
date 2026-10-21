// Global Combat/Roleplay rolling mode toggle. Pure localStorage I/O (no
// React) so both the CHUD iframe and the outer app can read it without any
// extra bridging — same pattern as src/domain/notifications.ts.
//
// Combat mode keeps the existing "margin of 0 desyncs your Chip" rule;
// Roleplay mode suppresses it entirely, since the desync rule only makes
// sense in a combat context.

export type RollMode = "combat" | "roleplay";

export const ROLL_MODE_STORAGE_KEY = "chud.rollMode.v1";

export function getRollMode(): RollMode {
  try {
    const raw = window.localStorage.getItem(ROLL_MODE_STORAGE_KEY);
    return raw === "roleplay" ? "roleplay" : "combat";
  } catch {
    return "combat";
  }
}

export function setRollMode(mode: RollMode): void {
  try {
    window.localStorage.setItem(ROLL_MODE_STORAGE_KEY, mode);
    window.dispatchEvent(
      new StorageEvent("storage", { key: ROLL_MODE_STORAGE_KEY, newValue: mode, storageArea: window.localStorage })
    );
  } catch {
    // storage unavailable — ignore
  }
}
