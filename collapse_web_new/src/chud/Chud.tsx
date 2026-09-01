import { useCallback, useEffect, useState } from "react";
import "./chud.css";
import type { CoreStats, GearSlotEntry, SaveState } from "../types/chud";
import {
  DEFAULT_DRAW,
  DEFAULT_AP,
  DEFAULT_INVENTORY_SLOTS,
  DEFAULT_HP_COUNTER,
  computeDerived,
} from "../domain/chudStats";
import { loadState, readGearData } from "../utils/chudPersistence";
import { CollapseOverlay } from "./panels/CollapseOverlay";
import { HPPanel } from "./panels/HPPanel";
import { GearPanel } from "./panels/GearPanel";

// ── Constants ─────────────────────────────────────────────────────────────────

// Each character slot gets its own isolated storage.
// The main app passes ?slot=N in the iframe src; defaults to 1 for backward compat.
const _chudSlot = (() => {
  if (typeof window === 'undefined') return 1;
  const n = parseInt(new URLSearchParams(window.location.search).get('slot') ?? '1', 10);
  return isNaN(n) || n < 1 || n > 3 ? 1 : n;
})();

const STORAGE_KEY = _chudSlot === 1 ? "chud.state.v1" : `chud.state.slot.${_chudSlot}`;
const GEAR_SLOTS_KEY = _chudSlot === 1 ? "gear.slots.v1" : `gear.slots.slot.${_chudSlot}`;

// ── RepCard, StatCard, GearBriefWidget ─────────────────────────────────
// (extracted to ./components/*.tsx)


// ── Chud root ─────────────────────────────────────────────────────────────────

export default function Chud() {
  const saved = loadState(STORAGE_KEY);

  const [core, setCore] = useState<CoreStats>(saved?.core ?? { vigor: 0, inference: 0, personality: 0 });
  const [hpCounter, setHpCounterRaw] = useState<number>(saved?.hpCounter ?? DEFAULT_HP_COUNTER);
  const [ap, setApRaw] = useState<number>(saved?.ap ?? DEFAULT_AP);
  const [draw, setDrawRaw] = useState<number>(saved?.draw ?? DEFAULT_DRAW);
  const [inventorySlots, setInventorySlotsRaw] = useState<number>(saved?.inventorySlots ?? DEFAULT_INVENTORY_SLOTS);
  const [gearEntries, setGearEntries] = useState<GearSlotEntry[] | null>(() =>
    typeof window !== "undefined" ? (readGearData(GEAR_SLOTS_KEY)?.entries ?? null) : null
  );
  const [gearSlotsUsed, setGearSlotsUsed] = useState<number>(() =>
    typeof window !== "undefined" ? (readGearData(GEAR_SLOTS_KEY)?.slotsUsed ?? 0) : 0
  );

  const [shortRest, setShortRest] = useState<boolean>(saved?.shortRest ?? false);

  const derived = computeDerived(core);
  const hpMax = derived.hp;

  const [collapseUnlocked, setCollapseUnlocked] = useState(hpCounter > 0);

  // Clamp hp counter whenever hp max changes (e.g., vigor changes)
  useEffect(() => {
    setHpCounterRaw((v) => Math.min(Math.max(v, 0), hpMax));
  }, [hpMax]);

  // When HP recovers above 0, reset the unlock flag so the next collapse
  // will show the overlay again.
  useEffect(() => {
    if (hpCounter > 0) setCollapseUnlocked(false);
  }, [hpCounter]);

  // Persist to localStorage. Merge with whatever is currently saved so
  // fields owned by the AAG/MGR pages (approach, wt, secondary, statReps)
  // aren't clobbered.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      const state: SaveState = { ...prev, core, hpCounter, ap, draw, inventorySlots, secondary: prev.secondary, statReps: prev.statReps, shortRest };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable — ignore
    }
  }, [core, hpCounter, ap, draw, inventorySlots, shortRest]);

  // Cross-tab sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue) as Partial<SaveState>;
        if (s.core) setCore(s.core);
        if (typeof s.hpCounter === "number") setHpCounterRaw(s.hpCounter);
        if (typeof s.ap === "number") setApRaw(Math.max(0, s.ap));
        if (typeof s.draw === "number") setDrawRaw(Math.max(0, s.draw));
        if (typeof s.inventorySlots === "number") setInventorySlotsRaw(Math.max(0, s.inventorySlots));
        if (typeof s.shortRest === "boolean") setShortRest(s.shortRest);
      } catch {
        // malformed storage — ignore
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    const gearHandler = (e: StorageEvent) => {
      if (e.key !== GEAR_SLOTS_KEY) return;
      const data = readGearData(GEAR_SLOTS_KEY);
      setGearEntries(data?.entries ?? null);
      setGearSlotsUsed(data?.slotsUsed ?? 0);
    };
    window.addEventListener("storage", gearHandler);
    return () => window.removeEventListener("storage", gearHandler);
  }, []);

  const collapseLocked = hpCounter <= 0 && !collapseUnlocked;

  const setHpCounter = useCallback(
    (v: number) => setHpCounterRaw(Math.min(Math.max(v, 0), hpMax)),
    [hpMax]
  );

  return (
    <div className="app">
      <div className="layout">
        <section
          className={`panel derived-panel-wrapper${collapseLocked ? " collapse-locked" : ""}`}
        >
          <CollapseOverlay
            locked={collapseLocked}
            onRevive={() => setCollapseUnlocked(true)}
          />

          <HPPanel
            hpCounter={hpCounter}
            hpMax={hpMax}
            collapseLocked={collapseLocked}
            onHpIncr={() => setHpCounter(hpCounter + 1)}
            onHpDecr={() => setHpCounter(hpCounter - 1)}
            gearEntries={gearEntries}
            gearSlotsUsed={gearSlotsUsed}
            gearSlotsKey={GEAR_SLOTS_KEY}
            inventorySlots={inventorySlots}
          />

          {/* Combat box (CR/FR) removed; CR/FR now render on the AAG page. */}

        </section>
      </div>
    </div>
  );
}