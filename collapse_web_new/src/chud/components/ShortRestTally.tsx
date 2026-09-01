import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

const LONG_PRESS_MS = 600;

function readTally(key: string): number {
  try {
    const s = JSON.parse(window.localStorage.getItem(key) || "{}");
    const v = s.shortRestTally;
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function writeTally(key: string, value: number) {
  try {
    const raw = window.localStorage.getItem(key);
    const s = raw ? JSON.parse(raw) : {};
    s.shortRestTally = value;
    const json = JSON.stringify(s);
    window.localStorage.setItem(key, json);
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: json }));
  } catch {
    // storage unavailable — ignore
  }
}

// Classic 5-bar tally mark: up to 4 vertical strokes, plus a diagonal 5th.
function TallyGroup({ n }: { n: number }) {
  const barX = [3, 9, 15, 21];
  const shown = Math.min(n, 4);
  return (
    <svg className="chud-tally-group" width={26} height={20} viewBox="0 0 26 20">
      {barX.slice(0, shown).map((x) => (
        <line key={x} x1={x} y1={2} x2={x} y2={18} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      ))}
      {n >= 5 && (
        <line x1={1} y1={18} x2={23} y2={2} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      )}
    </svg>
  );
}

// Tally-mark counter (0-max, two groups of 5). Click increments and wraps
// back to 0 after reaching max.
export function ShortRestTally({ storageKey, max = 10 }: { storageKey: string; max?: number }) {
  const [count, setCount] = useState<number>(() =>
    typeof window !== "undefined" ? Math.max(0, Math.min(max, readTally(storageKey))) : 0
  );

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === storageKey) setCount(Math.max(0, Math.min(max, readTally(storageKey))));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [storageKey, max]);

  const handleClick = () => {
    const next = count >= max ? 0 : count + 1;
    setCount(next);
    writeTally(storageKey, next);
  };

  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = () => {
    longPressFired.current = false;
    clearLongPressTimer();
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      setCount(0);
      writeTally(storageKey, 0);
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = () => {
    clearLongPressTimer();
  };

  const handleClickCapture = (e: MouseEvent) => {
    if (longPressFired.current) {
      e.stopPropagation();
      e.preventDefault();
      longPressFired.current = false;
    }
  };

  return (
    <div
      className="chud-tally"
      onClick={handleClick}
      onClickCapture={handleClickCapture}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <span className="chud-tally-label">Short Rest</span>
      <div className="chud-tally-marks">
        <TallyGroup n={Math.max(0, Math.min(5, count))} />
        <TallyGroup n={Math.max(0, Math.min(5, count - 5))} />
      </div>
    </div>
  );
}
