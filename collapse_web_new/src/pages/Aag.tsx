import { useCallback, useEffect, useState } from "react";
import type { ApproachStats, CoreStats } from "../types/chud";
import { DEFAULT_APPROACH, DEFAULT_DRAW, DEFAULT_WT, DEFAULT_AP, DEFAULT_INVENTORY_SLOTS, computeDerived } from "../domain/chudStats";
import {
  DEFAULT_DIE_SIZE,
  fullRestOverload,
  isDieSides,
  rollApproachDice,
  spendOverloadDie,
  stepUp,
  type DieSides,
} from "../domain/approachDice";
import type { ApproachDieRollResult } from "../chud/components/ApproachDie";
import { loadState, readGearData } from "../utils/chudPersistence";
import { Page2Panel } from "../chud/panels/Page2Panel";
import "./aagPage2.css";

const DEFAULT_DAMAGE_DIE_SIZE: DieSides = 4;

// AAG page: hosts the Page 2 box (moved out of the CHUD iframe). Reads and
// writes the same persisted cHUD state so the two stay in sync.
export default function AagPage({
  chudStateStorageKey,
  gearSlotsStorageKey,
  onOpenMgr,
}: {
  chudStateStorageKey: string;
  gearSlotsStorageKey: string;
  onOpenMgr: () => void;
}) {
  const saved = loadState(chudStateStorageKey);

  const [core, setCore] = useState<CoreStats>(saved?.core ?? { vigor: 0, inference: 0, personality: 0 });
  const [approach, setApproach] = useState<ApproachStats>(saved?.approach ?? DEFAULT_APPROACH);
  const [approachDieSize, setApproachDieSize] = useState<DieSides>(
    isDieSides(saved?.approachDieSize) ? saved.approachDieSize : DEFAULT_DIE_SIZE
  );
  const [damageDieSize, setDamageDieSize] = useState<DieSides>(
    isDieSides(saved?.damageDieSize) ? saved.damageDieSize : DEFAULT_DAMAGE_DIE_SIZE
  );
  const [approachOverloadSpent, setApproachOverloadSpent] = useState<Partial<Record<keyof ApproachStats, number>>>(
    saved?.approachOverloadSpent ?? {}
  );
  const [wt, setWtRaw] = useState<number>(saved?.wt ?? DEFAULT_WT);
  const [ap, setApRaw] = useState<number>(saved?.ap ?? DEFAULT_AP);
  // Draw no longer has editable UI on the AAG page, but the value is still
  // read by the MGR page's Reps tracker, so it's kept here only to avoid
  // clobbering it on every persist.
  const [draw] = useState<number>(saved?.draw ?? DEFAULT_DRAW);
  const [inventorySlots, setInventorySlotsRaw] = useState<number>(saved?.inventorySlots ?? DEFAULT_INVENTORY_SLOTS);
  const [gearSlotsUsed, setGearSlotsUsed] = useState<number>(() =>
    typeof window !== "undefined" ? (readGearData(gearSlotsStorageKey)?.slotsUsed ?? 0) : 0
  );

  const setWt = useCallback((v: number) => setWtRaw(Math.max(0, v)), []);
  const setAp = useCallback((v: number) => setApRaw(Math.max(0, v)), []);
  const setInventorySlots = useCallback((v: number) => setInventorySlotsRaw(Math.max(0, v)), []);

  const setCoreField = useCallback(
    (field: keyof CoreStats, updater: (v: number) => number) =>
      setCore((prev) => ({ ...prev, [field]: updater(prev[field]) })),
    []
  );
  const setApproachField = useCallback(
    (field: keyof ApproachStats, updater: (v: number) => number) =>
      setApproach((prev) => ({ ...prev, [field]: updater(prev[field]) })),
    []
  );

  const increaseApproachDieSize = useCallback((): DieSides => {
    const nextDie = stepUp(approachDieSize);
    setApproachDieSize(nextDie);
    return nextDie;
  }, [approachDieSize]);

  const resetApproachDieSize = useCallback((): DieSides => {
    setApproachDieSize(DEFAULT_DIE_SIZE);
    return DEFAULT_DIE_SIZE;
  }, []);

  const increaseDamageDieSize = useCallback((): DieSides => {
    const nextDie = stepUp(damageDieSize);
    setDamageDieSize(nextDie);
    return nextDie;
  }, [damageDieSize]);

  const resetDamageDieSize = useCallback((): DieSides => {
    setDamageDieSize(DEFAULT_DAMAGE_DIE_SIZE);
    return DEFAULT_DAMAGE_DIE_SIZE;
  }, []);

  const rollApproachDie = useCallback((_field: keyof ApproachStats, count: number): ApproachDieRollResult => {
    return rollApproachDice(count, approachDieSize);
  }, [approachDieSize]);

  const overloadApproachDie = useCallback((field: keyof ApproachStats): boolean => {
    const rating = approach[field];
    const spent = approachOverloadSpent[field] ?? 0;
    const next = spendOverloadDie(rating, spent);
    if (next === spent) return false; // pool already exhausted
    setApproachOverloadSpent((prev) => ({ ...prev, [field]: next }));
    return true;
  }, [approach, approachOverloadSpent]);

  const fullRestApproachDice = useCallback(() => {
    setApproachOverloadSpent((prev) => {
      const next: Partial<Record<keyof ApproachStats, number>> = { ...prev };
      for (const field of Object.keys(next) as Array<keyof ApproachStats>) next[field] = fullRestOverload();
      return next;
    });
  }, []);

  const derived = computeDerived(core);
  const isOverEncumbered = gearSlotsUsed > inventorySlots;

  // Persist the fields this page owns, merging with whatever the CHUD iframe
  // has saved for the fields it owns (hpCounter, secondary, statReps, etc.)
  // so neither side clobbers the other.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(chudStateStorageKey);
      const prev = raw ? JSON.parse(raw) : {};
      const merged = { ...prev, core, approach, approachDieSize, damageDieSize, approachOverloadSpent, wt, ap, draw, inventorySlots };
      delete merged.approachDice;
      window.localStorage.setItem(chudStateStorageKey, JSON.stringify(merged));
    } catch {
      // storage unavailable — ignore
    }
  }, [chudStateStorageKey, core, approach, approachDieSize, damageDieSize, approachOverloadSpent, wt, ap, draw, inventorySlots]);

  // Cross-tab / cross-iframe sync for these fields.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === chudStateStorageKey && e.newValue) {
        try {
          const s = JSON.parse(e.newValue);
          if (s.core) setCore(s.core);
          if (s.approach) setApproach(s.approach);
          if (isDieSides(s.approachDieSize)) setApproachDieSize(s.approachDieSize);
          if (isDieSides(s.damageDieSize)) setDamageDieSize(s.damageDieSize);
          if (s.approachOverloadSpent) setApproachOverloadSpent(s.approachOverloadSpent);
          if (typeof s.wt === "number") setWtRaw(Math.max(0, s.wt));
          if (typeof s.ap === "number") setApRaw(Math.max(0, s.ap));
          if (typeof s.inventorySlots === "number") setInventorySlotsRaw(Math.max(0, s.inventorySlots));
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
          ap={ap}
          onApIncr={() => setAp(ap + 1)}
          onApDecr={() => setAp(ap - 1)}
          capacity={derived.capacity}
          inventorySlots={inventorySlots}
          onInventoryIncr={() => setInventorySlots(inventorySlots + 1)}
          onInventoryDecr={() => setInventorySlots(inventorySlots - 1)}
          core={core}
          onCoreChange={setCoreField}
          approach={approach}
          onApproachChange={setApproachField}
          approachDieSize={approachDieSize}
          onApproachDieSizeIncrease={increaseApproachDieSize}
          onApproachDieSizeReset={resetApproachDieSize}
          damageDieSize={damageDieSize}
          onDamageDieSizeIncrease={increaseDamageDieSize}
          onDamageDieSizeReset={resetDamageDieSize}
          onRollApproachDie={rollApproachDie}
          approachOverloadSpent={approachOverloadSpent}
          onOverloadApproachDie={overloadApproachDie}
          onFullRestApproachDice={fullRestApproachDice}
          chudStateStorageKey={chudStateStorageKey}
        />
      </div>
    </div>
  );
}
