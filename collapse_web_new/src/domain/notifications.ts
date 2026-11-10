// Shared notifications queue. Pure localStorage I/O (no React) so it can be
// imported by both the standalone AAG/MGR pages (outer app bundle) and the
// CHUD iframe app (separate bundle) — they're different JS realms but share
// the same origin, so plain localStorage reads/writes plus native "storage"
// events are enough to keep both sides in sync without any extra bridging.
//
// A notification represents a system-affecting change (HP hitting 0, a Dig
// Deep roll, etc.) that must be explicitly accepted (long-press) or
// cancelled (swipe) by the player instead of auto-applying. While one of a
// given `kind` is pending, the area that produced it is expected to refuse
// to queue another of the same kind until it's resolved.

export type NotificationKind =
  | "hp-zero"
  | "dig-deep"
  | "grit-zero"
  | "desync"
  | "collapse-table"
  | "choose-path"
  | "short-rest-grit"
  | "short-rest-hp"
  | "short-rest-engrams"
  | "full-rest";

export type NotificationEffect = {
  hp?: number;
  grit?: number;
  collapse?: number;
  /** Flips the HUD's Chip Sync indicator to Desynced when accepted. */
  desync?: boolean;
  /** Full Rest: reset the Approach Overload pool (Method dice) to unspent. */
  restoreOverload?: boolean;
  /** Full Rest: refills every equipped Engram's charges to max. */
  fullEngramRestore?: boolean;
  /** Short Rest "Restore Engrams": how many Engram charges (from the 1d4
   * roll) the player may restore, distributed across any equipped Engram
   * of their choice in the Engram Manager rather than applied
   * automatically. */
  engramRestoreBudget?: number;
};

export type NotificationChoice = { key: string; label: string };

/** An embedded die roll (e.g. the 1d6 rolled when Grit hits 0), rendered as
 * a die chip matching the Approach Roll popup's look for visual consistency. */
export type NotificationRoll = { die: number; value: number };

export type PendingNotification = {
  id: string;
  kind: NotificationKind;
  label: string;
  detail: string;
  effect: NotificationEffect;
  createdAt: number;
  /** When present, this notification is rendered as a set of mutually
   * exclusive choice buttons (e.g. "Choose Your Path: Live/Survive/Die")
   * instead of the usual hold-to-accept/swipe-to-cancel gesture. */
  choices?: NotificationChoice[];
  /** An embedded die roll to display alongside the detail text. */
  roll?: NotificationRoll;
};

export const NOTIFICATIONS_STORAGE_KEY = "chud.notifications.v1";

type StoredShape = { items: PendingNotification[] };

function read(): PendingNotification[] {
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: StoredShape = JSON.parse(raw);
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function write(items: PendingNotification[]) {
  try {
    const json = JSON.stringify({ items } satisfies StoredShape);
    window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, json);
    // The native "storage" event only fires in other tabs/windows, not the
    // one that made the change — dispatch a synthetic copy so listeners
    // mounted in this same tab (e.g. the header bell) pick up the update
    // immediately instead of waiting for a reload or cross-tab write.
    try {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: NOTIFICATIONS_STORAGE_KEY,
          newValue: json,
          storageArea: window.localStorage,
        })
      );
    } catch {
      // StorageEvent construction can fail in non-browser test environments — ignore.
    }
  } catch {
    // storage unavailable — ignore
  }
}

export function listNotifications(): PendingNotification[] {
  return read();
}

export function hasPendingNotification(kind: NotificationKind): boolean {
  return read().some((n) => n.kind === kind);
}

/**
 * Queues a new notification unless one of the same `kind` is already
 * pending — callers should treat that as "area is locked" and no-op.
 * Returns the created notification, or null if one was already pending.
 */
export function pushNotification(
  kind: NotificationKind,
  label: string,
  detail: string,
  effect: NotificationEffect,
  options?: { choices?: NotificationChoice[]; roll?: NotificationRoll }
): PendingNotification | null {
  const items = read();
  if (items.some((n) => n.kind === kind)) return null;
  const item: PendingNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    label,
    detail,
    effect,
    createdAt: Date.now(),
    ...(options?.choices ? { choices: options.choices } : {}),
    ...(options?.roll ? { roll: options.roll } : {}),
  };
  write([item, ...items]);
  return item;
}

/** Removes a notification by id — called after accept applies its effect,
 * or on cancel, which discards it with no effect applied. */
export function removeNotification(id: string): void {
  write(read().filter((n) => n.id !== id));
}

// "Fresh" (just queued) vs "aging" (pending a while, sitting behind newer
// ones) accent colors — interpolated between so the tray's notifications
// read as an ordered queue at a glance instead of a flat list.
const NOTIFICATION_NEW_RGB = { r: 56, g: 189, b: 248 }; // sky-400
const NOTIFICATION_OLD_RGB = { r: 244, g: 63, b: 94 }; // rose-500

/**
 * Returns an `rgb()` color for a notification at `index` within a list of
 * `total` pending notifications (index 0 = newest), interpolated between a
 * "new" and an "old" color so position in the queue is visible at a glance.
 */
export function notificationAccentColor(index: number, total: number): string {
  const t = total <= 1 ? 0 : Math.min(1, Math.max(0, index / (total - 1)));
  const r = Math.round(NOTIFICATION_NEW_RGB.r + (NOTIFICATION_OLD_RGB.r - NOTIFICATION_NEW_RGB.r) * t);
  const g = Math.round(NOTIFICATION_NEW_RGB.g + (NOTIFICATION_OLD_RGB.g - NOTIFICATION_NEW_RGB.g) * t);
  const b = Math.round(NOTIFICATION_NEW_RGB.b + (NOTIFICATION_OLD_RGB.b - NOTIFICATION_NEW_RGB.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}
