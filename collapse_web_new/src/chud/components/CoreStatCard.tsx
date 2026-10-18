import { useEffect, useRef, useState } from "react";

const LONG_PRESS_MS = 550;
const TRIPLE_TAP_MS = 500;

// Core Stat card: tap = +1 (raise the pool), triple-tap = -1, long-press =
// open the Approach distribution popout for this stat.
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
  const longPressTimer = useRef<number | null>(null);
  const tapTimer = useRef<number | null>(null);
  const tapCount = useRef(0);
  const suppressClick = useRef(false);

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setPressing(false);
  };

  useEffect(
    () => () => {
      if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
      if (tapTimer.current !== null) window.clearTimeout(tapTimer.current);
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
    if (tapCount.current === 3) {
      tapCount.current = 0;
      tapTimer.current = null;
      onDecr();
      return;
    }
    tapTimer.current = window.setTimeout(() => {
      tapCount.current = 0;
      tapTimer.current = null;
      onIncr();
    }, TRIPLE_TAP_MS);
  };

  return (
    <div
      className={`core-card interactive${pressing ? " pressing" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`${label} ${value}. Tap to increase, triple-tap to decrease, long-press to distribute into Approaches.`}
      onPointerDown={handlePointerDown}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onClick={handleClick}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="core-label">{label}</span>
      <div className="core-controls">
        <span className="core-value">{value}</span>
      </div>
    </div>
  );
}
