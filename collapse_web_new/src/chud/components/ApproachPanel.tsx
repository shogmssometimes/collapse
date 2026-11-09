import { useEffect, useMemo, useState } from "react";
import { ApproachDie, type ApproachDieRollResult } from "./ApproachDie";
import type { ApproachStats, CoreStats } from "../../types/chud";
import type { DieSides } from "../../domain/approachDice";
import { APPROACH_LABELS, CORE_APPROACH_MAP, CORE_LABELS } from "../../domain/coreApproachMap";
import { ROLL_MODE_STORAGE_KEY, getRollMode, setRollMode, type RollMode } from "../../domain/rollMode";

// Combat/Roleplay toggle — gates whether a margin of 0 on an Approach Roll
// queues the Desync notification (Combat only; the rule doesn't apply to
// Roleplay rolls). Reads/writes the shared rollMode.ts storage directly so
// it stays in sync with ApproachDie's own reads without prop drilling.
function RollModeToggle() {
  const [mode, setMode] = useState<RollMode>(() => getRollMode());

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== ROLL_MODE_STORAGE_KEY) return;
      setMode(getRollMode());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const choose = (next: RollMode) => {
    setRollMode(next);
    setMode(next);
  };

  return (
    <div className="roll-mode-toggle" role="group" aria-label="Rolling mode">
      <button
        type="button"
        className={`roll-mode-btn${mode === "roleplay" ? " active" : ""}`}
        onClick={() => choose("roleplay")}
      >
        Roleplay
      </button>
      <button
        type="button"
        className={`roll-mode-btn${mode === "combat" ? " active" : ""}`}
        onClick={() => choose("combat")}
      >
        Combat
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
  onOverloadApproachDie,
  onSetApproachAvailable,
  approachWardrobeBonus,
  approachWardrobeItems,
}: {
  core: CoreStats;
  approach: ApproachStats;
  damageDieSize: DieSides;
  onRollApproachDie: (field: keyof ApproachStats, count: number) => ApproachDieRollResult;
  approachOverloadSpent: Partial<Record<keyof ApproachStats, number>>;
  onOverloadApproachDie: (field: keyof ApproachStats) => boolean;
  /** Directly sets a Method's base-pool available count (tapping a track circle). */
  onSetApproachAvailable: (field: keyof ApproachStats, next: number) => void;
  /** Extra dice granted by Wardrobe items assigned to each Method (on top of the Core-distributed rating). Always rolled; never Overload-spendable. */
  approachWardrobeBonus: Partial<Record<keyof ApproachStats, number>>;
  /** Wardrobe item names/bonuses contributing to each Method's bonus, for a tooltip. */
  approachWardrobeItems: Partial<Record<keyof ApproachStats, string[]>>;
}) {
  const coreGroups = useMemo<Array<keyof CoreStats>>(() => ["vigor", "inference", "personality"], []);

  return (
    <div className="mods">
      <div className="approach-panel-header">
        <h3>Method</h3>
        <RollModeToggle />
      </div>
      <div className="method-groups">
        {coreGroups.map((coreField) => {
          const [a, b] = CORE_APPROACH_MAP[coreField];
          return (
            <div className="method-group" key={coreField}>
              <div className="method-group-header">{CORE_LABELS[coreField]}</div>
              {[a, b].map((field) => {
                const baseRating = approach[field];
                const wardrobeBonus = approachWardrobeBonus[field] ?? 0;
                const spent = approachOverloadSpent[field] ?? 0;
                const available = Math.max(0, baseRating - Math.min(Math.max(spent, 0), baseRating));
                return (
                  <ApproachDie
                    key={field}
                    label={APPROACH_LABELS[field]}
                    statValue={core[coreField]}
                    baseRating={baseRating}
                    wardrobeBonus={wardrobeBonus}
                    wardrobeItems={approachWardrobeItems[field] ?? []}
                    available={available}
                    damageDie={damageDieSize}
                    onRoll={(count) => onRollApproachDie(field, count)}
                    onOverload={() => onOverloadApproachDie(field)}
                    onSetAvailable={(next) => onSetApproachAvailable(field, next)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
