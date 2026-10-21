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

export type NotificationKind = "hp-zero" | "dig-deep";

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
