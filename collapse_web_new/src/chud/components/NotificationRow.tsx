import { useEffect, useRef, useState } from "react";
import type { PendingNotification } from "../../domain/notifications";

const HOLD_MS = 600;
const TAP_RESET_MS = 30000;

/**
 * One notification's gesture row: long-press to accept, triple-tap (within
 * 30s of the first tap) to cancel. Mirrors the hold-progress-fill and
 * "N/3" tap-hint patterns already used by the Save modal / Dir button.
 */
export function NotificationRow({
  notification,
  onAccept,
  onCancel,
}: {
  notification: PendingNotification;
  onAccept: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const [pressing, setPressing] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const holdTimer = useRef<number | null>(null);
  const tapResetTimer = useRef<number | null>(null);

  const clearHold = () => {
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setPressing(false);
  };

  const resetTaps = () => {
    if (tapResetTimer.current != null) {
      window.clearTimeout(tapResetTimer.current);
      tapResetTimer.current = null;
    }
    setTapCount(0);
  };

  useEffect(() => () => {
    clearHold();
    resetTaps();
  }, []);

  const onPointerDown = () => {
    setPressing(true);
    holdTimer.current = window.setTimeout(() => {
      clearHold();
      resetTaps();
      onAccept(notification.id);
    }, HOLD_MS);
  };

  const onPointerUp = () => {
    const held = holdTimer.current != null;
    clearHold();
    if (!held) return; // timer already fired (accepted)
    // Quick release before the hold threshold — count towards triple-tap-cancel.
    const next = tapCount + 1;
    if (next >= 3) {
      resetTaps();
      onCancel(notification.id);
      return;
    }
    setTapCount(next);
    if (tapResetTimer.current != null) window.clearTimeout(tapResetTimer.current);
    tapResetTimer.current = window.setTimeout(resetTaps, TAP_RESET_MS);
  };

  return (
    <div
      className="notification-row"
      style={{ ["--hold-progress-ms" as string]: `${HOLD_MS}ms` } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={clearHold}
      onPointerCancel={clearHold}
    >
      <span className={`hold-progress-fill${pressing ? " active" : ""}`} aria-hidden="true" />
      <div className="notification-row-text">
        <strong>{notification.label}</strong>
        <span className="notification-row-detail">{notification.detail}</span>
      </div>
      <span className="notification-row-hint">
        {tapCount > 0 ? `${tapCount}/3 to cancel` : "hold to accept · triple-tap to cancel"}
      </span>
    </div>
  );
}
