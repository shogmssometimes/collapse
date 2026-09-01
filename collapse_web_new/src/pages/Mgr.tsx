import { useCallback, useEffect, useState } from "react";
import type { CoreStats, SecondaryStats, StatReps } from "../types/chud";
import { DEFAULT_SECONDARY, DEFAULT_STAT_REPS } from "../domain/chudStats";
import { loadState } from "../utils/chudPersistence";
import { Wallet } from "../chud/components/Wallet";
import { SecondaryStatsPanel } from "../chud/panels/SecondaryStatsPanel";
import "./mgrPage.css";

// MGR page: hosts the Wallet + Reps box (moved out of the CHUD iframe).
// Reads core/ap/draw/inventorySlots (owned by CHUD) read-only for rep
// thresholds, and owns/persists secondary + statReps itself.
export default function MgrPage({
  chudStateStorageKey,
  onCloseMgr,
}: {
  chudStateStorageKey: string;
  onCloseMgr: () => void;
}) {
  const saved = loadState(chudStateStorageKey);

  const [core, setCore] = useState<CoreStats>(saved?.core ?? { vigor: 0, inference: 0, personality: 0 });
  const [ap, setAp] = useState<number>(saved?.ap ?? 0);
  const [draw, setDraw] = useState<number>(saved?.draw ?? 0);
  const [inventorySlots, setInventorySlots] = useState<number>(saved?.inventorySlots ?? 0);

  const [secondary, setSecondary] = useState<SecondaryStats>(saved?.secondary ?? DEFAULT_SECONDARY);
  const [statReps, setStatReps] = useState<StatReps>(saved?.statReps ?? DEFAULT_STAT_REPS);
  const [levelUpReady, setLevelUpReady] = useState<Record<keyof SecondaryStats, boolean>>({
    vigor: false, inference: false, personality: false,
  });
  const [statLevelUpReady, setStatLevelUpReady] = useState({ ap: false, draw: false, invSlots: false });

  // Persist secondary/statReps — read-merge-write so fields owned by CHUD
  // (core/hpCounter/ap/draw/inventorySlots/etc.) aren't clobbered.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(chudStateStorageKey);
      const prev = raw ? JSON.parse(raw) : {};
      const state = { ...prev, secondary, statReps };
      window.localStorage.setItem(chudStateStorageKey, JSON.stringify(state));
    } catch {
      // storage unavailable — ignore
    }
  }, [chudStateStorageKey, secondary, statReps]);

  // Cross-tab/iframe sync: pick up core/ap/draw/inventorySlots changes owned
  // by CHUD, and secondary/statReps changes from other tabs of this page.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== chudStateStorageKey || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue);
        if (s.core) setCore(s.core);
        if (typeof s.ap === "number") setAp(Math.max(0, s.ap));
        if (typeof s.draw === "number") setDraw(Math.max(0, s.draw));
        if (typeof s.inventorySlots === "number") setInventorySlots(Math.max(0, s.inventorySlots));
        if (s.secondary) setSecondary(s.secondary);
        if (s.statReps) setStatReps(s.statReps);
      } catch {
        // malformed storage — ignore
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [chudStateStorageKey]);

  const incrementRep = useCallback(
    (field: keyof SecondaryStats) => {
      const threshold = (core as unknown as Record<string, number>)[field] + 1;
      const current = Number.isFinite(secondary[field]) ? secondary[field] : 0;
      if (current >= threshold) return;
      const next = current + 1;
      setSecondary((prev) => ({ ...prev, [field]: next }));
      if (next >= threshold) {
        setLevelUpReady((prev) => ({ ...prev, [field]: true }));
      }
    },
    [core, secondary]
  );

  const resetRep = useCallback((field: keyof SecondaryStats) => {
    setSecondary((prev) => ({ ...prev, [field]: 0 }));
    setLevelUpReady((prev) => ({ ...prev, [field]: false }));
  }, []);

  const confirmLevelUp = useCallback((field: keyof SecondaryStats) => {
    setSecondary((prev) => ({ ...prev, [field]: 0 }));
    setLevelUpReady((prev) => ({ ...prev, [field]: false }));
  }, []);

  const statRepThreshold = useCallback(
    (field: keyof StatReps) => {
      if (field === "ap") return ap + 1;
      if (field === "draw") return draw + 1;
      return inventorySlots + 1;
    },
    [ap, draw, inventorySlots]
  );

  const incrementStatRep = useCallback(
    (field: keyof StatReps) => {
      const threshold = statRepThreshold(field);
      const current = statReps[field];
      if (current >= threshold) return;
      const next = current + 1;
      setStatReps((prev) => ({ ...prev, [field]: next }));
      if (next >= threshold) setStatLevelUpReady((prev) => ({ ...prev, [field]: true }));
    },
    [statReps, statRepThreshold]
  );

  const resetStatRep = useCallback((field: keyof StatReps) => {
    setStatReps((prev) => ({ ...prev, [field]: 0 }));
    setStatLevelUpReady((prev) => ({ ...prev, [field]: false }));
  }, []);

  const confirmStatLevelUp = useCallback((field: keyof StatReps) => {
    setStatReps((prev) => ({ ...prev, [field]: 0 }));
    setStatLevelUpReady((prev) => ({ ...prev, [field]: false }));
  }, []);

  return (
    <div className="page">
      <div className="mgr-page">
        <div className="row-rdy-mgr">
          <Wallet />
          <button className="topbar-square-btn" onClick={onCloseMgr}>
            XMGR
          </button>
        </div>
        <SecondaryStatsPanel
          secondary={secondary}
          core={core as unknown as Record<string, number>}
          levelUpReady={levelUpReady}
          onIncrementRep={incrementRep}
          onResetRep={resetRep}
          onConfirmLevelUp={confirmLevelUp}
          statReps={statReps}
          statRepThreshold={statRepThreshold}
          statLevelUpReady={statLevelUpReady}
          onIncrementStatRep={incrementStatRep}
          onResetStatRep={resetStatRep}
          onConfirmStatLevelUp={confirmStatLevelUp}
        />

        <div className="mods">
          <div className="csmatrix-preview">
            <iframe
              src={`${import.meta.env.BASE_URL}csmatrix/index.html?mini=1`}
              title="Social Matrix Preview"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

