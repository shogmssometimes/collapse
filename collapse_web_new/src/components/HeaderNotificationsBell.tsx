import { useCallback, useEffect, useState } from "react";
import { NotificationsTray } from "../chud/components/NotificationsTray";
import {
  NOTIFICATIONS_STORAGE_KEY,
  listNotifications,
  removeNotification,
  type PendingNotification,
} from "../domain/notifications";
import { adjustGlobalMeters, adjustHpCounter } from "../utils/chudVanillaBridge";
import { chudStateKey } from "../utils/slotKeys";

/**
 * Outer-app header bell for the shared notifications queue (HP hitting 0,
 * Dig Deep, etc). Lives in the main app window rather than the CHUD iframe,
 * so it reads/writes the same localStorage-backed queue directly and
 * applies accepted effects straight to the active slot's storage (there's
 * no live Chud.tsx instance in this window to delegate to).
 */
export function HeaderNotificationsBell({ charSlot }: { charSlot: number }) {
  const [notifications, setNotifications] = useState<PendingNotification[]>(() => listNotifications());

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== NOTIFICATIONS_STORAGE_KEY) return;
      setNotifications(listNotifications());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const resolve = useCallback(
    (id: string, accept: boolean) => {
      const n = notifications.find((item) => item.id === id);
      if (n && accept) {
        if (n.effect.hp) adjustHpCounter(n.effect.hp, chudStateKey(charSlot));
        if (n.effect.grit != null || n.effect.collapse != null) {
          adjustGlobalMeters({ grit: n.effect.grit, collapse: n.effect.collapse });
        }
      }
      removeNotification(id);
      setNotifications(listNotifications());
    },
    [notifications, charSlot]
  );

  return (
    <NotificationsTray
      notifications={notifications}
      onAccept={(id) => resolve(id, true)}
      onCancel={(id) => resolve(id, false)}
    />
  );
}
