import { useMemo } from "react";
import { useSemiLongPress } from "../../hooks/useSemiLongPress";
import { StatCard } from "../components/StatCard";
import type { ApproachStats, CoreStats } from "../../types/chud";

// Core Stats + Approach accordion.
export function StatsPanel({
  open,
  onToggleOpen,
  core,
  onCoreChange,
  approach,
  onApproachChange,
}: {
  open: boolean;
  onToggleOpen: () => void;
  core: CoreStats;
  onCoreChange: (field: keyof CoreStats, updater: (v: number) => number) => void;
  approach: ApproachStats;
  onApproachChange: (field: keyof ApproachStats, updater: (v: number) => number) => void;
}) {
  const toggleHandlers = useSemiLongPress(onToggleOpen);

  const coreStats = useMemo<Array<[keyof CoreStats, string]>>(
    () => [
      ["vigor", "VIG"],
      ["inference", "INFER"],
      ["personality", "PERSO"],
    ],
    []
  );

  const approachStats = useMemo<Array<[keyof ApproachStats, string]>>(
    () => [
      ["force", "Force"],
      ["guts", "Guts"],
      ["show", "Show"],
      ["finesse", "Finesse"],
      ["logic", "Logic"],
      ["tell", "Tell"],
    ],
    []
  );

  return (
    <div className={`mods secondary-accordion${open ? " open" : ""}`}>
      <button
        type="button"
        className="secondary-toggle"
        {...toggleHandlers}
      >
        <span>Stats</span>
        <span className="secondary-toggle-chevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <>
          {/* ── Core Stats ── */}
          <div className="mods">
            <h3>Core Stats</h3>
            <div className="core-grid">
              {coreStats.map(([field, label]) => (
                <StatCard
                  key={field}
                  label={label}
                  value={core[field]}
                  onIncr={() => onCoreChange(field, (v) => v + 1)}
                  onDecr={() =>
                    onCoreChange(field, (v) => Math.max(0, v - 1))
                  }
                />
              ))}
            </div>
          </div>

          {/* ── Approach ── */}
          <div className="mods">
            <h3>Approach</h3>
            <div className="core-grid approach-grid">
              {approachStats.map(([field, label]) => (
                <StatCard
                  key={field}
                  label={label}
                  value={approach[field]}
                  onIncr={() => onApproachChange(field, (v) => v + 1)}
                  onDecr={() =>
                    onApproachChange(field, (v) => Math.max(0, v - 1))
                  }
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
