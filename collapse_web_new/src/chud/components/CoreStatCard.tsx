import { useEffect, useRef, useState } from "react";

const COMMIT_FLASH_MS = 320;
// How far (px) the pointer must move vertically before a touch counts as a
// swipe instead of a tap. Below this, releasing commits the tap action
// (+1) instantly — no delay, no "wait and see if another tap follows".
const SWIPE_DEADZONE_PX = 8;
// Full swipe distance (px) required to commit the swipe action. Between
// the deadzone and this point, the card shows a live "if you let go now,
// this is what happens" pulse but nothing commits yet — matching the same
// "incomplete gesture does nothing" rule used by every other swipe in the
// app (e.g. the roll-result popup).
const SWIPE_COMMIT_PX = 28;

type DragState = null | "remove" | "open";
type CommitFlash = null | "add" | "remove";

// Core Stat card: tap = +1 (raise the pool) instantly, swipe down = -1,
// swipe up = open the Approach distribution popout for this stat. Replaces
// the old tap/double-tap/triple-tap timing window (every tap used to wait
// 500ms to see if more taps followed, and -1 needed three precisely-timed
// taps) — a tap now always commits the moment you lift your finger, which
// is what "instant" means on a phone.
export function CoreStatCard({
  label,
  value,
  onIncr,
  onDecr,
  onOpenDistribution,
}: {
  label: string;
  value: number;
  onIncr: () => void;
  onDecr: () => void;
  onOpenDistribution: () => void;
}) {
  const [dragState, setDragState] = useState<DragState>(null);
  const [commitFlash, setCommitFlash] = useState<CommitFlash>(null);
  const startY = useRef(0);
  const startX = useRef(0);
  const dragging = useRef(false);
  const commitFlashTimer = useRef<number | null>(null);

  const flashCommit = (kind: "add" | "remove") => {
    if (commitFlashTimer.current !== null) window.clearTimeout(commitFlashTimer.current);
    setCommitFlash(kind);
    commitFlashTimer.current = window.setTimeout(() => {
      commitFlashTimer.current = null;
      setCommitFlash(null);
    }, COMMIT_FLASH_MS);
  };

  useEffect(
    () => () => {
      if (commitFlashTimer.current !== null) window.clearTimeout(commitFlashTimer.current);
    },
    []
  );

  const handlePointerDown = (event: React.PointerEvent) => {
    dragging.current = true;
    startX.current = event.clientX;
    startY.current = event.clientY;
    setDragState(null);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!dragging.current) return;
    const dy = event.clientY - startY.current;
    const dx = event.clientX - startX.current;
    if (Math.abs(dy) < SWIPE_DEADZONE_PX || Math.abs(dy) < Math.abs(dx)) {
      setDragState(null);
      return;
    }
    setDragState(dy > 0 ? "remove" : "open");
  };

  const endDrag = () => {
    dragging.current = false;
    setDragState(null);
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (!dragging.current) return;
    const dy = event.clientY - startY.current;
    const dx = event.clientX - startX.current;
    const swipedFar = Math.abs(dy) >= SWIPE_COMMIT_PX && Math.abs(dy) >= Math.abs(dx);
    endDrag();
    if (!swipedFar) {
      if (Math.abs(dy) < SWIPE_DEADZONE_PX && Math.abs(dx) < SWIPE_DEADZONE_PX) {
        // Barely moved at all — a plain tap, commits instantly.
        onIncr();
        flashCommit("add");
      }
      // Moved past the deadzone but short of the full swipe — an
      // incomplete gesture, same as elsewhere in the app: no action.
      return;
    }
    if (dy > 0) {
      onDecr();
      flashCommit("remove");
    } else {
      onOpenDistribution();
    }
  };

  return (
    <div
      className={`core-card interactive${dragState === "remove" ? " tap-pending-remove" : ""}${dragState === "open" ? " tap-pending-open" : ""}${commitFlash ? ` tap-flash-${commitFlash}` : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`${label} ${value}. Tap to increase, swipe down to decrease, swipe up to distribute into Methods.`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="core-label">{label}</span>
      <div className="core-controls">
        <span className="core-value">{value}</span>
      </div>
    </div>
  );
}

