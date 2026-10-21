import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./chud.css";
import type { ApproachStats, CoreStats, GearSlotEntry, SaveState } from "../types/chud";
import {
  DEFAULT_INVENTORY_SLOTS,
  DEFAULT_HP_COUNTER,
  DEFAULT_APPROACH,
  computeDerived,
} from "../domain/chudStats";
import {
  DEFAULT_DIE_SIZE,
  isDieSides,
  rollApproachDice,
  spendOverloadDie,
  stepUp,
  type DieSides,
} from "../domain/approachDice";
import type { ApproachDieRollResult } from "./components/ApproachDie";
import { clampApproachToCore } from "../domain/coreApproachMap";
import { computeWardrobeBonuses } from "../domain/wardrobeBonus";
import { loadState, readGearData, readWardrobeData } from "../utils/chudPersistence";
import { wardrobeKey } from "../utils/slotKeys";
import { adjustGlobalMeters } from "../utils/chudVanillaBridge";
import {
  NOTIFICATIONS_STORAGE_KEY,
  hasPendingNotification,
  listNotifications,
  pushNotification,
  removeNotification,
  type PendingNotification,
} from "../domain/notifications";
import { CollapseOverlay } from "./panels/CollapseOverlay";
import { HPPanel } from "./panels/HPPanel";
import { GearPanel } from "./panels/GearPanel";
import { ApproachPanel } from "./components/ApproachPanel";

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
const WARDROBE_KEY = wardrobeKey(_chudSlot);
const DEFAULT_DAMAGE_DIE_SIZE: DieSides = 4;

// ── RepCard, StatCard, GearBriefWidget ─────────────────────────────────
// (extracted to ./components/*.tsx)


// ── Chud root ─────────────────────────────────────────────────────────────────

export default function Chud() {
  const saved = loadState(STORAGE_KEY);

  const [core, setCore] = useState<CoreStats>(saved?.core ?? { vigor: 0, inference: 0, personality: 0 });
  const [approach, setApproach] = useState<ApproachStats>(() => clampApproachToCore(saved?.approach ?? DEFAULT_APPROACH, saved?.core ?? { vigor: 0, inference: 0, personality: 0 }));
  const [approachDieSize, setApproachDieSize] = useState<DieSides>(
    isDieSides(saved?.approachDieSize) ? saved.approachDieSize : DEFAULT_DIE_SIZE
  );
  const [damageDieSize, setDamageDieSize] = useState<DieSides>(
    isDieSides(saved?.damageDieSize) ? saved.damageDieSize : DEFAULT_DAMAGE_DIE_SIZE
  );
  const [approachOverloadSpent, setApproachOverloadSpent] = useState<Partial<Record<keyof ApproachStats, number>>>(
    saved?.approachOverloadSpent ?? {}
  );
  const [hpCounter, setHpCounterRaw] = useState<number>(saved?.hpCounter ?? DEFAULT_HP_COUNTER);
  const [inventorySlots, setInventorySlotsRaw] = useState<number>(saved?.inventorySlots ?? DEFAULT_INVENTORY_SLOTS);
  const [gearEntries, setGearEntries] = useState<GearSlotEntry[] | null>(() =>
    typeof window !== "undefined" ? (readGearData(GEAR_SLOTS_KEY)?.entries ?? null) : null
  );
  const [gearSlotsUsed, setGearSlotsUsed] = useState<number>(() =>
    typeof window !== "undefined" ? (readGearData(GEAR_SLOTS_KEY)?.slotsUsed ?? 0) : 0
  );
  const [wardrobeEntries, setWardrobeEntries] = useState(() =>
    typeof window !== "undefined" ? readWardrobeData(WARDROBE_KEY) : []
  );
  const { bonus: approachWardrobeBonus, items: approachWardrobeItems } = useMemo(
    () => computeWardrobeBonuses(wardrobeEntries),
    [wardrobeEntries]
  );

  const [shortRest, setShortRest] = useState<boolean>(saved?.shortRest ?? false);

  const derived = computeDerived(core);
  const hpMax = derived.hp;

  const [notifications, setNotifications] = useState<PendingNotification[]>(() =>
    typeof window !== "undefined" ? listNotifications() : []
  );

  // Clamp hp counter whenever hp max changes (e.g., vigor changes)
  useEffect(() => {
    setHpCounterRaw((v) => Math.min(Math.max(v, 0), hpMax));
  }, [hpMax]);

  // HP hitting 0 queues an "hp-zero" notification (if one isn't already
  // pending) instead of auto-applying +1 Collapse. Only fires on the
  // transition from >0 down to <=0 so it can't re-queue while already dead.
  const prevHpRef = useRef(hpCounter);
  useEffect(() => {
    const prev = prevHpRef.current;
    prevHpRef.current = hpCounter;
    if (prev > 0 && hpCounter <= 0 && !hasPendingNotification("hp-zero")) {
      const created = pushNotification(
        "hp-zero",
        "HP reached 0",
        "Accept to apply +1 Collapse and revive with 1 HP, or cancel to clear without it.",
        { collapse: 1, hp: 1 }
      );
      if (created) setNotifications(listNotifications());
    }
  }, [hpCounter]);

  // Cross-realm notification sync (another window/iframe pushed or resolved one).
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== NOTIFICATIONS_STORAGE_KEY) return;
      setNotifications(listNotifications());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const increaseApproachDieSize = useCallback((): DieSides => {
    const nextDie = stepUp(approachDieSize);
    setApproachDieSize(nextDie);
    return nextDie;
  }, [approachDieSize]);

  const resetApproachDieSize = useCallback((): DieSides => {
    setApproachDieSize(DEFAULT_DIE_SIZE);
    return DEFAULT_DIE_SIZE;
  }, []);

  const rollApproachDie = useCallback((_field: keyof ApproachStats, count: number): ApproachDieRollResult => {
    return rollApproachDice(count, approachDieSize);
  }, [approachDieSize]);

  const overloadApproachDie = useCallback((field: keyof ApproachStats): boolean => {
    const rating = approach[field] + (approachWardrobeBonus[field] ?? 0);
    const spent = approachOverloadSpent[field] ?? 0;
    const next = spendOverloadDie(rating, spent);
    if (next === spent) return false; // pool already exhausted
    setApproachOverloadSpent((prev) => ({ ...prev, [field]: next }));
    return true;
  }, [approach, approachOverloadSpent, approachWardrobeBonus]);

  // Persist to localStorage. Merge with whatever is currently saved so
  // fields owned by the AAG/MGR pages (wt, secondary, statReps) aren't
  // clobbered. `approach` itself (the distributed ratings) is owned by the
  // AAG page too — this is only ever an echo of the synced value, never a
  // write from here — but approachDieSize/damageDieSize/approachOverloadSpent
  // are owned here now that the Approach dice live in the HUD.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      // Strip legacy fields no longer part of SaveState (ap, draw) so they
      // don't keep getting echoed back into storage forever via the spread.
      delete (prev as Record<string, unknown>).ap;
      delete (prev as Record<string, unknown>).draw;
      const state: SaveState = {
        ...prev,
        core,
        hpCounter,
        approach,
        approachDieSize,
        damageDieSize,
        approachOverloadSpent,
        inventorySlots,
        secondary: prev.secondary,
        statReps: prev.statReps,
        shortRest,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable — ignore
    }
  }, [core, hpCounter, approach, approachDieSize, damageDieSize, approachOverloadSpent, inventorySlots, shortRest]);

  // Cross-tab sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue) as Partial<SaveState>;
        if (s.core) setCore(s.core);
        if (s.approach) setApproach(clampApproachToCore(s.approach, s.core ?? core));
        if (isDieSides(s.approachDieSize)) setApproachDieSize(s.approachDieSize);
        if (isDieSides(s.damageDieSize)) setDamageDieSize(s.damageDieSize);
        if (s.approachOverloadSpent) setApproachOverloadSpent(s.approachOverloadSpent);
        if (typeof s.hpCounter === "number") setHpCounterRaw(s.hpCounter);
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

  useEffect(() => {
    const wardrobeHandler = (e: StorageEvent) => {
      if (e.key !== WARDROBE_KEY) return;
      setWardrobeEntries(readWardrobeData(WARDROBE_KEY));
    };
    window.addEventListener("storage", wardrobeHandler);
    return () => window.removeEventListener("storage", wardrobeHandler);
  }, []);

  const hpZeroNotification = notifications.find((n) => n.kind === "hp-zero") ?? null;
  const collapseLocked = hpZeroNotification != null;

  const setHpCounter = useCallback(
    (v: number) => setHpCounterRaw(Math.min(Math.max(v, 0), hpMax)),
    [hpMax]
  );

  const resolveNotification = useCallback(
    (id: string, accept: boolean) => {
      const n = notifications.find((item) => item.id === id);
      if (!n) return;
      if (accept) {
        if (n.effect.hp) setHpCounter(hpCounter + n.effect.hp);
        if (n.effect.grit != null || n.effect.collapse != null) {
          adjustGlobalMeters({ grit: n.effect.grit, collapse: n.effect.collapse });
        }
      }
      removeNotification(id);
      setNotifications(listNotifications());
    },
    [notifications, hpCounter, setHpCounter]
  );

  return (
    <div className="app">
      <div className="layout">
        <section
          className={`panel derived-panel-wrapper${collapseLocked ? " collapse-locked" : ""}`}
        >
          <CollapseOverlay
            notification={hpZeroNotification}
            onAccept={(id) => resolveNotification(id, true)}
            onCancel={(id) => resolveNotification(id, false)}
            onTapRecorded={() => setNotifications(listNotifications())}
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

          <ApproachPanel
            approach={approach}
            approachDieSize={approachDieSize}
            onApproachDieSizeIncrease={increaseApproachDieSize}
            onApproachDieSizeReset={resetApproachDieSize}
            damageDieSize={damageDieSize}
            onRollApproachDie={rollApproachDie}
            approachOverloadSpent={approachOverloadSpent}
            onOverloadApproachDie={overloadApproachDie}
            approachWardrobeBonus={approachWardrobeBonus}
            approachWardrobeItems={approachWardrobeItems}
          />

        </section>
      </div>
    </div>
  );
}