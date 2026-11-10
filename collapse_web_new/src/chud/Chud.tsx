import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./chud.css";
import type { ApproachStats, CollapsePath, CoreStats, GearSlotEntry, SaveState } from "../types/chud";
import {
  DEFAULT_HP_COUNTER,
  DEFAULT_APPROACH,
  computeDerived,
  computeInventorySlots,
} from "../domain/chudStats";
import {
  isDieSides,
  rollApproachDice,
  spendOverloadDie,
  type DieSides,
} from "../domain/approachDice";
import type { ApproachDieRollResult } from "./components/ApproachDie";
import { clampApproachToCore, clampCore } from "../domain/coreApproachMap";
import { computeWardrobeBonuses } from "../domain/wardrobeBonus";
import { loadState, readGearData, readWardrobeData } from "../utils/chudPersistence";
import { wardrobeKey, deckBuilderKey } from "../utils/slotKeys";
import { adjustGlobalMeters, setChipDesynced, resetApproachOverload } from "../utils/chudVanillaBridge";
import { fullRestEngrams, grantEngramRestoreBudget, readEngramState, type EngramManagerState } from "../utils/engramState";
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
const DECK_BUILDER_KEY = deckBuilderKey(_chudSlot);
const DEFAULT_DAMAGE_DIE_SIZE: DieSides = 4;

// ── RepCard, StatCard, GearBriefWidget ─────────────────────────────────
// (extracted to ./components/*.tsx)


// ── Chud root ─────────────────────────────────────────────────────────────────

export default function Chud() {
  const saved = loadState(STORAGE_KEY);

  const [core, setCore] = useState<CoreStats>(clampCore(saved?.core ?? { vigor: 0, inference: 0, personality: 0 }));
  const [approach, setApproach] = useState<ApproachStats>(() => clampApproachToCore(saved?.approach ?? DEFAULT_APPROACH, clampCore(saved?.core ?? { vigor: 0, inference: 0, personality: 0 })));
  const [damageDieSize, setDamageDieSize] = useState<DieSides>(
    isDieSides(saved?.damageDieSize) ? saved.damageDieSize : DEFAULT_DAMAGE_DIE_SIZE
  );
  const [approachOverloadSpent, setApproachOverloadSpent] = useState<Partial<Record<keyof ApproachStats, number>>>(
    saved?.approachOverloadSpent ?? {}
  );
  const [approachWardrobeOverloadSpent, setApproachWardrobeOverloadSpent] = useState<
    Partial<Record<keyof ApproachStats, number>>
  >(saved?.approachWardrobeOverloadSpent ?? {});
  const [hpCounter, setHpCounterRaw] = useState<number>(saved?.hpCounter ?? DEFAULT_HP_COUNTER);
  const [hasBeenDownedBefore, setHasBeenDownedBefore] = useState<boolean>(saved?.hasBeenDownedBefore ?? false);
  const [collapsePath, setCollapsePathState] = useState<CollapsePath | undefined>(saved?.collapsePath);
  const [gearEntries, setGearEntries] = useState<GearSlotEntry[] | null>(() =>
    typeof window !== "undefined" ? (readGearData(GEAR_SLOTS_KEY)?.entries ?? null) : null
  );
  const [gearSlotsUsed, setGearSlotsUsed] = useState<number>(() =>
    typeof window !== "undefined" ? (readGearData(GEAR_SLOTS_KEY)?.slotsUsed ?? 0) : 0
  );
  const [engramState, setEngramState] = useState<EngramManagerState>(() =>
    typeof window !== "undefined" ? readEngramState(DECK_BUILDER_KEY) : { equipped: {}, pendingEngramRestoreBudget: 0 }
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
  const inventorySlots = computeInventorySlots(core);

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
  // The very first time this ever happens for this character, it also queues
  // a one-time "Choose Your Path" (Live/Survive/Die) notification — the
  // book's Collapse Table reminder (queued separately, on hp-zero accept)
  // references whichever path the player picks here.
  const prevHpRef = useRef(hpCounter);
  const hasBeenDownedBeforeRef = useRef(hasBeenDownedBefore);
  hasBeenDownedBeforeRef.current = hasBeenDownedBefore;
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
      if (!hasBeenDownedBeforeRef.current) {
        setHasBeenDownedBefore(true);
        pushNotification(
          "choose-path",
          "Choose Your Path",
          "You've gone down for the first time. This choice determines which Collapse Table you'll roll on from now on.",
          {},
          {
            choices: [
              { key: "live", label: "Live" },
              { key: "survive", label: "Survive" },
              { key: "die", label: "Die" },
            ],
          }
        );
      }
      if (created || !hasBeenDownedBeforeRef.current) setNotifications(listNotifications());
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

  const rollApproachDie = useCallback((_field: keyof ApproachStats, count: number): ApproachDieRollResult => {
    return rollApproachDice(count);
  }, []);

  // Overload spends from two independent pools: the base (Core-distributed)
  // Method pool, and each Method's own Wardrobe-bonus pool — Wardrobe dice
  // are always rolled alongside the base pool, but doubling one spends its
  // own charge from its own pool (capped at that Method's current Wardrobe
  // bonus), the same way doubling a base die spends from the base pool
  // (capped at the base rating). Neither pool restores until Full Rest (or
  // a received Ganbare!, base pool only).
  //
  // Takes the full count of doubled dice (split by source) to spend at
  // once (resolved together), rather than being called once per die:
  // reading approachOverloadSpent[field] from the outer closure and calling
  // this N times in the same tick would read the *same* stale "spent" value
  // on every call (React doesn't re-render mid-batch), so N calls only ever
  // advanced the pool by 1 instead of N. Reading prev[field] from inside
  // the setState updater itself (always fresh, even across repeated
  // synchronous updates) fixes that.
  const overloadApproachDie = useCallback((field: keyof ApproachStats, baseCount: number, wardrobeCount: number): boolean => {
    const baseRating = approach[field];
    const wardrobeBonus = approachWardrobeBonus[field] ?? 0;
    let fullySpent = true;
    if (baseCount > 0) {
      setApproachOverloadSpent((prev) => {
        let spent = prev[field] ?? 0;
        for (let i = 0; i < baseCount; i++) {
          const next = spendOverloadDie(baseRating, spent);
          if (next === spent) { fullySpent = false; break; } // pool already exhausted
          spent = next;
        }
        if (spent === (prev[field] ?? 0)) return prev;
        return { ...prev, [field]: spent };
      });
    }
    if (wardrobeCount > 0) {
      setApproachWardrobeOverloadSpent((prev) => {
        let spent = prev[field] ?? 0;
        for (let i = 0; i < wardrobeCount; i++) {
          const next = spendOverloadDie(wardrobeBonus, spent);
          if (next === spent) { fullySpent = false; break; } // pool already exhausted
          spent = next;
        }
        if (spent === (prev[field] ?? 0)) return prev;
        return { ...prev, [field]: spent };
      });
    }
    return fullySpent;
  }, [approach, approachWardrobeBonus]);


  // "Receive Ganbare!" — a friend spends one of *their* Ganbare! Charges to
  // return one of your Overloaded dice to its Method pool (handbook: "or
  // until a friend gives you Ganbare! for it"). This doesn't touch this
  // character's own Ganbare! Charges (ganbareSpent) — that pool is only for
  // *giving* Ganbare! to someone else. Restores at most 1 die, capped so
  // the pool never exceeds its base rating.
  const receiveGanbare = useCallback((field: keyof ApproachStats): void => {
    setApproachOverloadSpent((prev) => {
      const spent = prev[field] ?? 0;
      if (spent <= 0) return prev;
      return { ...prev, [field]: spent - 1 };
    });
  }, []);

  // Persist to localStorage. Merge with whatever is currently saved so
  // fields owned by the AAG/MGR pages (wt, secondary) aren't clobbered.
  // `approach` itself (the distributed ratings) is owned by the
  // AAG page too — this is only ever an echo of the synced value, never a
  // write from here — but damageDieSize/approachOverloadSpent are owned
  // here now that the Approach dice live in the HUD.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      // Strip legacy fields no longer part of SaveState (ap, draw,
      // approachDieSize — Method dice are always d10 now) so they don't
      // keep getting echoed back into storage forever via the spread.
      delete (prev as Record<string, unknown>).ap;
      delete (prev as Record<string, unknown>).draw;
      delete (prev as Record<string, unknown>).approachDieSize;
      const state: SaveState = {
        ...prev,
        core,
        hpCounter,
        approach,
        damageDieSize,
        approachOverloadSpent,
        approachWardrobeOverloadSpent,
        inventorySlots,
        secondary: prev.secondary,
        shortRest,
        hasBeenDownedBefore,
        collapsePath,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable — ignore
    }
  }, [core, hpCounter, approach, damageDieSize, approachOverloadSpent, approachWardrobeOverloadSpent, inventorySlots, shortRest, hasBeenDownedBefore, collapsePath]);

  // Cross-tab sync
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue) as Partial<SaveState>;
        if (s.core) setCore(clampCore(s.core));
        if (s.approach) setApproach(clampApproachToCore(s.approach, clampCore(s.core ?? core)));
        if (isDieSides(s.damageDieSize)) setDamageDieSize(s.damageDieSize);
        if (s.approachOverloadSpent) setApproachOverloadSpent(s.approachOverloadSpent);
        if (s.approachWardrobeOverloadSpent) setApproachWardrobeOverloadSpent(s.approachWardrobeOverloadSpent);
        if (typeof s.hpCounter === "number") setHpCounterRaw(s.hpCounter);
        if (typeof s.shortRest === "boolean") setShortRest(s.shortRest);
        if (typeof s.hasBeenDownedBefore === "boolean") setHasBeenDownedBefore(s.hasBeenDownedBefore);
        if (s.collapsePath) setCollapsePathState(s.collapsePath);
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
    const engramHandler = (e: StorageEvent) => {
      if (e.key !== DECK_BUILDER_KEY) return;
      setEngramState(readEngramState(DECK_BUILDER_KEY));
    };
    window.addEventListener("storage", engramHandler);
    return () => window.removeEventListener("storage", engramHandler);
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
        if (n.effect.desync) setChipDesynced(true);
        if (n.effect.restoreOverload) resetApproachOverload(STORAGE_KEY);
        if (n.effect.fullEngramRestore) fullRestEngrams(DECK_BUILDER_KEY);
        if (n.effect.engramRestoreBudget) grantEngramRestoreBudget(DECK_BUILDER_KEY, n.effect.engramRestoreBudget);
        if (n.kind === "hp-zero") {
          const pathLabel = collapsePath ? `${collapsePath[0].toUpperCase()}${collapsePath.slice(1)}` : null;
          pushNotification(
            "collapse-table",
            "Roll on Collapse Table",
            pathLabel
              ? `Roll on the "${pathLabel}" Collapse Table in the handbook.`
              : "Roll on the Collapse Table in the handbook.",
            {}
          );
        }
      }
      removeNotification(id);
      setNotifications(listNotifications());
    },
    [notifications, hpCounter, setHpCounter, collapsePath]
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
            engramState={engramState}
            engramStorageKey={DECK_BUILDER_KEY}
            methods={
              <ApproachPanel
                core={core}
                approach={approach}
                damageDieSize={damageDieSize}
                onRollApproachDie={rollApproachDie}
                approachOverloadSpent={approachOverloadSpent}
                approachWardrobeOverloadSpent={approachWardrobeOverloadSpent}
                onOverloadApproachDie={overloadApproachDie}
                onReceiveGanbare={receiveGanbare}
                approachWardrobeBonus={approachWardrobeBonus}
                approachWardrobeItems={approachWardrobeItems}
              />
            }
          />
        </section>
      </div>
    </div>
  );
}