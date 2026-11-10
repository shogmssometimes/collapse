import { useEffect, useRef, useState } from "react";
import type { PendingNotification } from "../../domain/notifications";
import { STANDARD_LONG_PRESS_MS } from "../../utils/gestureConstants";

// How far (px) a horizontal drag must travel before it's treated as a
// cancel-swipe rather than noise under a long-press. Deliberately much
// larger than any other swipe threshold in the app (the roll-result popup
// uses 18px) — cancelling a notification is consequential, so it should
// take an unmistakably long, deliberate drag, not a quick flick.
const CANCEL_DRAG_DEADZONE_PX = 10;
const CANCEL_DRAG_COMMIT_PX = 120;

/**
 * One notification's gesture row: long-press to accept, a long swipe left
 * to cancel. Swiping follows the finger in real time (so the player can see
 * exactly how close they are to the cancel threshold, and let go to abort)
 * rather than committing based on a quick flick.
 */
export function NotificationRow({
  notification,
  onAccept,
  onCancel,
  onChoice,
  accentColor,
}: {
  notification: PendingNotification;
  onAccept: (id: string) => void;
  onCancel: (id: string) => void;
  /** Called when a choice-style notification's button is tapped (see
   * `notification.choices`). Not used for ordinary accept/cancel rows. */
  onChoice?: (id: string, key: string) => void;
  /** New→old gradient accent color for this row's position in the tray
   * (see notificationAccentColor); undefined falls back to the default
   * row styling (used by single-notification call sites like the
   * CollapseOverlay row, which don't need queue-position coloring). */
  accentColor?: string;
}) {
  const [pressing, setPressing] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const trackingDrag = useRef(false);

  const clearHold = () => {
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setPressing(false);
  };

  const endGesture = () => {
    clearHold();
    trackingDrag.current = false;
    setDragging(false);
    setDragX(0);
  };

  useEffect(() => () => clearHold(), []);

  const onPointerDown = (event: React.PointerEvent) => {
    startX.current = event.clientX;
    startY.current = event.clientY;
    trackingDrag.current = true;
    setPressing(true);
    holdTimer.current = window.setTimeout(() => {
      clearHold();
      trackingDrag.current = false;
      onAccept(notification.id);
    }, STANDARD_LONG_PRESS_MS);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!trackingDrag.current) return;
    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;
    if (!dragging) {
      if (Math.abs(dx) < CANCEL_DRAG_DEADZONE_PX || Math.abs(dx) < Math.abs(dy)) return;
      // Horizontal drag past the deadzone — this is a cancel-swipe, not a
      // long-press anymore.
      clearHold();
      setDragging(true);
    }
    setDragX(Math.min(0, dx));
  };

  const onPointerUp = () => {
    const wasDragging = dragging;
    const finalDragX = dragX;
    endGesture();
    if (wasDragging && Math.abs(finalDragX) >= CANCEL_DRAG_COMMIT_PX) {
      onCancel(notification.id);
    }
    // Anything short of the full drag, or a held-then-released-early tap,
    // does nothing — same "incomplete gesture = no-op" rule as every other
    // swipe in the app.
  };

  // Choice-style notifications (e.g. "Choose Your Path") skip the
  // hold/swipe gesture entirely in favor of a row of buttons.
  if (notification.choices) {
    return (
      <div
        className="notification-row notification-row-choice"
        style={accentColor ? ({ borderLeftColor: accentColor } as React.CSSProperties) : undefined}
      >
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
      className={`notification-row${dragging ? " dragging" : ""}`}
      style={
        {
          ["--hold-progress-ms" as string]: `${STANDARD_LONG_PRESS_MS}ms`,
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          touchAction: "pan-y",
          ...(accentColor ? { borderLeftColor: accentColor } : {}),
        } as React.CSSProperties
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={endGesture}
      onPointerCancel={endGesture}
    >
      <span className={`hold-progress-fill${pressing ? " active" : ""}`} aria-hidden="true" />
      <div className="notification-row-text">
        <strong>{notification.label}</strong>
        <span className="notification-row-detail">{notification.detail}</span>
        {notification.roll ? (
          <span className="notification-die-chip" aria-label={`Rolled d${notification.roll.die}: ${notification.roll.value}`}>
            d{notification.roll.die}: {notification.roll.value}
          </span>
        ) : null}
      </div>
      <span className="notification-row-hint">hold to accept · swipe left to cancel</span>
    </div>
  );
}
