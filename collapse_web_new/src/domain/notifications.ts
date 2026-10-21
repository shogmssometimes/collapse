// Shared notifications queue. Pure localStorage I/O (no React) so it can be
// imported by both the standalone AAG/MGR pages (outer app bundle) and the
// CHUD iframe app (separate bundle) — they're different JS realms but share
// the same origin, so plain localStorage reads/writes plus native "storage"
// events are enough to keep both sides in sync without any extra bridging.
//
// A notification represents a system-affecting change (HP hitting 0, a Dig
// Deep roll, etc.) that must be explicitly accepted (long-press) or
// cancelled (triple-tap) by the player instead of auto-applying. While one
// of a given `kind` is pending, the area that produced it is expected to
// refuse to queue another of the same kind until it's resolved.

export type NotificationKind = "hp-zero" | "dig-deep" | "grit-zero";

export type NotificationEffect = {
  hp?: number;
  grit?: number;
  collapse?: number;
};

export type PendingNotification = {
  id: string;
  kind: NotificationKind;
  label: string;
  detail: string;
  effect: NotificationEffect;
  createdAt: number;
  /** Triple-tap-to-cancel progress, shared across every rendering of this
   * notification (e.g. the outer header bell's dropdown AND the in-iframe
   * CollapseOverlay row show the *same* notification record) so a tap
   * started in one place counts towards cancelling it from another. */
  cancelTaps?: number;
  cancelTapAt?: number;
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
  effect: NotificationEffect
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
  };
  write([item, ...items]);
  return item;
}

/** Removes a notification by id — called after accept applies its effect,
 * or on cancel, which discards it with no effect applied. */
export function removeNotification(id: string): void {
  write(read().filter((n) => n.id !== id));
}

/**
 * Records one triple-tap-to-cancel tap against a notification's shared,
 * persisted progress (resetting first if the last tap was more than
 * `resetMs` ago), and returns the new tap count — or null if the
 * notification no longer exists (e.g. already resolved elsewhere).
 * Every rendering of the same notification reads/writes this same record,
 * so taps made in one place count towards cancelling it from another.
 */
export function recordCancelTap(id: string, resetMs: number): number | null {
  const items = read();
  const idx = items.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  const n = items[idx];
  const now = Date.now();
  const stale = typeof n.cancelTapAt !== "number" || now - n.cancelTapAt > resetMs;
  const nextTaps = stale ? 1 : (n.cancelTaps ?? 0) + 1;
  items[idx] = { ...n, cancelTaps: nextTaps, cancelTapAt: now };
  write(items);
  return nextTaps;
}
