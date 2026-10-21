import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PendingNotification } from "../../domain/notifications";
import { NotificationRow } from "./NotificationRow";

/**
 * Header bell + dropdown listing every pending notification (HP hitting 0,
 * Dig Deep, etc.). Each row is long-press-to-accept / triple-tap-to-cancel;
 * resolving one unlocks whatever area queued it. The dropdown is portaled to
 * document.body (fixed-positioned under the bell) so it always paints above
 * every widget, including ones carrying their own touch-blocker overlay.
 */
export function NotificationsTray({
  notifications,
  onAccept,
  onCancel,
}: {
  notifications: PendingNotification[];
  onAccept: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const bellRef = useRef<HTMLButtonElement | null>(null);
  const count = notifications.length;

  const toggleOpen = () => {
    if (!open && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  };

  return (
    <div className="notifications-tray">
      <button
        type="button"
        ref={bellRef}
        className="notifications-bell"
        onClick={toggleOpen}
        aria-label={`Notifications (${count} pending)`}
        aria-expanded={open}
      >
        <span aria-hidden="true">🔔</span>
        {count > 0 ? <span className="notifications-badge">{count}</span> : null}
      </button>
      {open && pos
        ? createPortal(
            <div
              className="notifications-dropdown"
              style={{ top: pos.top, right: pos.right }}
            >
              {count === 0 ? (
                <div className="notifications-empty">No pending notifications.</div>
              ) : (
                notifications.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    onAccept={onAccept}
                    onCancel={onCancel}
                  />
                ))
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
