import { useEffect, useMemo, useRef, useState } from "react";
import { ApproachDie, type ApproachDieRollResult } from "./ApproachDie";
import type { ApproachStats, CoreStats } from "../../types/chud";
import type { DieSides } from "../../domain/approachDice";
import { APPROACH_LABELS, CORE_APPROACH_MAP, CORE_LABELS } from "../../domain/coreApproachMap";
import { STANDARD_LONG_PRESS_MS as GANBARE_HOLD_MS } from "../../utils/gestureConstants";


const GANBARE_METHOD_ORDER: Array<keyof ApproachStats> = ["force", "finesse", "guts", "logic", "show", "tell"];

// "Receive Ganbare!" — handbook: a friend can spend one of *their* own
// Ganbare! Charges to return one of your Overloaded dice to its Method
// pool ("or until a friend gives you Ganbare! for it"). This control
// models receiving that gift on your own sheet: cycle the method-symbol
// box to the Method that should get its die back, then long-press the
// Ganbare! box to restore it (capped at that Method's base rating).
function GanbareControl({
  onReceiveGanbare,
}: {
  onReceiveGanbare: (field: keyof ApproachStats) => void;
}) {
  const [index, setIndex] = useState(0);
  const [charging, setCharging] = useState(false);
  const holdTimer = useRef<number | null>(null);

  const field = GANBARE_METHOD_ORDER[index];

  const cycle = () => setIndex((i) => (i + 1) % GANBARE_METHOD_ORDER.length);

  const cancelHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setCharging(false);
  };

  const startHold = () => {
    setCharging(true);
    holdTimer.current = window.setTimeout(() => {
      onReceiveGanbare(field);
      cancelHold();
    }, GANBARE_HOLD_MS);
  };

  return (
    <div className="ganbare-control">
      <button
        type="button"
        className="ganbare-method-box"
        onClick={cycle}
        aria-label={`Ganbare! target Method: ${APPROACH_LABELS[field]}. Tap to cycle.`}
      >
        {APPROACH_LABELS[field]}
      </button>
      <button
        type="button"
        className={`ganbare-receive-box${charging ? " charging" : ""}`}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(event) => event.preventDefault()}
        style={{ ["--hold-progress-ms" as string]: `${GANBARE_HOLD_MS}ms` } as React.CSSProperties}
        aria-label={`Receive Ganbare! on ${APPROACH_LABELS[field]}. Long-press to add 1 die to its pool.`}
      >
        <span className={`hold-progress-fill${charging ? " active" : ""}`} aria-hidden="true" />
        Ganbare!
      </button>
    </div>
  );
}

// Method rows — printed-sheet style, grouped under their linked Core stat
// (VIGOR / INFER / PERSO), two Methods each, lives in the HUD so the player
// can roll directly off the compact view. Ratings/distribution still live
// on the AAG page's Core Stats section; this panel only reads `approach`
// and `core`.
export function ApproachPanel({
  core,
  approach,
  damageDieSize,
  onRollApproachDie,
  approachOverloadSpent,
  approachWardrobeOverloadSpent,
  onOverloadApproachDie,
  onReceiveGanbare,
  approachWardrobeBonus,
  approachWardrobeItems,
}: {
  core: CoreStats;
  approach: ApproachStats;
  damageDieSize: DieSides;
  onRollApproachDie: (field: keyof ApproachStats, count: number) => ApproachDieRollResult;
  approachOverloadSpent: Partial<Record<keyof ApproachStats, number>>;
  /** Overload spend tracked separately for each Method's Wardrobe bonus dice. */
  approachWardrobeOverloadSpent: Partial<Record<keyof ApproachStats, number>>;
  onOverloadApproachDie: (field: keyof ApproachStats, baseCount: number, wardrobeCount: number) => boolean;
  /** Restores 1 die to the chosen Method's pool (a friend's Ganbare!, long-press to confirm). */
  onReceiveGanbare: (field: keyof ApproachStats) => void;
  /** Extra dice granted by Wardrobe items assigned to each Method (on top of the Core-distributed rating). Always rolled; Overload-spendable as its own pool. */
  approachWardrobeBonus: Partial<Record<keyof ApproachStats, number>>;
  /** Wardrobe item names/bonuses contributing to each Method's bonus, for a tooltip. */
  approachWardrobeItems: Partial<Record<keyof ApproachStats, string[]>>;
}) {
  const coreGroups = useMemo<Array<keyof CoreStats>>(() => ["vigor", "inference", "personality"], []);

  return (
    <div className="mods">
      <div className="approach-panel-header">
        <h3>Method</h3>
      </div>
      <div className="method-groups">
        {coreGroups.map((coreField) => {
          const [a, b] = CORE_APPROACH_MAP[coreField];
          return (
            <div className="method-group" key={coreField}>
              <div className="method-group-header">
                <span>{CORE_LABELS[coreField]}</span>
                <span className="method-group-stat-box" aria-label={`${CORE_LABELS[coreField]} Stat: ${core[coreField]}, shared across ${APPROACH_LABELS[a]} and ${APPROACH_LABELS[b]}`}>
                  {core[coreField]}
                </span>
              </div>
              {[a, b].map((field) => {
                const baseRating = approach[field];
                const wardrobeBonus = approachWardrobeBonus[field] ?? 0;
                const spent = approachOverloadSpent[field] ?? 0;
                const available = Math.max(0, baseRating - Math.min(Math.max(spent, 0), baseRating));
                const wardrobeSpent = approachWardrobeOverloadSpent[field] ?? 0;
                const wardrobeAvailable = Math.max(0, wardrobeBonus - Math.min(Math.max(wardrobeSpent, 0), wardrobeBonus));
                return (
                  <ApproachDie
                    key={field}
                    label={APPROACH_LABELS[field]}
                    baseRating={baseRating}
                    wardrobeBonus={wardrobeBonus}
                    wardrobeAvailable={wardrobeAvailable}
                    wardrobeItems={approachWardrobeItems[field] ?? []}
                    available={available}
                    damageDie={damageDieSize}
                    onRoll={(count) => onRollApproachDie(field, count)}
                    onOverload={(baseCount, wardrobeCount) => onOverloadApproachDie(field, baseCount, wardrobeCount)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <GanbareControl onReceiveGanbare={onReceiveGanbare} />
    </div>
  );
}
