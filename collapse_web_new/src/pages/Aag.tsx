import { useCallback, useEffect, useState } from "react";
import type { ApproachStats, CoreStats } from "../types/chud";
import {
  DEFAULT_APPROACH,
  DEFAULT_WT,
  computeDerived,
  computeFumbleNumber,
  computeGanbareCharges,
  computeInventorySlots,
  computeSkillCount,
} from "../domain/chudStats";
import { isDieSides, stepUp, type DieSides } from "../domain/approachDice";
import { clampApproachToCore } from "../domain/coreApproachMap";
import { loadState, readGearData } from "../utils/chudPersistence";
import { Page2Panel } from "../chud/panels/Page2Panel";
import { RestWidget } from "../chud/components/RestWidget";
import "./aagPage2.css";

const DEFAULT_DAMAGE_DIE_SIZE: DieSides = 4;

// AAG page: hosts the Page 2 box (moved out of the CHUD iframe). Reads and
// writes the same persisted cHUD state so the two stay in sync.
export default function AagPage({
  chudStateStorageKey,
  gearSlotsStorageKey,
  deckBuilderStorageKey,
  onOpenMgr,
}: {
  chudStateStorageKey: string;
  gearSlotsStorageKey: string;
  deckBuilderStorageKey: string;
  onOpenMgr: () => void;
}) {
  const saved = loadState(chudStateStorageKey);

  const [core, setCore] = useState<CoreStats>(saved?.core ?? { vigor: 0, inference: 0, personality: 0 });
  const [approach, setApproach] = useState<ApproachStats>(() => clampApproachToCore(saved?.approach ?? DEFAULT_APPROACH, saved?.core ?? { vigor: 0, inference: 0, personality: 0 }));
  const [damageDieSize, setDamageDieSize] = useState<DieSides>(
    isDieSides(saved?.damageDieSize) ? saved.damageDieSize : DEFAULT_DAMAGE_DIE_SIZE
  );
  const [wt, setWtRaw] = useState<number>(saved?.wt ?? DEFAULT_WT);
  const [ganbareSpent, setGanbareSpent] = useState<number>(
    typeof saved?.ganbareSpent === "number" ? saved.ganbareSpent : 0
  );
  const [gearSlotsUsed, setGearSlotsUsed] = useState<number>(() =>
    typeof window !== "undefined" ? (readGearData(gearSlotsStorageKey)?.slotsUsed ?? 0) : 0
  );

  const setWt = useCallback((v: number) => setWtRaw(Math.max(0, v)), []);

  // A Core stat's value is the total pool its two linked Approaches draw
  // from (see CORE_APPROACH_MAP). If the Core stat is lowered below what's
  // already distributed, trim the overflow back out of those Approaches so
  // the total distributed can never exceed the available pool.
  const setCoreField = useCallback(
    (field: keyof CoreStats, updater: (v: number) => number) =>
      setCore((prev) => {
        const nextValue = Math.max(0, updater(prev[field]));
        const next = { ...prev, [field]: nextValue };
        setApproach((prevApproach) => clampApproachToCore(prevApproach, next));
        return next;
      }),
    []
  );
  const setApproachField = useCallback(
    (field: keyof ApproachStats, updater: (v: number) => number) =>
      setApproach((prev) => ({ ...prev, [field]: updater(prev[field]) })),
    []
  );

  const increaseDamageDieSize = useCallback((): DieSides => {
    const nextDie = stepUp(damageDieSize);
    setDamageDieSize(nextDie);
    return nextDie;
  }, [damageDieSize]);

  const resetDamageDieSize = useCallback((): DieSides => {
    setDamageDieSize(DEFAULT_DAMAGE_DIE_SIZE);
    return DEFAULT_DAMAGE_DIE_SIZE;
  }, []);

  const derived = computeDerived(core);
  const inventorySlots = computeInventorySlots(core);
  const isOverEncumbered = gearSlotsUsed > inventorySlots;
  const skillCount = computeSkillCount(core);
  const ganbareMax = computeGanbareCharges(core);
  const ganbareRemaining = Math.max(0, ganbareMax - ganbareSpent);
  const fumbleNumber = computeFumbleNumber(core);

  // Giving Ganbare! is a Free Action: spend 1 Charge, no roll — see the
  // handbook's Ganbare! section. Clamped so a lowered Personality (fewer
  // max Charges) can never leave this negative.
  const spendGanbareCharge = useCallback(() => {
    setGanbareSpent((prev) => Math.min(ganbareMax, prev + 1));
  }, [ganbareMax]);

  // Persist the fields this page owns, merging with whatever the CHUD iframe
  // has saved for the fields it owns (hpCounter, secondary, etc.) so neither
  // side clobbers the other.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(chudStateStorageKey);
      const prev = raw ? JSON.parse(raw) : {};
      // Strip legacy fields no longer part of SaveState (ap, draw,
      // approachDieSize — Method dice are always d10 now) so they don't
      // keep getting echoed back into storage forever via the spread.
      delete prev.ap;
      delete prev.draw;
      delete prev.approachDieSize;
      const merged = { ...prev, core, approach, damageDieSize, wt, inventorySlots, ganbareSpent };
      delete merged.approachDice;
      window.localStorage.setItem(chudStateStorageKey, JSON.stringify(merged));
    } catch {
      // storage unavailable — ignore
    }
  }, [chudStateStorageKey, core, approach, damageDieSize, wt, inventorySlots, ganbareSpent]);

  // Cross-tab / cross-iframe sync for these fields.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === chudStateStorageKey && e.newValue) {
        try {
          const s = JSON.parse(e.newValue);
          if (s.core) setCore(s.core);
          if (s.approach) setApproach(clampApproachToCore(s.approach, s.core ?? core));
          if (isDieSides(s.damageDieSize)) setDamageDieSize(s.damageDieSize);
          if (typeof s.wt === "number") setWtRaw(Math.max(0, s.wt));
          if (typeof s.ganbareSpent === "number") setGanbareSpent(Math.max(0, s.ganbareSpent));
        } catch {
          // malformed storage — ignore
        }
      }
      if (e.key === gearSlotsStorageKey) {
        const data = readGearData(gearSlotsStorageKey);
        setGearSlotsUsed(data?.slotsUsed ?? 0);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [chudStateStorageKey, gearSlotsStorageKey]);

  return (
    <div className="page">
      <div className="aag-page2">
        <Page2Panel
          onOpenMgr={onOpenMgr}
          readyness={derived.readyness}
          isOverEncumbered={isOverEncumbered}
          wt={wt}
          onWtIncr={() => setWt(wt + 1)}
          onWtDecr={() => setWt(wt - 1)}
          capacity={derived.capacity}
          inventorySlots={inventorySlots}
          skillCount={skillCount}
          ganbareRemaining={ganbareRemaining}
          ganbareMax={ganbareMax}
          onSpendGanbare={spendGanbareCharge}
          fumbleNumber={fumbleNumber}
          core={core}
          onCoreChange={setCoreField}
          approach={approach}
          onApproachChange={setApproachField}
          damageDieSize={damageDieSize}
          onDamageDieSizeIncrease={increaseDamageDieSize}
          onDamageDieSizeReset={resetDamageDieSize}
          restWidget={
            <RestWidget storageKey={chudStateStorageKey} deckBuilderStorageKey={deckBuilderStorageKey} core={core} />
          }
        />
      </div>
    </div>
  );
}
