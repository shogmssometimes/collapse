import { useEffect, useMemo, useRef, useState } from "react";
import { ApproachDie, type ApproachDieRollResult } from "./ApproachDie";
import type { ApproachStats, CoreStats } from "../../types/chud";
import type { DieSides } from "../../domain/approachDice";
import { APPROACH_LABELS, CORE_APPROACH_MAP, CORE_LABELS } from "../../domain/coreApproachMap";
import { computeFumbleNumber } from "../../domain/chudStats";
import { hideUnusedMethodsKey } from "../../utils/slotKeys";

// ApproachPanel only ever renders inside the CHUD iframe, whose own URL
// carries ?slot=N (passed by the outer app when building the iframe src),
// so it's safe to self-resolve the active slot here (B2) rather than
// threading it down as a prop from Chud.tsx.
const _hideUnusedMethodsKey = (() => {
  if (typeof window === "undefined") return hideUnusedMethodsKey(1);
  const n = parseInt(new URLSearchParams(window.location.search).get("slot") ?? "1", 10);
  return hideUnusedMethodsKey(isNaN(n) || n < 1 || n > 3 ? 1 : n);
})();

const GANBARE_METHOD_ORDER: Array<keyof ApproachStats> = ["force", "finesse", "guts", "logic", "show", "tell"];
// 8 taps shatters the glass cover (1 restore fires on the 8th tap); it
// cracks visibly every 2 taps. Breaking it fires the gift once and the
// cover reforms immediately — ready for another full 8-tap break next
// time. The "shattered" look is a brief cosmetic flash, not a usable state.
const GANBARE_TAPS_TO_BREAK = 8;
const GANBARE_SHATTER_FLASH_MS = 450;
// Deadzone/commit distances (px) for the Method header's horizontal
// hide-0s swipe — same two-stage "pending, then commit" pattern used by
// every other swipe in the app.
const HEADER_SWIPE_DEADZONE_PX = 8;
const HEADER_SWIPE_COMMIT_PX = 40;

// "Receive Ganbare!" — handbook: a friend can spend one of *their* own
// Ganbare! Charges to return one of your Overloaded dice to its Method
// pool ("or until a friend gives you Ganbare! for it"). This control
// models receiving that gift on your own sheet: cycle the method-symbol
// box to the Method that should get its die back, then tap the glass
// cover over the Ganbare! box 8 times to break it. Breaking it restores a
// die immediately, and the cover reforms right away — it needs another
// full 8 taps next time, same as a fresh glass cover.
function GanbareControl({
  onReceiveGanbare,
  brokenAt,
}: {
  onReceiveGanbare: (field: keyof ApproachStats) => void;
  /** Timestamp (ms) the glass last shattered, or null if intact. Owned by the parent so it survives reloads. Only used here to re-trigger the brief shatter flash. */
  brokenAt: number | null;
}) {
  const [index, setIndex] = useState(0);
  const [taps, setTaps] = useState(0);
  const [justShattered, setJustShattered] = useState(false);

  const field = GANBARE_METHOD_ORDER[index];

  const cycle = () => setIndex((i) => (i + 1) % GANBARE_METHOD_ORDER.length);

  // Purely cosmetic: flash the "shattered" look for a moment after each
  // break, then clear it — the glass has already reformed underneath by
  // the time the flash ends, since `taps` was reset to 0 immediately.
  useEffect(() => {
    if (brokenAt === null) return;
    setJustShattered(true);
    const id = window.setTimeout(() => setJustShattered(false), GANBARE_SHATTER_FLASH_MS);
    return () => window.clearTimeout(id);
  }, [brokenAt]);

  const handleTap = () => {
    setTaps((prev) => {
      const next = prev + 1;
      if (next >= GANBARE_TAPS_TO_BREAK) {
        onReceiveGanbare(field);
        return 0;
      }
      return next;
    });
  };

  // 4 crack stages (0 = intact): one extra crack every 2 taps.
  const crackStage = Math.min(4, Math.floor(taps / 2));

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
        className={`ganbare-receive-box${justShattered ? " shattered" : ` crack-${crackStage}`}`}
        onClick={handleTap}
        aria-label={`Receive Ganbare! on ${APPROACH_LABELS[field]}. Tap the glass cover ${GANBARE_TAPS_TO_BREAK - taps} more time${GANBARE_TAPS_TO_BREAK - taps === 1 ? "" : "s"} to break it and restore 1 die.`}
      >
        <span className="ganbare-glass-cover" aria-hidden="true" />
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
  ganbareGlassBrokenAt,
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
  /** Timestamp (ms) the Ganbare! glass cover last shattered, or null/undefined if it's intact. */
  ganbareGlassBrokenAt?: number | null;
  /** Extra dice granted by Wardrobe items assigned to each Method (on top of the Core-distributed rating). Always rolled; Overload-spendable as its own pool. */
  approachWardrobeBonus: Partial<Record<keyof ApproachStats, number>>;
  /** Wardrobe item names/bonuses contributing to each Method's bonus, for a tooltip. */
  approachWardrobeItems: Partial<Record<keyof ApproachStats, string[]>>;
}) {
  const coreGroups = useMemo<Array<keyof CoreStats>>(() => ["vigor", "inference", "personality"], []);
  const fumbleNumber = useMemo(() => computeFumbleNumber(core), [core]);
  const [hideUnused, setHideUnused] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(_hideUnusedMethodsKey) === "1";
    } catch {
      return false;
    }
  });

  const applyHideUnused = (next: boolean) => {
    setHideUnused(next);
    try {
      window.localStorage.setItem(_hideUnusedMethodsKey, next ? "1" : "0");
    } catch {
      // storage unavailable — ignore
    }
  };

  // Swipe left-to-right across the Method header hides the 0-dice rows;
  // swipe right-to-left restores them — replaces the old "Hide 0s" pill
  // button, which took up header width better spent on the title. Mirrors
  // the deadzone/commit-distance pattern used by every other swipe in the
  // app (e.g. CoreStatCard): short/vertical drags do nothing.
  const headerDragStartX = useRef(0);
  const headerDragStartY = useRef(0);
  const headerDragging = useRef(false);
  const [headerDragState, setHeaderDragState] = useState<null | "hide" | "show">(null);

  const handleHeaderPointerDown = (event: React.PointerEvent) => {
    headerDragging.current = true;
    headerDragStartX.current = event.clientX;
    headerDragStartY.current = event.clientY;
    setHeaderDragState(null);
  };

  const handleHeaderPointerMove = (event: React.PointerEvent) => {
    if (!headerDragging.current) return;
    const dx = event.clientX - headerDragStartX.current;
    const dy = event.clientY - headerDragStartY.current;
    if (Math.abs(dx) < HEADER_SWIPE_DEADZONE_PX || Math.abs(dx) < Math.abs(dy)) {
      setHeaderDragState(null);
      return;
    }
    setHeaderDragState(dx > 0 ? "hide" : "show");
  };

  const endHeaderDrag = () => {
    headerDragging.current = false;
    setHeaderDragState(null);
  };

  const handleHeaderPointerUp = (event: React.PointerEvent) => {
    if (!headerDragging.current) return;
    const dx = event.clientX - headerDragStartX.current;
    const dy = event.clientY - headerDragStartY.current;
    const swipedFar = Math.abs(dx) >= HEADER_SWIPE_COMMIT_PX && Math.abs(dx) >= Math.abs(dy);
    endHeaderDrag();
    if (!swipedFar) return;
    applyHideUnused(dx > 0);
  };

  return (
    <div className="mods">
      <div
        className={`approach-panel-header${headerDragState ? ` method-header-swipe-${headerDragState}` : ""}`}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerLeave={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
        aria-label={`Method${hideUnused ? ", Methods with no dice hidden" : ""}. Swipe right to hide Methods with no dice, swipe left to show them again.`}
      >
        <h3>Method</h3>
        {hideUnused && <span className="method-hide-unused-badge">0s hidden</span>}
      </div>
      <div className="method-groups">
        {coreGroups.map((coreField) => {
          const [a, b] = CORE_APPROACH_MAP[coreField];
          const fields = [a, b].filter((field) => {
            if (!hideUnused) return true;
            const totalDice = approach[field] + (approachWardrobeBonus[field] ?? 0);
            return totalDice > 0;
          });
          if (fields.length === 0) return null;
          return (
            <div className="method-group" key={coreField}>
              <div className="method-group-header">
                <span>{CORE_LABELS[coreField]}</span>
                <span className="method-group-stat-box" aria-label={`${CORE_LABELS[coreField]} Stat: ${core[coreField]}, shared across ${APPROACH_LABELS[a]} and ${APPROACH_LABELS[b]}`}>
                  {core[coreField]}
                </span>
              </div>
              {fields.map((field) => {
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
                    fumbleNumber={fumbleNumber}
                    onRoll={(count) => onRollApproachDie(field, count)}
                    onOverload={(baseCount, wardrobeCount) => onOverloadApproachDie(field, baseCount, wardrobeCount)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <GanbareControl onReceiveGanbare={onReceiveGanbare} brokenAt={ganbareGlassBrokenAt ?? null} />
    </div>
  );
}
