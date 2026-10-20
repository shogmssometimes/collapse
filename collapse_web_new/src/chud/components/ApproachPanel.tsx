import { useMemo } from "react";
import { ApproachDie, type ApproachDieRollResult } from "./ApproachDie";
import { ApproachDieSizeControl } from "./ApproachDieSizeControl";
import type { ApproachStats } from "../../types/chud";
import type { DieSides } from "../../domain/approachDice";
import { APPROACH_LABELS } from "../../domain/coreApproachMap";

// Approach dice cards (tap-arm / hold-roll) — lives in the HUD so the player
// can roll directly off the compact view. Ratings/distribution still live on
// the AAG page's Core Stats section; this panel only reads `approach`.
export function ApproachPanel({
  approach,
  approachDieSize,
  onApproachDieSizeIncrease,
  onApproachDieSizeReset,
  damageDieSize,
  onRollApproachDie,
  approachOverloadSpent,
  onOverloadApproachDie,
  approachWardrobeBonus,
  approachWardrobeItems,
}: {
  approach: ApproachStats;
  approachDieSize: DieSides;
  onApproachDieSizeIncrease: () => DieSides;
  onApproachDieSizeReset: () => DieSides;
  damageDieSize: DieSides;
  onRollApproachDie: (field: keyof ApproachStats, count: number) => ApproachDieRollResult;
  approachOverloadSpent: Partial<Record<keyof ApproachStats, number>>;
  onOverloadApproachDie: (field: keyof ApproachStats) => boolean;
  /** Extra dice granted by Wardrobe items assigned to each Approach (on top of the Core-distributed rating). */
  approachWardrobeBonus: Partial<Record<keyof ApproachStats, number>>;
  /** Wardrobe item names/bonuses contributing to each Approach's bonus, for a tooltip. */
  approachWardrobeItems: Partial<Record<keyof ApproachStats, string[]>>;
}) {
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
      <h3>Approach</h3>
      <div className="core-grid approach-grid">
        {approachStats.map(([field, label]) => {
          const baseRating = approach[field];
          const wardrobeBonus = approachWardrobeBonus[field] ?? 0;
          const rating = baseRating + wardrobeBonus;
          const spent = approachOverloadSpent[field] ?? 0;
          const available = Math.max(0, rating - Math.min(Math.max(spent, 0), rating));
          return (
            <div className="approach-unit" key={field}>
              <ApproachDie
                label={label}
                rating={rating}
                baseRating={baseRating}
                wardrobeBonus={wardrobeBonus}
                wardrobeItems={approachWardrobeItems[field] ?? []}
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
      <ApproachDieSizeControl
        die={approachDieSize}
        onIncrease={onApproachDieSizeIncrease}
        onReset={onApproachDieSizeReset}
        compact
      />
    </div>
  );
}
