import { useEffect, useRef, useState } from "react";

const LONG_PRESS_MS = 550;
const TAP_WINDOW_MS = 500;
const COMMIT_FLASH_MS = 320;

type TapStage = 0 | 1 | 2;
type CommitFlash = null | "add" | "remove";

// Core Stat card: tap = +1 (raise the pool), triple-tap = -1, long-press =
// open the Approach distribution popout for this stat.
//
// Both tap paths take a moment to confirm (so a single tap can still
// become a triple-tap), so the card visually tracks where it is in that
// sequence rather than just silently waiting:
//   tap 1 → cyan pulse, "this will add 1 if you stop tapping"
//   tap 2 → red pulse, "the add is cancelled; this will remove 1 if you
//           tap once more" (letting the window lapse here does nothing —
//           2 taps alone was never a real input)
//   tap 3 → commits the remove immediately
// A brief solid flash (cyan for add, red for remove) confirms the moment
// a change actually lands, since the pending pulse stops as soon as it
// commits.
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
  const [pressing, setPressing] = useState(false);
  const [tapStage, setTapStage] = useState<TapStage>(0);
  const [commitFlash, setCommitFlash] = useState<CommitFlash>(null);
  const longPressTimer = useRef<number | null>(null);
  const tapTimer = useRef<number | null>(null);
  const tapCount = useRef(0);
  const commitFlashTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setPressing(false);
  };

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
      if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
      if (tapTimer.current !== null) window.clearTimeout(tapTimer.current);
      if (commitFlashTimer.current !== null) window.clearTimeout(commitFlashTimer.current);
    },
    []
  );

  const handlePointerDown = () => {
    suppressClick.current = false;
    setPressing(true);
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      suppressClick.current = true;
      tapCount.current = 0;
      setTapStage(0);
      if (tapTimer.current !== null) {
        window.clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      setPressing(false);
      onOpenDistribution();
    }, LONG_PRESS_MS);
  };

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    tapCount.current += 1;
    if (tapTimer.current !== null) window.clearTimeout(tapTimer.current);

    if (tapCount.current >= 3) {
      tapCount.current = 0;
      tapTimer.current = null;
      setTapStage(0);
      onDecr();
      flashCommit("remove");
      return;
    }

    setTapStage(tapCount.current as TapStage)
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      const stageAtTimeout = tapCount.current
      tapCount.current = 0;
      setTapStage(0);
      if (stageAtTimeout === 1) {
        // Only a single tap landed in the window — commit the add. Two
        // taps landing (then nothing) is a cancelled add, not a real
        // input, so it resolves to no change.
        onIncr();
        flashCommit("add");
      }
    }, TAP_WINDOW_MS);
  };

  return (
    <div
      className={`core-card interactive${pressing ? " pressing" : ""}${tapStage === 1 ? " tap-pending-add" : ""}${tapStage === 2 ? " tap-pending-remove" : ""}${commitFlash ? ` tap-flash-${commitFlash}` : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`${label} ${value}. Tap to increase, triple-tap to decrease, long-press to distribute into Methods.`}
      onPointerDown={handlePointerDown}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onClick={handleClick}
      onContextMenu={(event) => event.preventDefault()}
      style={{ ["--hold-progress-ms" as string]: `${LONG_PRESS_MS}ms` } as React.CSSProperties}
    >
      <span className={`hold-progress-fill${pressing ? " active" : ""}`} aria-hidden="true" />
      <span className="core-label">{label}</span>
      <div className="core-controls">
        <span className="core-value">{value}</span>
      </div>
    </div>
  );
}

