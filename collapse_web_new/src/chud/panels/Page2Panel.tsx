import { useMemo, useState } from "react";
import { StatCard } from "../components/StatCard";
import { CoreStatCard } from "../components/CoreStatCard";
import { ApproachDistributionPopout } from "../components/ApproachDistributionPopout";
import { ApproachDie, type ApproachDieRollResult } from "../components/ApproachDie";
import { ApproachDieSizeControl } from "../components/ApproachDieSizeControl";
import type { ApproachStats, CoreStats } from "../../types/chud";
import type { DieSides } from "../../domain/approachDice";
import { CORE_APPROACH_MAP, APPROACH_LABELS, CORE_LABELS } from "../../domain/coreApproachMap";

// Page 2 (AAG): 6 rows —
//   1. Readyness | MGR button
//   2. WT | Damage die
//   3. AP | Capacity | Inventory Slots
//   4. Short Rest tally
//   5. Core Stats (long-press opens the Approach distribution popout)
//   6. Approach (tap arms a die, hold rolls the armed dice)
export function Page2Panel({
  onOpenMgr,
  readyness,
  isOverEncumbered,
  wt,
  onWtIncr,
  onWtDecr,
  ap,
  onApIncr,
  onApDecr,
  capacity,
  inventorySlots,
  onInventoryIncr,
  onInventoryDecr,
  core,
  onCoreChange,
  approach,
  onApproachChange,
  approachDieSize,
  onApproachDieSizeIncrease,
  onApproachDieSizeReset,
  damageDieSize,
  onDamageDieSizeIncrease,
  onDamageDieSizeReset,
  onRollApproachDie,
  approachOverloadSpent,
  onOverloadApproachDie,
  onFullRestApproachDice,
}: {
  onOpenMgr: () => void;
  readyness: number;
  isOverEncumbered: boolean;
  wt: number;
  onWtIncr: () => void;
  onWtDecr: () => void;
  ap: number;
  onApIncr: () => void;
  onApDecr: () => void;
  capacity: number;
  inventorySlots: number;
  onInventoryIncr: () => void;
  onInventoryDecr: () => void;
  core: CoreStats;
  onCoreChange: (field: keyof CoreStats, updater: (v: number) => number) => void;
  approach: ApproachStats;
  onApproachChange: (field: keyof ApproachStats, updater: (v: number) => number) => void;
  approachDieSize: DieSides;
  onApproachDieSizeIncrease: () => DieSides;
  onApproachDieSizeReset: () => DieSides;
  damageDieSize: DieSides;
  onDamageDieSizeIncrease: () => DieSides;
  onDamageDieSizeReset: () => DieSides;
  onRollApproachDie: (field: keyof ApproachStats, count: number) => ApproachDieRollResult;
  approachOverloadSpent: Partial<Record<keyof ApproachStats, number>>;
  onOverloadApproachDie: (field: keyof ApproachStats) => boolean;
  onFullRestApproachDice: () => void;
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

  const approachStats = useMemo<Array<[keyof ApproachStats, string]>>(
    () => [
      ["force", APPROACH_LABELS.force],
      ["guts", APPROACH_LABELS.guts],
      ["show", APPROACH_LABELS.show],
      ["finesse", APPROACH_LABELS.finesse],
      ["logic", APPROACH_LABELS.logic],
      ["tell", APPROACH_LABELS.tell],
    ],
    []
  );

  return (
    <div className="mods">
      {/* Row 1: Readyness | MGR button */}
      <div className="row-rdy-mgr">
        <div className="chip">
          <span>RDY</span>
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
          label="DAMAGE DIE"
        />
      </div>

      {/* Row 3: AP | Capacity | Inventory Slots (25% smaller, 3-across on mobile) */}
      <div className="core-grid row-compact-3">
        <StatCard label="AP" value={ap} onIncr={onApIncr} onDecr={onApDecr} />
        <div className="chip">
          <span>Capacity</span>
          <strong>{capacity}</strong>
        </div>
        <StatCard
          label="Inventory Slots"
          value={inventorySlots}
          onIncr={onInventoryIncr}
          onDecr={onInventoryDecr}
        />
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

      {/* Row 6: Approach */}
      <div className="mods">
        <h3>Approach</h3>
        <ApproachDieSizeControl
          die={approachDieSize}
          onIncrease={onApproachDieSizeIncrease}
          onReset={onApproachDieSizeReset}
        />
        <div className="core-grid approach-grid">
          {approachStats.map(([field, label]) => {
            const rating = approach[field];
            const spent = approachOverloadSpent[field] ?? 0;
            const available = Math.max(0, rating - Math.min(Math.max(spent, 0), rating));
            return (
              <div className="approach-unit" key={field}>
                <ApproachDie
                  label={label}
                  rating={rating}
                  available={available}
                  die={approachDieSize}
                  damageDie={damageDieSize}
                  onRoll={(count) => onRollApproachDie(field, count)}
                  onOverload={() => onOverloadApproachDie(field)}
                />
              </div>
            );
          })}
        </div>
        <button type="button" className="approach-full-rest-btn" onClick={onFullRestApproachDice}>
          Full Rest (restore Overload dice)
        </button>
      </div>
    </div>
  );
}
