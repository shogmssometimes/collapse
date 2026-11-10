import { useCallback, useEffect, useState } from "react";
import { NotificationsTray } from "../chud/components/NotificationsTray";
import {
  NOTIFICATIONS_STORAGE_KEY,
  listNotifications,
  pushNotification,
  removeNotification,
  type PendingNotification,
} from "../domain/notifications";
import { adjustGlobalMeters, adjustHpCounter, readCollapsePath, setChipDesynced, setCollapsePath, resetApproachOverload } from "../utils/chudVanillaBridge";
import { chudStateKey, deckBuilderKey } from "../utils/slotKeys";
import { fullRestEngrams, grantEngramRestoreBudget } from "../utils/engramState";

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
        if (n.effect.desync) setChipDesynced(true);
        if (n.effect.restoreOverload) resetApproachOverload(chudStateKey(charSlot));
        if (n.effect.fullEngramRestore) fullRestEngrams(deckBuilderKey(charSlot));
        if (n.effect.engramRestoreBudget) grantEngramRestoreBudget(deckBuilderKey(charSlot), n.effect.engramRestoreBudget);
        if (n.kind === "hp-zero") {
          const path = readCollapsePath(chudStateKey(charSlot));
          const pathLabel = path ? `${path[0].toUpperCase()}${path.slice(1)}` : null;
          pushNotification(
            "collapse-table",
            "Roll on Collapse Table",
            pathLabel
              ? `Roll on the "${pathLabel}" Collapse Table in the handbook.`
              : "Roll on the Collapse Table in the handbook.",
            {}
          );
        }
      }
      removeNotification(id);
      setNotifications(listNotifications());
    },
    [notifications, charSlot]
  );

  // "Choose Your Path" resolves via a button tap instead of accept/cancel —
  // persist the choice directly to the slot's CHUD state and clear it.
  const choose = useCallback(
    (id: string, key: string) => {
      const n = notifications.find((item) => item.id === id);
      if (n?.kind === "choose-path") {
        setCollapsePath(key, chudStateKey(charSlot));
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
      onChoice={choose}
    />
  );
}
