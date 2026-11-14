import { useCallback, useEffect, useMemo, useState } from "react";
import type { CoreStats, SecondaryStats } from "../types/chud";
import { DEFAULT_SECONDARY } from "../domain/chudStats";
import { loadState } from "../utils/chudPersistence";
import { Wallet } from "../chud/components/Wallet";
import { SecondaryStatsPanel } from "../chud/panels/SecondaryStatsPanel";
import "./mgrPage.css";

// MGR page: hosts the Wallet + Reps box (moved out of the CHUD iframe).
// Reads core (owned by CHUD) read-only for rep thresholds, and owns/persists
// secondary itself.
export default function MgrPage({
  chudStateStorageKey,
  charSlot = 1,
  onCloseMgr,
}: {
  chudStateStorageKey: string;
  charSlot?: number;
  onCloseMgr: () => void;
}) {
  const saved = loadState(chudStateStorageKey);

  const [core, setCore] = useState<CoreStats>(saved?.core ?? { vigor: 0, inference: 0, personality: 0 });

  const [secondary, setSecondary] = useState<SecondaryStats>(saved?.secondary ?? DEFAULT_SECONDARY);

  // Derived (not separately persisted) so the gold "ready" badge survives a
  // refresh — it's purely a function of secondary vs. its thresholds, which
  // are already persisted above.
  const levelUpReady = useMemo<Record<keyof SecondaryStats, boolean>>(() => ({
    vigor: secondary.vigor >= core.vigor + 1,
    inference: secondary.inference >= core.inference + 1,
    personality: secondary.personality >= core.personality + 1,
  }), [secondary, core]);

  // Persist secondary — read-merge-write so fields owned by CHUD
  // (core/hpCounter/inventorySlots/etc.) aren't clobbered.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(chudStateStorageKey);
      const prev = raw ? JSON.parse(raw) : {};
      const state = { ...prev, secondary };
      window.localStorage.setItem(chudStateStorageKey, JSON.stringify(state));
    } catch {
      // storage unavailable — ignore
    }
  }, [chudStateStorageKey, secondary]);

  // Cross-tab/iframe sync: pick up core changes owned by CHUD, and secondary
  // changes from other tabs of this page.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== chudStateStorageKey || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue);
        if (s.core) setCore(s.core);
        if (s.secondary) setSecondary(s.secondary);
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

  return (
    <div className="page">
      <div className="mgr-page">
        <div className="row-rdy-mgr">
          <Wallet charSlot={charSlot} />
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
        />

        <div className="mods">
          <div className="csmatrix-preview">
            <iframe
              src={`${import.meta.env.BASE_URL}csmatrix/index.html?mini=1&slot=${charSlot}`}
              title="Social Matrix Preview"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
