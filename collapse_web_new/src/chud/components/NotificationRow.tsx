import { useEffect, useRef, useState } from "react";
import type { PendingNotification } from "../../domain/notifications";
import { recordCancelTap } from "../../domain/notifications";

const HOLD_MS = 600;
const TAP_RESET_MS = 15000;

/**
 * One notification's gesture row: long-press to accept, triple-tap (within
 * 15s of the first tap) to cancel. The tap count lives on the shared,
 * persisted notification record (see recordCancelTap) rather than local
 * component state, so a notification rendered in two places at once (the
 * outer header bell's dropdown AND the in-iframe CollapseOverlay row) keeps
 * a single shared cancel progress instead of each copy tracking its own.
 */
export function NotificationRow({
  notification,
  onAccept,
  onCancel,
  onTapRecorded,
  onChoice,
}: {
  notification: PendingNotification;
  onAccept: (id: string) => void;
  onCancel: (id: string) => void;
  /** Called after a non-cancelling tap is recorded, so the owner can
   * refresh its notifications list and flow the updated tap count back
   * down as a prop (needed for same-window, same-render-tree updates —
   * cross-window copies pick it up via the existing storage listener). */
  onTapRecorded?: () => void;
  /** Called when a choice-style notification's button is tapped (see
   * `notification.choices`). Not used for ordinary accept/cancel rows. */
  onChoice?: (id: string, key: string) => void;
}) {
  const [pressing, setPressing] = useState(false);
  const [, forceTick] = useState(0);
  const holdTimer = useRef<number | null>(null);
  const staleTimer = useRef<number | null>(null);

  const now = Date.now();
  const tapsStale = typeof notification.cancelTapAt !== "number" || now - notification.cancelTapAt > TAP_RESET_MS;
  const displayTaps = tapsStale ? 0 : notification.cancelTaps ?? 0;

  const clearHold = () => {
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setPressing(false);
  };

  // Force a re-render once the current tap streak goes stale, so the "N/3"
  // hint reverts to idle even if the user never taps again.
  useEffect(() => {
    if (staleTimer.current != null) {
      window.clearTimeout(staleTimer.current);
      staleTimer.current = null;
    }
    if (!tapsStale && typeof notification.cancelTapAt === "number") {
      const remaining = TAP_RESET_MS - (Date.now() - notification.cancelTapAt);
      staleTimer.current = window.setTimeout(() => forceTick((v) => v + 1), Math.max(0, remaining));
    }
    return () => {
      if (staleTimer.current != null) window.clearTimeout(staleTimer.current);
    };
  }, [notification.cancelTapAt, tapsStale]);

  useEffect(() => () => clearHold(), []);

  const onPointerDown = () => {
    setPressing(true);
    holdTimer.current = window.setTimeout(() => {
      clearHold();
      onAccept(notification.id);
    }, HOLD_MS);
  };

  const onPointerUp = () => {
    const held = holdTimer.current != null;
    clearHold();
    if (!held) return; // timer already fired (accepted)
    // Quick release before the hold threshold — count towards triple-tap-cancel.
    const next = recordCancelTap(notification.id, TAP_RESET_MS);
    if (next == null) return; // already resolved elsewhere between pointerdown/up
    if (next >= 3) {
      onCancel(notification.id);
      return;
    }
    onTapRecorded?.();
  };

  // Choice-style notifications (e.g. "Choose Your Path") skip the
  // hold/triple-tap gesture entirely in favor of a row of buttons.
  if (notification.choices) {
    return (
      <div className="notification-row notification-row-choice">
        <div className="notification-row-text">
          <strong>{notification.label}</strong>
          <span className="notification-row-detail">{notification.detail}</span>
        </div>
        <div className="notification-row-choices">
          {notification.choices.map((choice) => (
            <button
              key={choice.key}
              type="button"
              className="notification-choice-btn"
              onClick={() => onChoice?.(notification.id, choice.key)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

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
        {displayTaps > 0 ? `${displayTaps}/3 to cancel` : "hold to accept · triple-tap to cancel"}
      </span>
    </div>
  );
}
