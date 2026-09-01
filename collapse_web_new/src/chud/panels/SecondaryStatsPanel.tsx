import { RepCard } from "../components/RepCard";
import type { SecondaryStats, StatReps } from "../../types/chud";

// "Reps" section: Major (secondary stat) reps + Minor (AP/Draw/Inventory) reps.
// Plain section (no accordion) — lives on the standalone MGR page.
export function SecondaryStatsPanel({
  secondary,
  core,
  levelUpReady,
  onIncrementRep,
  onResetRep,
  onConfirmLevelUp,
  statReps,
  statRepThreshold,
  statLevelUpReady,
  onIncrementStatRep,
  onResetStatRep,
  onConfirmStatLevelUp,
}: {
  secondary: SecondaryStats;
  core: Record<string, number>;
  levelUpReady: Record<keyof SecondaryStats, boolean>;
  onIncrementRep: (field: keyof SecondaryStats) => void;
  onResetRep: (field: keyof SecondaryStats) => void;
  onConfirmLevelUp: (field: keyof SecondaryStats) => void;
  statReps: StatReps;
  statRepThreshold: (field: keyof StatReps) => number;
  statLevelUpReady: Record<keyof StatReps, boolean>;
  onIncrementStatRep: (field: keyof StatReps) => void;
  onResetStatRep: (field: keyof StatReps) => void;
  onConfirmStatLevelUp: (field: keyof StatReps) => void;
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
      <div className="core-grid secondary-grid" style={{ marginTop: 8 }}>
        {([
          ['invSlots', 'INV'],
          ['ap', 'AP'],
          ['draw', 'DRAW'],
        ] as Array<[keyof StatReps, string]>).map(([field, label]) => (
          <RepCard
            key={field}
            label={label}
            reps={statReps[field]}
            threshold={statRepThreshold(field)}
            ready={statLevelUpReady[field]}
            onTap={() => onIncrementStatRep(field)}
            onReset={() => onResetStatRep(field)}
            onLevelUp={() => onConfirmStatLevelUp(field)}
          />
        ))}
      </div>
    </div>
  );
}
