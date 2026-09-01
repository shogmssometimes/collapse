import { useEffect, useState } from "react";

const COMBAT_KEY = "combat.v1";

function readRangeSwapped(): boolean {
  try {
    const raw = window.localStorage.getItem(COMBAT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!parsed?.rangeSwapped;
  } catch {
    return false;
  }
}

// Read-only display of CR/FR (Close Range / Far Range) modifiers, sourced
// from the standalone Combat page's state.
export function CombatRangeCells({ className }: { className?: string } = {}) {
  const [swapped, setSwapped] = useState<boolean>(() =>
    typeof window !== "undefined" ? readRangeSwapped() : false
  );

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === COMBAT_KEY) setSwapped(readRangeSwapped());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <div className={`combat-info-row${className ? ` ${className}` : ""}`}>
      <div className="combat-info-cell">
        <span className="combat-info-cell-label">CR</span>
        <span className="combat-info-range-val">{swapped ? "+1" : "0"}</span>
      </div>
      <div className="combat-info-cell">
        <span className="combat-info-cell-label">FR</span>
        <span className="combat-info-range-val">{swapped ? "0" : "+1"}</span>
      </div>
    </div>
  );
}
