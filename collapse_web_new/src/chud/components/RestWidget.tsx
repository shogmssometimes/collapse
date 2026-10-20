import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ApproachStats } from "../../types/chud";

const APPROACH_FIELDS: Array<keyof ApproachStats> = ["force", "finesse", "guts", "logic", "show", "tell"];

const SWIPE_THRESHOLD_PX = 40;

type DigDeepResult = { d1: number; d2: number; lose: number; gain: number; ts: number };

function readState(storageKey: string): Record<string, unknown> {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
}

function writeState(storageKey: string, patch: Record<string, unknown>) {
  try {
    const next = { ...readState(storageKey), ...patch };
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // storage unavailable — ignore
  }
}

const tallyMarks = (count: number) => {
  // Five bars per group; a diagonal slash closes out each completed group of
  // five (classic tally-mark counting), mirroring the HUD's old widget.
  const groups: number[] = [];
  let remaining = Math.max(0, Math.min(10, count));
  while (remaining > 0) {
    groups.push(Math.min(5, remaining));
    remaining -= 5;
  }
  return groups;
};

// Short Rest tally / Dig Deep / Full Rest — moved here (bottom of the AAG
// page) from the HUD. None of this adjudicates anything: Short Rest just
// counts how many have been taken, Dig Deep rolls the lose/gain pair and
// leaves it up to the player to apply, and Full Rest restores the Approach
// Overload pool. The Dig Deep result shows as a popup immediately after the
// roll; closing it clears it for good (the roll itself isn't persisted).
export function RestWidget({ storageKey }: { storageKey: string }) {
  const [tally, setTally] = useState<number>(() => {
    const v = readState(storageKey).shortRestTally;
    return typeof v === "number" ? v : 0;
  });
  const [digDeepPopup, setDigDeepPopup] = useState<DigDeepResult | null>(null);
  const shortRestPointerStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      const s = readState(storageKey);
      const v = s.shortRestTally;
      setTally(typeof v === "number" ? v : 0);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [storageKey]);

  const onShortRest = useCallback(() => {
    const next = tally >= 10 ? 0 : tally + 1;
    setTally(next);
    writeState(storageKey, { shortRestTally: next });
  }, [storageKey, tally]);

  const onClearShortRest = useCallback(() => {
    setTally(0);
    writeState(storageKey, { shortRestTally: 0 });
  }, [storageKey]);

  const handleShortRestPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    shortRestPointerStart.current = { x: event.clientX, y: event.clientY };
  };

  const handleShortRestPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = shortRestPointerStart.current;
    shortRestPointerStart.current = null;
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    // Swipe right (dominant horizontal motion) clears the tally, matching
    // the swipe-right convention used elsewhere in the app.
    if (dx >= SWIPE_THRESHOLD_PX && dx > Math.abs(dy)) {
      onClearShortRest()
      return
    }
    onShortRest()
  };

  const handleShortRestContextMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Right-click is the desktop/browser-friendly equivalent of the
    // swipe-right-to-clear gesture.
    event.preventDefault()
    shortRestPointerStart.current = null
    onClearShortRest()
  };

  const onDigDeep = useCallback(() => {
    const d1 = 1 + Math.floor(Math.random() * 4);
    const d2 = 1 + Math.floor(Math.random() * 4);
    const lose = Math.max(d1, d2);
    const gain = Math.min(d1, d2);
    setDigDeepPopup({ d1, d2, lose, gain, ts: Date.now() });
  }, []);

  const onFullRest = useCallback(() => {
    const resetSpent: Partial<Record<keyof ApproachStats, number>> = {};
    APPROACH_FIELDS.forEach((f) => {
      resetSpent[f] = 0;
    });
    writeState(storageKey, { approachOverloadSpent: resetSpent });
  }, [storageKey]);

  return (
    <div className="mods rest-widget">
      <h3>Rest</h3>

      {digDeepPopup && createPortal(
        <div className="dig-deep-popup-backdrop" onClick={() => setDigDeepPopup(null)}>
          <div className="dig-deep-popup" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="dig-deep-popup-close"
              onClick={() => setDigDeepPopup(null)}
              aria-label="Close Dig Deep result"
            >
              X
            </button>
            <div className="dig-deep-popup-label">Dig Deep</div>
            <div className="dig-deep-popup-row">
              <span className="dig-deep-popup-lose">LOSE {digDeepPopup.lose} HP</span>
              <span className="dig-deep-popup-gain">GAIN {digDeepPopup.gain} GRIT</span>
            </div>
            <div className="dig-deep-popup-rolled">rolled {digDeepPopup.d1}, {digDeepPopup.d2}</div>
          </div>
        </div>,
        document.body
      )}

      <div className="rest-stack">
        <button
          type="button"
          className="rest-stack-btn short"
          onPointerDown={handleShortRestPointerDown}
          onPointerUp={handleShortRestPointerUp}
          onPointerLeave={() => { shortRestPointerStart.current = null }}
          onPointerCancel={() => { shortRestPointerStart.current = null }}
          onClick={(event) => event.preventDefault()}
          onContextMenu={handleShortRestContextMenu}
          title="Tap to count a Short Rest. Swipe right or right-click to clear."
        >
          <span>Short Rest</span>
          <span className="rest-tally-marks">
            {tallyMarks(tally).map((n, i) => (
              <svg key={i} className="rest-tally-group" width="26" height="20" viewBox="0 0 26 20">
                {[3, 9, 15, 21].slice(0, Math.min(4, n)).map((x, j) => (
                  <line key={j} x1={x} y1={2} x2={x} y2={18} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                ))}
                {n >= 5 && <line x1={1} y1={18} x2={23} y2={2} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />}
              </svg>
            ))}
          </span>
        </button>
        <button type="button" className="rest-stack-btn digdeep" onClick={onDigDeep}>
          Dig Deep
        </button>
        <button type="button" className="rest-stack-btn fullrest" onClick={onFullRest}>
          Full Rest (restore Overload dice)
        </button>
      </div>
    </div>
  );
}
