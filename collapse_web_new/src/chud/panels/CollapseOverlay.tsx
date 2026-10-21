import type { PendingNotification } from "../../domain/notifications";
import { NotificationRow } from "../components/NotificationRow";

// Full-screen overlay shown when HP has dropped to 0 and the resulting
// hp-zero notification hasn't been resolved yet (accepted = apply +1
// Collapse and unlock, cancelled = unlock with no Collapse applied).
export function CollapseOverlay({
  notification,
  onAccept,
  onCancel,
}: {
  notification: PendingNotification | null;
  onAccept: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  if (!notification) return null;
  return (
    <div className="collapse-overlay">
      <div className="collapse-panel">
        <span className="collapse-eyebrow">Critical Status</span>
        <h3>You Have Collapsed</h3>
        <p className="collapse-copy">{notification.detail}</p>
        <NotificationRow notification={notification} onAccept={onAccept} onCancel={onCancel} />
      </div>
    </div>
  );
}
