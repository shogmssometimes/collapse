import { useMemo, useState, type ReactNode } from "react";
import { StatCard } from "../components/StatCard";
import { CoreStatCard } from "../components/CoreStatCard";
import { ApproachDistributionPopout } from "../components/ApproachDistributionPopout";
import { ApproachDieSizeControl } from "../components/ApproachDieSizeControl";
import type { ApproachStats, CoreStats } from "../../types/chud";
import type { DieSides } from "../../domain/approachDice";
import { CORE_APPROACH_MAP, APPROACH_LABELS, CORE_LABELS } from "../../domain/coreApproachMap";

// Page 2 (AAG): —
//   1. Readyness | MGR button
//   2. WT | Damage die
//   3. Capacity | Inventory Slots
//   4. Core Stats (long-press opens the Approach distribution popout)
// The Approach dice cards (tap-arm / hold-roll) and the Short Rest / Dig
// Deep / Full Rest stack live elsewhere now — Approach moved to the HUD,
// Rest moved to the bottom of this page (see RestWidget below).
export function Page2Panel({
  onOpenMgr,
  readyness,
  isOverEncumbered,
  wt,
  onWtIncr,
  onWtDecr,
  capacity,
  inventorySlots,
  skillCount,
  fumbleNumber,
  core,
  onCoreChange,
  approach,
  onApproachChange,
  damageDieSize,
  onDamageDieSizeIncrease,
  onDamageDieSizeReset,
  restWidget,
}: {
  onOpenMgr: () => void;
  readyness: number;
  isOverEncumbered: boolean;
  wt: number;
  onWtIncr: () => void;
  onWtDecr: () => void;
  capacity: number;
  inventorySlots: number;
  skillCount: number;
  fumbleNumber: number;
  core: CoreStats;
  onCoreChange: (field: keyof CoreStats, updater: (v: number) => number) => void;
  approach: ApproachStats;
  onApproachChange: (field: keyof ApproachStats, updater: (v: number) => number) => void;
  damageDieSize: DieSides;
  onDamageDieSizeIncrease: () => DieSides;
  onDamageDieSizeReset: () => DieSides;
  restWidget?: ReactNode;
}) {
  const [openDistribution, setOpenDistribution] = useState<keyof CoreStats | null>(null);

  const coreStats = useMemo<Array<[keyof CoreStats, string]>>(
    () => [
      ["vigor", CORE_LABELS.vigor],
      ["inference", CORE_LABELS.inference],
      ["personality", CORE_LABELS.personality],
    ],
    []
  );

  return (
    <div className="mods">
      {/* Row 1: Readyness | MGR button */}
      <div className="row-rdy-mgr">
        <div className="chip">
          <span>READINESS</span>
          <strong style={isOverEncumbered ? { color: 'rgba(255,100,100,0.95)', fontStyle: 'italic' } : undefined}>
            {isOverEncumbered ? 'Last' : readyness}
          </strong>
        </div>
        <button className="topbar-square-btn" onClick={onOpenMgr}>
          MGR
        </button>
      </div>

      {/* Row 2: WT | Damage die */}
      <div className="row-wt-dmg">
        <StatCard label="WT" value={wt} onIncr={onWtIncr} onDecr={onWtDecr} />
        <ApproachDieSizeControl
          die={damageDieSize}
          onIncrease={onDamageDieSizeIncrease}
          onReset={onDamageDieSizeReset}
          label="QUALITY"
        />
      </div>

      {/* Row 3: Capacity | Inventory Slots (25% smaller, 2-across on mobile).
          Inventory Slots is derived (Vigor), not separately set. */}
      <div className="core-grid row-compact-3">
        <div className="chip">
          <span>Capacity</span>
          <strong>{capacity}</strong>
        </div>
        <div className="chip">
          <span>Inv Slots</span>
          <strong>{inventorySlots}</strong>
        </div>
      </div>

      {/* Row 4: Skills | Fumble Number — derived from Core stats
          (Inference, V+I+P respectively). Ganbare! Charges moved to the
          HUD, rendered to the right of HP. */}
      <div className="core-grid row-vitals-2">
        <div className="chip">
          <span>Skills</span>
          <strong>{skillCount}</strong>
        </div>
        <div className="chip">
          <span>Fumble</span>
          <strong>{fumbleNumber}</strong>
        </div>
      </div>

      {/* Row 5: Core Stats */}
      <div className="mods">
        <h3>Core Stats</h3>
        <div className="core-grid">
          {coreStats.map(([field, label]) => (
            <CoreStatCard
              key={field}
              label={label}
              value={core[field]}
              onIncr={() => onCoreChange(field, (v) => v + 1)}
              onDecr={() => onCoreChange(field, (v) => Math.max(0, v - 1))}
              onOpenDistribution={() => setOpenDistribution(field)}
            />
          ))}
        </div>
      </div>

      {openDistribution && (() => {
        const [a, b] = CORE_APPROACH_MAP[openDistribution];
        return (
          <ApproachDistributionPopout
            coreLabel={CORE_LABELS[openDistribution]}
            poolTotal={core[openDistribution]}
            approachA={a}
            approachALabel={APPROACH_LABELS[a]}
            approachAValue={approach[a]}
            onApproachAChange={(updater) => onApproachChange(a, updater)}
            approachB={b}
            approachBLabel={APPROACH_LABELS[b]}
            approachBValue={approach[b]}
            onApproachBChange={(updater) => onApproachChange(b, updater)}
            onClose={() => setOpenDistribution(null)}
          />
        );
      })()}

      {restWidget}
    </div>
  );
}
