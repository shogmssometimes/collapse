import { useCallback, useEffect, useState } from "react";
import "./chud.css";
import type { ApproachStats, CoreStats, GearSlotEntry, SaveState, SecondaryStats, StatReps } from "../types/chud";
import {
  DEFAULT_APPROACH,
  DEFAULT_DRAW,
  DEFAULT_SECONDARY,
  DEFAULT_STAT_REPS,
  computeDerived,
} from "../domain/chudStats";
import { loadState, readSavedUI, readGearData } from "../utils/chudPersistence";
import { CollapseOverlay } from "./panels/CollapseOverlay";
import { HPVivPanel } from "./panels/HPVivPanel";
import { StatsPanel } from "./panels/StatsPanel";
import { SecondaryStatsPanel } from "./panels/SecondaryStatsPanel";
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
const UI_KEY = _chudSlot === 1 ? "chud.ui.v1" : `chud.ui.slot.${_chudSlot}`;
const GEAR_SLOTS_KEY = _chudSlot === 1 ? "gear.slots.v1" : `gear.slots.slot.${_chudSlot}`;

// ── VivCard, RepCard, StatCard, GearBriefWidget ─────────────────────────────────
// (extracted to ./components/*.tsx)


// ── Chud root ─────────────────────────────────────────────────────────────────

export default function Chud() {
  const saved = loadState(STORAGE_KEY);

  const [core, setCore] = useState<CoreStats>(saved?.core ?? { vigor: 0, inference: 0, personality: 0 });
  const [hpCounter, setHpCounterRaw] = useState<number>(saved?.hpCounter ?? 0);
  const [viv, setVivRaw] = useState<number>(saved?.viv ?? 0);
  const [approach, setApproach] = useState<ApproachStats>(
    saved?.approach ?? DEFAULT_APPROACH
  );
  const [wt, setWtRaw] = useState<number>(saved?.wt ?? 0);
  const [ap, setApRaw] = useState<number>(saved?.ap ?? 0);
  const [draw, setDrawRaw] = useState<number>(saved?.draw ?? DEFAULT_DRAW);
  const [inventorySlots, setInventorySlotsRaw] = useState<number>(saved?.inventorySlots ?? 0);
  const [gearEntries, setGearEntries] = useState<GearSlotEntry[] | null>(() =>
    typeof window !== "undefined" ? (readGearData(GEAR_SLOTS_KEY)?.entries ?? null) : null
  );
  const [gearSlotsUsed, setGearSlotsUsed] = useState<number>(() =>
    typeof window !== "undefined" ? (readGearData(GEAR_SLOTS_KEY)?.slotsUsed ?? 0) : 0
  );
  const [secondary, setSecondary] = useState<SecondaryStats>(
    saved?.secondary ?? DEFAULT_SECONDARY
  );
  const [secondaryOpen, setSecondaryOpen] = useState(() => readSavedUI(UI_KEY).secondaryOpen ?? true);
  const [gearOpen, setGearOpen] = useState(() => readSavedUI(UI_KEY).gearOpen ?? true);
  const [statsOpen, setStatsOpen] = useState(() => readSavedUI(UI_KEY).statsOpen ?? true);
  const [hpVivOpen, setHpVivOpen] = useState(() => readSavedUI(UI_KEY).hpVivOpen ?? true);

  const [levelUpReady, setLevelUpReady] = useState<Record<keyof SecondaryStats, boolean>>({
    vigor: false, inference: false, personality: false,
  });
  const [statReps, setStatReps] = useState<StatReps>(saved?.statReps ?? DEFAULT_STAT_REPS);
  const [statLevelUpReady, setStatLevelUpReady] = useState({ ap: false, draw: false, invSlots: false });
  const [shortRest, setShortRest] = useState<boolean>(saved?.shortRest ?? false);
  const [pushIt, setPushIt] = useState<boolean>(saved?.pushIt ?? false);

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

  // Persist to localStorage
  useEffect(() => {
    try {
      const state: SaveState = { core, hpCounter, viv, approach, wt, ap, draw, inventorySlots, secondary, statReps, shortRest, pushIt };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable — ignore
    }
  }, [core, hpCounter, viv, approach, wt, ap, draw, inventorySlots, secondary, statReps, shortRest, pushIt]);

  // Persist accordion open/close state
  useEffect(() => {
    try {
      const prev = readSavedUI(UI_KEY);
      window.localStorage.setItem(UI_KEY, JSON.stringify({ ...prev, hpVivOpen, statsOpen, secondaryOpen, gearOpen }));
    } catch {}
  }, [hpVivOpen, statsOpen, secondaryOpen, gearOpen]);

  // Cross-tab sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue) as Partial<SaveState>;
        if (s.core) setCore(s.core);
        if (typeof s.hpCounter === "number") setHpCounterRaw(s.hpCounter);
        if (typeof s.viv === "number") setVivRaw(Math.max(0, s.viv));
        if (s.approach) setApproach(s.approach);
        if (typeof s.wt === "number") setWtRaw(Math.max(0, s.wt));
        if (typeof s.ap === "number") setApRaw(Math.max(0, s.ap));
        if (typeof s.draw === "number") setDrawRaw(Math.max(0, s.draw));
        if (typeof s.inventorySlots === "number") setInventorySlotsRaw(Math.max(0, s.inventorySlots));
        if (s.secondary) setSecondary(s.secondary);
        if (s.statReps) setStatReps(s.statReps);
        if (typeof s.shortRest === "boolean") setShortRest(s.shortRest);
        if (typeof s.pushIt === "boolean") setPushIt(s.pushIt);
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
  const setViv = useCallback((v: number) => setVivRaw(Math.max(0, v)), []);
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

  const setSecondaryField = useCallback(
    (field: keyof SecondaryStats, updater: (v: number) => number) =>
      setSecondary((prev) => ({ ...prev, [field]: updater(prev[field]) })),
    []
  );

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

  const resetRep = useCallback(
    (field: keyof SecondaryStats) => {
      setSecondary((prev) => ({ ...prev, [field]: 0 }));
      setLevelUpReady((prev) => ({ ...prev, [field]: false }));
    },
    []
  );

  const confirmLevelUp = useCallback(
    (field: keyof SecondaryStats) => {
      setSecondary((prev) => ({ ...prev, [field]: 0 }));
      setLevelUpReady((prev) => ({ ...prev, [field]: false }));
    },
    []
  );

  const statRepThreshold = useCallback(
    (field: keyof StatReps) => {
      if (field === 'ap') return ap + 1;
      if (field === 'draw') return draw + 1;
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

  const resetStatRep = useCallback(
    (field: keyof StatReps) => {
      setStatReps((prev) => ({ ...prev, [field]: 0 }));
      setStatLevelUpReady((prev) => ({ ...prev, [field]: false }));
    },
    []
  );

  const confirmStatLevelUp = useCallback(
    (field: keyof StatReps) => {
      setStatReps((prev) => ({ ...prev, [field]: 0 }));
      setStatLevelUpReady((prev) => ({ ...prev, [field]: false }));
    },
    []
  );

  const isOverEncumbered = gearSlotsUsed > inventorySlots;

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

          <HPVivPanel
            open={hpVivOpen}
            onToggleOpen={() => setHpVivOpen((o) => !o)}
            hpCounter={hpCounter}
            hpMax={hpMax}
            collapseLocked={collapseLocked}
            onHpIncr={() => setHpCounter(hpCounter + 1)}
            onHpDecr={() => setHpCounter(hpCounter - 1)}
            viv={viv}
            onVivIncr={() => setViv(viv + 1)}
            onVivDecr={() => setViv(viv - 1)}
            wt={wt}
            onWtIncr={() => setWt(wt + 1)}
            onWtDecr={() => setWt(wt - 1)}
            ap={ap}
            onApIncr={() => setAp(ap + 1)}
            onApDecr={() => setAp(ap - 1)}
            draw={draw}
            onDrawIncr={() => setDraw(draw + 1)}
            onDrawDecr={() => setDraw(draw - 1)}
            capacity={derived.capacity}
            readyness={derived.readyness}
            isOverEncumbered={isOverEncumbered}
          />

          <StatsPanel
            open={statsOpen}
            onToggleOpen={() => setStatsOpen((o) => !o)}
            core={core}
            onCoreChange={setCoreField}
            approach={approach}
            onApproachChange={setApproachField}
          />

          <SecondaryStatsPanel
            open={secondaryOpen}
            onToggleOpen={() => setSecondaryOpen((o) => !o)}
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

          <GearPanel
            open={gearOpen}
            onToggleOpen={() => setGearOpen((o) => !o)}
            inventorySlots={inventorySlots}
            onInventoryIncr={() => setInventorySlots(inventorySlots + 1)}
            onInventoryDecr={() => setInventorySlots(inventorySlots - 1)}
            gearEntries={gearEntries}
            gearSlotsUsed={gearSlotsUsed}
            gearSlotsKey={GEAR_SLOTS_KEY}
          />

        </section>
      </div>
    </div>
  );
}

