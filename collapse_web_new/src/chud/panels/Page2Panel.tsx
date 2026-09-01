import { useMemo } from "react";
import { StatCard } from "../components/StatCard";
import { DamageDieCell } from "../components/DamageDieCell";
import { ShortRestTally } from "../components/ShortRestTally";
import { CombatRangeCells } from "../components/CombatRangeCells";
import type { ApproachStats, CoreStats } from "../../types/chud";

// Page 2 (AAG): 7 rows —
//   1. Readyness | MGR button
//   2. WT | Damage die
//   3. AP | Hand Draw | Capacity | Inventory Slots
//   4. Combat Range (FR / CR)
//   5. Short Rest tally
//   6. Core Stats
//   7. Approach
export function Page2Panel({
  onOpenMgr,
  readyness,
  isOverEncumbered,
  wt,
  onWtIncr,
  onWtDecr,
  draw,
  onDrawIncr,
  onDrawDecr,
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
  chudStateStorageKey,
}: {
  onOpenMgr: () => void;
  readyness: number;
  isOverEncumbered: boolean;
  wt: number;
  onWtIncr: () => void;
  onWtDecr: () => void;
  draw: number;
  onDrawIncr: () => void;
  onDrawDecr: () => void;
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
  chudStateStorageKey: string;
}) {
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

      {/* Row 2: WT | Damage die (10% larger) */}
      <div className="row-wt-dmg">
        <StatCard label="WT" value={wt} onIncr={onWtIncr} onDecr={onWtDecr} />
        <DamageDieCell />
      </div>

      {/* Row 3: AP | Hand Draw | Capacity | Inventory Slots (25% smaller, 4-across on mobile) */}
      <div className="core-grid row-compact-4">
        <StatCard label="AP" value={ap} onIncr={onApIncr} onDecr={onApDecr} />
        <StatCard label="Draw" value={draw} onIncr={onDrawIncr} onDecr={onDrawDecr} />
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

      {/* Row 4: Combat Range (FR / CR), same size as Row 2, 10% larger */}
      <CombatRangeCells className="row-lg" />

      {/* Row 5: Short Rest (tally-mark counter) */}
      <ShortRestTally storageKey={chudStateStorageKey} />

      {/* Row 6: Core Stats */}
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

      {/* Row 7: Approach */}
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
    </div>
  );
}

