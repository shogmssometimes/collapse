import { useCallback, useEffect, useState } from "react";
import type { ApproachStats, CoreStats } from "../types/chud";
import { DEFAULT_APPROACH, DEFAULT_DRAW, DEFAULT_WT, DEFAULT_AP, DEFAULT_INVENTORY_SLOTS, computeDerived } from "../domain/chudStats";
import { loadState, readGearData } from "../utils/chudPersistence";
import { Page2Panel } from "../chud/panels/Page2Panel";
import "./aagPage2.css";

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
  const [wt, setWtRaw] = useState<number>(saved?.wt ?? DEFAULT_WT);
  const [ap, setApRaw] = useState<number>(saved?.ap ?? DEFAULT_AP);
  const [draw, setDrawRaw] = useState<number>(saved?.draw ?? DEFAULT_DRAW);
  const [inventorySlots, setInventorySlotsRaw] = useState<number>(saved?.inventorySlots ?? DEFAULT_INVENTORY_SLOTS);
  const [gearSlotsUsed, setGearSlotsUsed] = useState<number>(() =>
    typeof window !== "undefined" ? (readGearData(gearSlotsStorageKey)?.slotsUsed ?? 0) : 0
  );

  const setWt = useCallback((v: number) => setWtRaw(Math.max(0, v)), []);
  const setAp = useCallback((v: number) => setApRaw(Math.max(0, v)), []);
  const setDraw = useCallback((v: number) => setDrawRaw(Math.max(0, v)), []);
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

  const derived = computeDerived(core);
  const isOverEncumbered = gearSlotsUsed > inventorySlots;

  // Persist the fields this page owns, merging with whatever the CHUD iframe
  // has saved for the fields it owns (hpCounter, secondary, statReps, etc.)
  // so neither side clobbers the other.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(chudStateStorageKey);
      const prev = raw ? JSON.parse(raw) : {};
      const merged = { ...prev, core, approach, wt, ap, draw, inventorySlots };
      window.localStorage.setItem(chudStateStorageKey, JSON.stringify(merged));
    } catch {
      // storage unavailable — ignore
    }
  }, [chudStateStorageKey, core, approach, wt, ap, draw, inventorySlots]);

  // Cross-tab / cross-iframe sync for these fields.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === chudStateStorageKey && e.newValue) {
        try {
          const s = JSON.parse(e.newValue);
          if (s.core) setCore(s.core);
          if (s.approach) setApproach(s.approach);
          if (typeof s.wt === "number") setWtRaw(Math.max(0, s.wt));
          if (typeof s.ap === "number") setApRaw(Math.max(0, s.ap));
          if (typeof s.draw === "number") setDrawRaw(Math.max(0, s.draw));
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
          draw={draw}
          onDrawIncr={() => setDraw(draw + 1)}
          onDrawDecr={() => setDraw(draw - 1)}
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
          chudStateStorageKey={chudStateStorageKey}
        />
      </div>
    </div>
  );
}
