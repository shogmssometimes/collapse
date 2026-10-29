import { RepCard } from "../components/RepCard";
import type { SecondaryStats } from "../../types/chud";

// "Reps" section: Major (secondary stat) reps. Plain section (no accordion)
// — lives on the standalone MGR page.
export function SecondaryStatsPanel({
  secondary,
  core,
  levelUpReady,
  onIncrementRep,
  onResetRep,
  onConfirmLevelUp,
}: {
  secondary: SecondaryStats;
  core: Record<string, number>;
  levelUpReady: Record<keyof SecondaryStats, boolean>;
  onIncrementRep: (field: keyof SecondaryStats) => void;
  onResetRep: (field: keyof SecondaryStats) => void;
  onConfirmLevelUp: (field: keyof SecondaryStats) => void;
}) {
  return (
    <div className="mods">
      <div style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(248,250,252,0.35)', paddingBottom: 4, paddingTop: 6, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>XP &amp; Levels</div>
      <div className="core-grid secondary-grid">
        {([
          ["vigor", "VIG"],
          ["inference", "INFER"],
          ["personality", "PERSO"],
        ] as Array<[keyof SecondaryStats, string]>).map(([field, label]) => (
          <RepCard
            key={field}
            label={label}
            reps={Number.isFinite(secondary[field]) ? secondary[field] : 0}
            threshold={core[field] + 1}
            ready={levelUpReady[field]}
            onTap={() => onIncrementRep(field)}
            onReset={() => onResetRep(field)}
            onLevelUp={() => onConfirmLevelUp(field)}
          />
        ))}
      </div>
    </div>
  );
}
