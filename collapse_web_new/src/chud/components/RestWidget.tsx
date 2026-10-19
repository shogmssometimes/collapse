import { useCallback, useEffect, useState } from "react";
import type { ApproachStats } from "../../types/chud";

const APPROACH_FIELDS: Array<keyof ApproachStats> = ["force", "finesse", "guts", "logic", "show", "tell"];

type DigDeepBanner = { d1: number; d2: number; lose: number; gain: number; ts: number };

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
// Overload pool. The Dig Deep result persists as a banner until cleared (or
// until the next Dig Deep roll overwrites it) so it isn't lost if forgotten.
export function RestWidget({ storageKey }: { storageKey: string }) {
  const [tally, setTally] = useState<number>(() => {
    const v = readState(storageKey).shortRestTally;
    return typeof v === "number" ? v : 0;
  });
  const [banner, setBanner] = useState<DigDeepBanner | null>(() => {
    const v = readState(storageKey).restBanner;
    return v && typeof v === "object" ? (v as DigDeepBanner) : null;
  });

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      const s = readState(storageKey);
      const v = s.shortRestTally;
      setTally(typeof v === "number" ? v : 0);
      const b = s.restBanner;
      setBanner(b && typeof b === "object" ? (b as DigDeepBanner) : null);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [storageKey]);

  const onShortRest = useCallback(() => {
    const next = tally >= 10 ? 0 : tally + 1;
    setTally(next);
    writeState(storageKey, { shortRestTally: next });
  }, [storageKey, tally]);

  const onDigDeep = useCallback(() => {
    const d1 = 1 + Math.floor(Math.random() * 4);
    const d2 = 1 + Math.floor(Math.random() * 4);
    const lose = Math.max(d1, d2);
    const gain = Math.min(d1, d2);
    const next: DigDeepBanner = { d1, d2, lose, gain, ts: Date.now() };
    setBanner(next);
    writeState(storageKey, { restBanner: next });
  }, [storageKey]);

  const onFullRest = useCallback(() => {
    const resetSpent: Partial<Record<keyof ApproachStats, number>> = {};
    APPROACH_FIELDS.forEach((f) => {
      resetSpent[f] = 0;
    });
    writeState(storageKey, { approachOverloadSpent: resetSpent });
  }, [storageKey]);

  const clearBanner = useCallback(() => {
    setBanner(null);
    writeState(storageKey, { restBanner: null });
  }, [storageKey]);

  return (
    <div className="mods rest-widget">
      <h3>Rest</h3>

      {banner && (
        <div className="rest-banner">
          <span className="rest-banner-text">
            Dig Deep — Lose {banner.lose}, Gain {banner.gain} (rolled {banner.d1}, {banner.d2})
          </span>
          <button type="button" className="rest-banner-clear" onClick={clearBanner} aria-label="Clear">
            ✕
          </button>
        </div>
      )}

      <div className="rest-stack">
        <button type="button" className="rest-stack-btn short" onClick={onShortRest}>
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
