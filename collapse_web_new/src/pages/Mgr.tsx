import { useCallback, useEffect, useMemo, useState } from "react";
import type { CoreStats, SecondaryStats, StatReps } from "../types/chud";
import { DEFAULT_SECONDARY, DEFAULT_STAT_REPS, DEFAULT_INVENTORY_SLOTS } from "../domain/chudStats";
import { loadState } from "../utils/chudPersistence";
import { Wallet } from "../chud/components/Wallet";
import { SecondaryStatsPanel } from "../chud/panels/SecondaryStatsPanel";
import "./mgrPage.css";

// MGR page: hosts the Wallet + Reps box (moved out of the CHUD iframe).
// Reads core/inventorySlots (owned by CHUD) read-only for rep
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
  const [inventorySlots, setInventorySlots] = useState<number>(saved?.inventorySlots ?? DEFAULT_INVENTORY_SLOTS);

  const [secondary, setSecondary] = useState<SecondaryStats>(saved?.secondary ?? DEFAULT_SECONDARY);
  const [statReps, setStatReps] = useState<StatReps>(saved?.statReps ?? DEFAULT_STAT_REPS);

  // Derived (not separately persisted) so the gold "ready" badge survives a
  // refresh — it's purely a function of secondary/statReps vs. their
  // thresholds, which are already persisted above.
  const levelUpReady = useMemo<Record<keyof SecondaryStats, boolean>>(() => ({
    vigor: secondary.vigor >= core.vigor + 1,
    inference: secondary.inference >= core.inference + 1,
    personality: secondary.personality >= core.personality + 1,
  }), [secondary, core]);
  const statLevelUpReady = useMemo(
    () => ({ invSlots: statReps.invSlots >= inventorySlots + 1 }),
    [statReps, inventorySlots]
  );

  // Persist secondary/statReps — read-merge-write so fields owned by CHUD
  // (core/hpCounter/draw/inventorySlots/etc.) aren't clobbered.
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

  // Cross-tab/iframe sync: pick up core/inventorySlots changes owned
  // by CHUD, and secondary/statReps changes from other tabs of this page.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== chudStateStorageKey || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue);
        if (s.core) setCore(s.core);
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
      setSecondary((prev) => ({ ...prev, [field]: current + 1 }));
    },
    [core, secondary]
  );

  const resetRep = useCallback((field: keyof SecondaryStats) => {
    setSecondary((prev) => ({ ...prev, [field]: 0 }));
  }, []);

  const confirmLevelUp = useCallback((field: keyof SecondaryStats) => {
    setSecondary((prev) => ({ ...prev, [field]: 0 }));
  }, []);

  const statRepThreshold = useCallback(
    (_field: keyof StatReps) => inventorySlots + 1,
    [inventorySlots]
  );

  const incrementStatRep = useCallback(
    (field: keyof StatReps) => {
      const threshold = statRepThreshold(field);
      const current = statReps[field];
      if (current >= threshold) return;
      setStatReps((prev) => ({ ...prev, [field]: current + 1 }));
    },
    [statReps, statRepThreshold]
  );

  const resetStatRep = useCallback((field: keyof StatReps) => {
    setStatReps((prev) => ({ ...prev, [field]: 0 }));
  }, []);

  const confirmStatLevelUp = useCallback((field: keyof StatReps) => {
    setStatReps((prev) => ({ ...prev, [field]: 0 }));
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

