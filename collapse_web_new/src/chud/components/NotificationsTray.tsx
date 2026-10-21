import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { notificationAccentColor, type PendingNotification } from "../../domain/notifications";
import { NotificationRow } from "./NotificationRow";

/**
 * Header bell + dropdown listing every pending notification (HP hitting 0,
 * Dig Deep, etc.). Each row is long-press-to-accept / triple-tap-to-cancel;
 * resolving one unlocks whatever area queued it. The dropdown is portaled to
 * document.body and centered on the viewport (with a dimming backdrop) so it
 * always paints above every widget, including ones carrying their own
 * touch-blocker overlay, and stays reachable regardless of header width.
 */
export function NotificationsTray({
  notifications,
  onAccept,
  onCancel,
  onTapRecorded,
  onChoice,
}: {
  notifications: PendingNotification[];
  onAccept: (id: string) => void;
  onCancel: (id: string) => void;
  onTapRecorded?: () => void;
  onChoice?: (id: string, key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = notifications.length;

  // Newest first, independent of storage order, so the new→old accent
  // gradient (and the visual stacking order) are always consistent.
  const ordered = useMemo(
    () => [...notifications].sort((a, b) => b.createdAt - a.createdAt),
    [notifications]
  );

  return (
    <div className="notifications-tray">
      <button
        type="button"
        className="notifications-bell"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications (${count} pending)`}
        aria-expanded={open}
      >
        <span aria-hidden="true">🔔</span>
        {count > 0 ? <span className="notifications-badge">{count}</span> : null}
      </button>
      {open
        ? createPortal(
            <div className="notifications-backdrop" onClick={() => setOpen(false)}>
              <div className="notifications-dropdown notifications-dropdown-centered" onClick={(e) => e.stopPropagation()}>
                {count === 0 ? (
                  <div className="notifications-empty">No pending notifications.</div>
                ) : (
                  ordered.map((n, index) => (
                    <NotificationRow
                      key={n.id}
                      notification={n}
                      onAccept={onAccept}
                      onCancel={onCancel}
                      onTapRecorded={onTapRecorded}
                      onChoice={onChoice}
                      accentColor={notificationAccentColor(index, ordered.length)}
                    />
                  ))
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

