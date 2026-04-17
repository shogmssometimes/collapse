import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./chud.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CoreStats {
  vigor: number;
  inference: number;
  personality: number;
}

interface ApproachStats {
  force: number;
  finesse: number;
  guts: number;
  logic: number;
  show: number;
  tell: number;
}

interface SecondaryStats {
  vigor: number;
  inference: number;
  personality: number;
}

interface StatReps {
  ap: number;
  draw: number;
  invSlots: number;
}

interface SaveState {
  core: CoreStats;
  hpCounter: number;
  viv: number;
  approach: ApproachStats;
  wt: number;
  ap: number;
  draw: number;
  inventorySlots: number;
  secondary?: SecondaryStats;
  statReps?: StatReps;
  shortRest?: boolean;
  pushIt?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "chud.state.v1";
const UI_KEY = "chud.ui.v1";
const GEAR_SLOTS_KEY = "gear.slots.v1";

const DEFAULT_CORE: CoreStats = { vigor: 3, inference: 2, personality: 2 };
const DEFAULT_DRAW = 5;
const DEFAULT_APPROACH: ApproachStats = {
  force: 0,
  finesse: 0,
  guts: 0,
  logic: 0,
  show: 0,
  tell: 0,
};

const DEFAULT_SECONDARY: SecondaryStats = {
  vigor: 0,
  inference: 0,
  personality: 0,
};

const DEFAULT_STAT_REPS: StatReps = { ap: 0, draw: 0, invSlots: 0 };

const VIV_TIERS = [
  {
    title: "Dormant",
    subtitle: "Viv 0",
    min: 0,
    max: 0,
    accent: "#6b7280",
    fill: "rgba(107,114,128,0.18)",
    glow: "rgba(107,114,128,0.35)",
  },
  {
    title: "Kindled",
    subtitle: "Viv 1-2",
    min: 1,
    max: 2,
    accent: "#3b82f6",
    fill: "rgba(59,130,246,0.16)",
    glow: "rgba(59,130,246,0.4)",
  },
  {
    title: "Surging",
    subtitle: "Viv 3-5",
    min: 3,
    max: 5,
    accent: "#14b8a6",
    fill: "rgba(20,184,166,0.18)",
    glow: "rgba(20,184,166,0.4)",
  },
  {
    title: "Radiant",
    subtitle: "Viv 6-10",
    min: 6,
    max: 10,
    accent: "#f97316",
    fill: "rgba(249,115,22,0.16)",
    glow: "rgba(249,115,22,0.35)",
  },
  {
    title: "Flare",
    subtitle: "Viv 11+",
    min: 11,
    max: Number.POSITIVE_INFINITY,
    accent: "#e11d48",
    fill: "rgba(225,29,72,0.16)",
    glow: "rgba(225,29,72,0.45)",
  },
] as const;

const VIV_CYCLE = 12;

// ── Storage ───────────────────────────────────────────────────────────────────

function loadState(): Partial<SaveState> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    // Normalize secondary: if any expected key is missing/NaN, reset to defaults
    if (parsed.secondary) {
      const s = parsed.secondary as Record<string, unknown>;
      const keys: Array<keyof SecondaryStats> = ["vigor", "inference", "personality"];
      const isValid = keys.every((k) => typeof s[k] === "number" && !Number.isNaN(s[k]));
      if (!isValid) parsed.secondary = { ...DEFAULT_SECONDARY };
    }
    return parsed;
  } catch {
    return null;
  }
}

function readSavedUI(): { hpVivOpen?: boolean; statsOpen?: boolean; secondaryOpen?: boolean; gearOpen?: boolean } {
  try {
    const raw = window.localStorage.getItem(UI_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// ── Derived stats ─────────────────────────────────────────────────────────────

function computeDerived(core: CoreStats) {
  return {
    hp: 8 + core.vigor * 2,
    capacity: core.inference + 10,
    readyness: core.personality + 5,
  };
}

// ── Stable gesture hook ───────────────────────────────────────────────────────
// Returns stable event handler objects whose callbacks always reflect the
// latest onIncr/onDecr without recreating the handlers on each render.

function useGesture(onIncr: () => void, onDecr: () => void) {
  const incrRef = useRef(onIncr);
  const decrRef = useRef(onDecr);
  incrRef.current = onIncr;
  decrRef.current = onDecr;

  const box = useRef({ timer: null as ReturnType<typeof setTimeout> | null, didLong: false });

  return useMemo(() => {
    const b = box.current;
    const clear = () => {
      if (b.timer) {
        clearTimeout(b.timer);
        b.timer = null;
      }
    };
    return {
      onPointerDown(e: React.PointerEvent) {
        if (e.button === 2) return;
        b.didLong = false;
        clear();
        b.timer = setTimeout(() => {
          b.didLong = true;
          decrRef.current();
        }, 500);
      },
      onPointerUp(e: React.PointerEvent) {
        if (e.button === 2) return;
        clear();
      },
      onPointerLeave() {
        clear();
        b.didLong = false;
      },
      onPointerCancel() {
        clear();
        b.didLong = false;
      },
      onClick(e: React.MouseEvent) {
        e.preventDefault();
        if (b.didLong) {
          b.didLong = false;
          return;
        }
        incrRef.current();
      },
      onContextMenu(e: React.MouseEvent) {
        e.preventDefault();
        clear();
        b.didLong = false;
        decrRef.current();
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable by design — callbacks routed through mutable refs
}

// ── VivCard ───────────────────────────────────────────────────────────────────

function VivCard({
  viv,
  onIncr,
  onDecr,
}: {
  viv: number;
  onIncr: () => void;
  onDecr: () => void;
}) {
  const handlers = useGesture(onIncr, onDecr);
  const tier =
    VIV_TIERS.find((t) => viv >= t.min && viv <= t.max) ??
    VIV_TIERS[VIV_TIERS.length - 1];
  const tierDots = VIV_TIERS.map((t) => ({ ...t, active: viv >= t.min }));

  const overflowCount = Math.max(0, Math.floor(viv / VIV_CYCLE));
  const fillFraction = (viv % VIV_CYCLE) / VIV_CYCLE;
  const fillPct = (fillFraction * 100).toFixed(2) + "%";
  const fillOpacity = Math.min(
    0.65,
    0.35 + fillFraction * 0.35 + Math.min(overflowCount * 0.05, 0.3)
  );
  const pillCount = Math.min(overflowCount, 6);
  const pills = Array.from({ length: pillCount }, (_, i) => i + 1);
  const extraOverflow = Math.max(0, overflowCount - pillCount);
  const chargeLabel =
    overflowCount > 0
      ? `${Math.round(fillFraction * 100)}% +${overflowCount}`
      : `${Math.round(fillFraction * 100)}%`;

  return (
    <div
      className="stat-card viv-card interactive"
      role="button"
      tabIndex={0}
      aria-label={`${tier.title} Viv ${viv}`}
      style={{
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${tier.accent}`,
        boxShadow: `0 8px 24px ${tier.glow}`,
        background: "rgba(8,13,23,0.92)",
        isolation: "isolate",
        transition: "border 200ms ease, box-shadow 220ms ease",
        cursor: "pointer",
      }}
      {...handlers}
    >
      {/* Background gradient */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          background: `linear-gradient(140deg, ${tier.fill}, rgba(2,6,23,0.9))`,
          opacity: 0.9,
          pointerEvents: "none",
          transition: "background 240ms ease",
        }}
      />
      {/* Animated fill strip */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          left: 4,
          borderRadius: 12,
          background: `linear-gradient(120deg, ${tier.accent}, rgba(2,6,23,0))`,
          width: fillPct,
          maxWidth: "calc(100% - 8px)",
          opacity: fillOpacity,
          filter: `drop-shadow(0 0 10px ${tier.glow})`,
          pointerEvents: "none",
          transition: "width 220ms ease, opacity 220ms ease",
        }}
      />
      {/* Overflow border glow */}
      {overflowCount > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 2,
            borderRadius: "inherit",
            border: `1px dashed rgba(248,250,252,${0.2 + Math.min(overflowCount * 0.05, 0.5)})`,
            opacity: 0.2 + Math.min(overflowCount * 0.08, 0.4),
            mixBlendMode: "screen" as const,
            pointerEvents: "none",
          }}
        />
      )}
      {/* Content */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 1,
        }}
      >
        {/* Label + value */}
        <div
          className="stat-label"
          style={{ justifyContent: "space-between" }}
        >
          <strong>Viv</strong>
          <span>{viv}</span>
        </div>
        {/* Progress bar */}
        <div
          style={{
            position: "relative",
            height: 5,
            borderRadius: 999,
            background: "rgba(15,23,42,0.6)",
            overflow: "hidden",
            boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.4)",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: fillPct,
              background: `linear-gradient(90deg, ${tier.accent}, ${tier.glow})`,
              transition: "width 220ms ease",
              boxShadow: `0 0 10px ${tier.glow}`,
            }}
          />
        </div>
        {/* Tier dots */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {tierDots.map((d) => (
            <span
              key={d.title}
              aria-hidden="true"
              style={{
                flex: "1 1 16%",
                height: 3,
                borderRadius: 999,
                background: d.active ? d.accent : "rgba(148,163,184,0.25)",
                opacity: d.active ? 1 : 0.35,
                transition: "all 160ms ease",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── RepCard ───────────────────────────────────────────────────────────────────

function RepCard({
  label,
  reps,
  threshold,
  ready,
  onTap,
  onReset,
  onLevelUp,
}: {
  label: string;
  reps: number;
  threshold: number;
  ready: boolean;
  onTap: () => void;
  onReset: () => void;
  onLevelUp: () => void;
}) {
  const handlers = useGesture(ready ? () => {} : onTap, onReset);
  return (
    <div
      className={`core-card interactive rep-card${ready ? " rep-ready" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`${label} reps ${reps} of ${threshold}${ready ? " — level up ready" : ""}`}
      {...handlers}
    >
      <span className="core-label">{label}</span>
      <div className="rep-progress">
        <span className="rep-count-num">{reps}</span>
        <span className="rep-sep">/</span>
        <span className="rep-threshold-num">{threshold}</span>
      </div>
      <div className="rep-pips">
        {Array.from({ length: threshold }, (_, i) => (
          <span key={i} className={`rep-pip${i < reps ? " filled" : ""}${ready ? " ready" : ""}`} />
        ))}
      </div>
      {ready && (
        <button
          type="button"
          className="rep-levelup-badge"
          onClick={(e) => { e.stopPropagation(); onLevelUp(); }}
        >
          LEVEL UP
        </button>
      )}
    </div>
  );
}

// ── GearBrief — swipeable inventory summary ───────────────────────────────────

type GearSlotEntry = { name: string; units: string; qty: string }
type GearData = { entries: GearSlotEntry[]; slotsUsed: number }

function readGearData(): GearData | null {
  try {
    const raw = window.localStorage.getItem(GEAR_SLOTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // new format: { entries, slotsUsed }
    if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.entries)) {
      return { entries: parsed.entries as GearSlotEntry[], slotsUsed: typeof parsed.slotsUsed === 'number' ? parsed.slotsUsed : 0 };
    }
    // legacy array format
    if (Array.isArray(parsed)) {
      return { entries: parsed as GearSlotEntry[], slotsUsed: 0 };
    }
    return null;
  } catch { return null; }
}

function GearBriefWidget({
  entries,
  count,
  isOverEncumbered,
}: {
  entries: GearSlotEntry[];
  count: number;
  isOverEncumbered: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0); // 0–100
  const [flashOut, setFlashOut] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHolding = useRef(false);
  const holdFired = useRef(false);
  const HOLD_MS = 2000;

  // only show entries with QTY > 0
  const activeEntries = entries.slice(0, count).filter(e => {
    const q = parseFloat(e.qty);
    return !isNaN(q) && q > 0;
  });
  const activeCount = activeEntries.length;

  const safeIdx = activeCount > 0 ? idx % activeCount : 0;

  const prev = () => setIdx(i => (activeCount > 0 ? (i - 1 + activeCount) % activeCount : 0));
  const next = () => setIdx(i => (activeCount > 0 ? (i + 1) % activeCount : 0));

  const entry = activeCount > 0 ? (activeEntries[safeIdx] ?? null) : null;
  const nameText = entry?.name.trim() || '—';
  const qtyText = entry?.qty.trim() || '0';
  const hasContent = entry?.name.trim() || entry?.qty.trim();

  // we need the original index in `entries` to write back on use
  const entryOriginalIdx = entry ? entries.findIndex(e => e === entry) : -1;

  const canUse = entry !== null && (() => { const q = parseFloat(entry.qty); return !isNaN(q) && q > 0; })();

  const cancelHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (holdInterval.current) { clearInterval(holdInterval.current); holdInterval.current = null; }
    isHolding.current = false;
    setHoldProgress(0);
  };

  const startHold = () => {
    if (!canUse) return;
    isHolding.current = true;
    const start = Date.now();
    holdInterval.current = setInterval(() => {
      setHoldProgress(Math.min(((Date.now() - start) / HOLD_MS) * 100, 100));
    }, 30);
    holdTimer.current = setTimeout(() => {
      holdFired.current = true;
      cancelHold();
      // decrement qty in localStorage
      try {
        const raw = window.localStorage.getItem(GEAR_SLOTS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const arr: GearSlotEntry[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.entries) ? parsed.entries : []);
          const slotsUsed: number = typeof parsed?.slotsUsed === 'number' ? parsed.slotsUsed : 0;
          const updated = arr.map((e, i) => {
            if (i !== entryOriginalIdx) return e;
            const q = parseFloat(e.qty);
            return { ...e, qty: String(isNaN(q) || q <= 0 ? 0 : q - 1) };
          });
          window.localStorage.setItem(GEAR_SLOTS_KEY, JSON.stringify({ entries: updated, slotsUsed }));
          // trigger storage event for Gear page
          window.dispatchEvent(new StorageEvent('storage', { key: GEAR_SLOTS_KEY, newValue: JSON.stringify({ entries: updated, slotsUsed }), storageArea: window.localStorage }));
        }
      } catch {}
      setFlashOut(true);
      setTimeout(() => setFlashOut(false), 600);
    }, HOLD_MS);
  };

  // border/shadow driven by hold progress
  const holdGlow = holdProgress / 100;
  const accentR = 15; const accentG = 246; const accentB = 255;
  const borderColor = holdProgress > 0
    ? `rgba(${accentR},${accentG},${accentB},${0.15 + 0.85 * holdGlow})`
    : isOverEncumbered ? 'rgba(212,43,43,0.55)' : 'rgba(255,255,255,0.1)';
  const boxShadow = holdProgress > 0
    ? `0 0 ${8 + 24 * holdGlow}px rgba(${accentR},${accentG},${accentB},${0.15 + 0.55 * holdGlow})`
    : flashOut
    ? `0 0 28px rgba(${accentR},${accentG},${accentB},0.6)`
    : isOverEncumbered ? '0 0 12px rgba(212,43,43,0.2)' : 'none';

  if (count === 0 || activeCount === 0) return null;

  return (
    <div
      style={{
        flex: '7 1 0',
        background: isOverEncumbered
          ? 'linear-gradient(135deg, rgba(212,43,43,0.18), rgba(180,20,20,0.10))'
          : 'rgba(8,13,23,0.92)',
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        cursor: canUse ? 'pointer' : 'default',
        boxShadow,
        transition: holdProgress > 0 ? 'none' : 'background 0.3s, border-color 0.4s, box-shadow 0.4s',
      }}
      onPointerDown={e => {
        touchStartX.current = e.clientX;
        e.currentTarget.setPointerCapture(e.pointerId);
        startHold();
      }}
      onPointerUp={e => {
        const dx = touchStartX.current !== null ? e.clientX - touchStartX.current : 0;
        const fired = holdFired.current;
        cancelHold();
        holdFired.current = false;
        if (!fired && Math.abs(dx) <= 30) {
          next();
        }
        touchStartX.current = null;
      }}
      onPointerLeave={() => { cancelHold(); touchStartX.current = null; }}
      onPointerCancel={() => { cancelHold(); touchStartX.current = null; }}
      onContextMenu={e => e.preventDefault()}
    >
      <span
        style={{
          fontSize: '0.58rem',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: isOverEncumbered ? 'rgba(255,100,100,0.9)' : 'var(--muted, #9aa0a6)',
          textAlign: 'center',
        }}
      >
        {isOverEncumbered ? '⚠ Over-Encumbered' : 'In Brief'}
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'center',
          gap: 6,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '0.88rem',
            fontWeight: 600,
            textAlign: 'center',
            color: hasContent ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)',
          }}
        >
          {nameText}
        </span>
        {hasContent && (
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--accent, #0ff6ff)',
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}
          >
            ×{qtyText}
          </span>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 2,
        }}
      >
        <span
          style={{
            fontSize: '0.6rem',
            color: 'rgba(255,255,255,0.35)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {safeIdx + 1} / {activeCount}
        </span>
      </div>
    </div>
  );
}

// ── StatCard — shared by core stats, approach, WT, AP ─────────────────────────

function StatCard({
  label,
  value,
  onIncr,
  onDecr,
}: {
  label: string;
  value: number;
  onIncr: () => void;
  onDecr: () => void;
}) {
  const handlers = useGesture(onIncr, onDecr);
  return (
    <div
      className="core-card interactive"
      role="button"
      tabIndex={0}
      aria-label={`${label} ${value}`}
      {...handlers}
    >
      <span className="core-label">{label}</span>
      <div className="core-controls">
        <span className="core-value">{value}</span>
      </div>
    </div>
  );
}

// ── Chud root ─────────────────────────────────────────────────────────────────

export default function Chud() {
  const saved = loadState();

  const [core, setCore] = useState<CoreStats>(saved?.core ?? DEFAULT_CORE);
  const [hpCounter, setHpCounterRaw] = useState<number>(
    saved?.hpCounter ?? 8 + DEFAULT_CORE.vigor * 2
  );
  const [viv, setVivRaw] = useState<number>(saved?.viv ?? 1);
  const [approach, setApproach] = useState<ApproachStats>(
    saved?.approach ?? DEFAULT_APPROACH
  );
  const [wt, setWtRaw] = useState<number>(saved?.wt ?? 4);
  const [ap, setApRaw] = useState<number>(saved?.ap ?? 4);
  const [draw, setDrawRaw] = useState<number>(saved?.draw ?? DEFAULT_DRAW);
  const [inventorySlots, setInventorySlotsRaw] = useState<number>(saved?.inventorySlots ?? 6);
  const [gearEntries, setGearEntries] = useState<GearSlotEntry[] | null>(() =>
    typeof window !== "undefined" ? (readGearData()?.entries ?? null) : null
  );
  const [gearSlotsUsed, setGearSlotsUsed] = useState<number>(() =>
    typeof window !== "undefined" ? (readGearData()?.slotsUsed ?? 0) : 0
  );
  const [secondary, setSecondary] = useState<SecondaryStats>(
    saved?.secondary ?? DEFAULT_SECONDARY
  );
  const [secondaryOpen, setSecondaryOpen] = useState(() => readSavedUI().secondaryOpen ?? true);
  const [gearOpen, setGearOpen] = useState(() => readSavedUI().gearOpen ?? true);
  const [statsOpen, setStatsOpen] = useState(() => readSavedUI().statsOpen ?? true);
  const [hpVivOpen, setHpVivOpen] = useState(() => readSavedUI().hpVivOpen ?? true);
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
      const prev = readSavedUI();
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
      const data = readGearData();
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

  const hpFillPct = Math.max(0, Math.min(100, (hpCounter / hpMax) * 100));
  const hpHandlers = useGesture(
    () => setHpCounter(hpCounter + 1),
    () => setHpCounter(hpCounter - 1)
  );

  const coreStats = useMemo<Array<[keyof CoreStats, string]>>(
    () => [
      ["vigor", "VIG"],
      ["inference", "INFER"],
      ["personality", "PERSO"],
    ],
    []
  );

  const approachStats = useMemo<Array<[keyof ApproachStats, string]>>(
    () => [
      ["force", "Force"],
      ["guts", "Guts"],
      ["show", "Show"],
      ["finesse", "Finesse"],
      ["logic", "Logic"],
      ["tell", "Tell"],
    ],
    []
  );

  return (
    <div className="app">
      <div className="layout">
        <section
          className={`panel derived-panel-wrapper${collapseLocked ? " collapse-locked" : ""}`}
        >
          {/* Collapse overlay */}
          {collapseLocked && (
            <div className="collapse-overlay">
              <div className="collapse-panel">
                <span className="collapse-eyebrow">Critical Status</span>
                <h3>You Have Collapsed</h3>
                <p className="collapse-copy">
                  Tap REVIVED once stabilized to resume HP edits.
                </p>
                <button
                  type="button"
                  className="revive-btn"
                  onClick={() => setCollapseUnlocked(true)}
                >
                  REVIVED
                </button>
              </div>
            </div>
          )}

          {/* ── HP / Viv accordion ── */}
          <div className={`mods secondary-accordion${hpVivOpen ? " open" : ""}`}>
            <button
              type="button"
              className="secondary-toggle"
              onClick={() => setHpVivOpen((o) => !o)}
            >
              <span>HP &amp; Viv</span>
              <span className="secondary-toggle-chevron">{hpVivOpen ? "▲" : "▼"}</span>
            </button>
            {hpVivOpen && (
              <>
          {/* ── Row 1: HP (70%) | VIV (30%) ── */}
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <div style={{ flex: 7, minWidth: 0 }}>
              <div
                className="stat-card hp-card interactive"
                role="button"
                aria-disabled={collapseLocked ? "true" : "false"}
                tabIndex={collapseLocked ? -1 : 0}
                data-hp-state={hpFillPct <= 30 ? "critical" : hpFillPct <= 60 ? "warning" : "normal"}
                style={{ height: "100%" }}
                {...(collapseLocked ? {} : hpHandlers)}
              >
                <div className="stat-label">
                  <strong>HP</strong>
                  <span>{hpCounter} / {hpMax}</span>
                </div>
                <div
                  className="stat-bar"
                  role="img"
                  aria-label={`HP ${hpCounter} of ${hpMax}`}
                >
                  <div className="bar-fill" style={{ width: `${hpFillPct}%` }} />
                </div>
              </div>
            </div>
            <div style={{ flex: 3, minWidth: 0 }}>
              <VivCard
                viv={viv}
                onIncr={() => setViv(viv + 1)}
                onDecr={() => setViv(viv - 1)}
              />
            </div>
          </div>

          {/* ── Row 2: WT | AP | Draw ── */}
          <div className="viv-row">
            <StatCard
              label="WT"
              value={wt}
              onIncr={() => setWt(wt + 1)}
              onDecr={() => setWt(wt - 1)}
            />
            <StatCard
              label="AP"
              value={ap}
              onIncr={() => setAp(ap + 1)}
              onDecr={() => setAp(ap - 1)}
            />
            <StatCard
              label="Draw"
              value={draw}
              onIncr={() => setDraw(draw + 1)}
              onDecr={() => setDraw(draw - 1)}
            />
          </div>

          {/* ── Row 3: Capacity | Readyness ── */}
          <div className="stat-row trio">
            <div className="chip">
              <span>Capacity</span>
              <strong>{derived.capacity}</strong>
            </div>
            <div className="chip">
              <span>Readyness</span>
              <strong style={gearSlotsUsed > inventorySlots ? { color: 'rgba(255,100,100,0.95)', fontStyle: 'italic' } : undefined}>
                {gearSlotsUsed > inventorySlots ? 'Last' : derived.readyness}
              </strong>
            </div>
          </div>
              </>
            )}
          </div>

          {/* ── Stats accordion: Core Stats + Approach ── */}
          <div className={`mods secondary-accordion${statsOpen ? " open" : ""}`}>
            <button
              type="button"
              className="secondary-toggle"
              onClick={() => setStatsOpen((o) => !o)}
            >
              <span>Stats</span>
              <span className="secondary-toggle-chevron">{statsOpen ? "▲" : "▼"}</span>
            </button>
            {statsOpen && (
              <>
          {/* ── Core Stats ── */}
          <div className="mods">
            <h3>Core Stats</h3>
            <div className="core-grid">
              {coreStats.map(([field, label]) => (
                <StatCard
                  key={field}
                  label={label}
                  value={core[field]}
                  onIncr={() => setCoreField(field, (v) => v + 1)}
                  onDecr={() =>
                    setCoreField(field, (v) => Math.max(0, v - 1))
                  }
                />
              ))}
            </div>
          </div>

          {/* ── Approach ── */}
          <div className="mods">
            <h3>Approach</h3>
            <div className="core-grid approach-grid">
              {approachStats.map(([field, label]) => (
                <StatCard
                  key={field}
                  label={label}
                  value={approach[field]}
                  onIncr={() => setApproachField(field, (v) => v + 1)}
                  onDecr={() =>
                    setApproachField(field, (v) => Math.max(0, v - 1))
                  }
                />
              ))}
            </div>
          </div>
              </>
            )}
          </div>

          {/* ── Secondary Stats accordion ── */}
          <div className={`mods secondary-accordion${secondaryOpen ? " open" : ""}`}>
            <button
              type="button"
              className="secondary-toggle"
              onClick={() => setSecondaryOpen((o) => !o)}
            >
              <span>Reps</span>
              <span className="secondary-toggle-chevron">{secondaryOpen ? "▲" : "▼"}</span>
            </button>
            {secondaryOpen && (
              <>
                <div style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(248,250,252,0.35)', paddingBottom: 4, paddingTop: 6, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Major</div>
                <div className="core-grid secondary-grid">
                  {([
                    ["vigor", "VIG"],
                    ["inference", "INFER"],
                    ["personality", "PERSO"],
                  ] as Array<[keyof SecondaryStats, string]>).map(([field, label]) => (
                    <RepCard
                      key={field}
                      label={label}
                      reps={Number.isFinite(secondary[field]) ? secondary[field] : 0}
                      threshold={(core as unknown as Record<string, number>)[field] + 1}
                      ready={levelUpReady[field]}
                      onTap={() => incrementRep(field)}
                      onReset={() => resetRep(field)}
                      onLevelUp={() => confirmLevelUp(field)}
                    />
                  ))}
                </div>
                <div style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(248,250,252,0.35)', paddingBottom: 4, paddingTop: 10, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>Minor</div>
                <div className="core-grid secondary-grid" style={{ marginTop: 8 }}>
                  {([
                    ['invSlots', 'INV'],
                    ['ap', 'AP'],
                    ['draw', 'DRAW'],
                  ] as Array<[keyof StatReps, string]>).map(([field, label]) => (
                    <RepCard
                      key={field}
                      label={label}
                      reps={statReps[field]}
                      threshold={statRepThreshold(field)}
                      ready={statLevelUpReady[field]}
                      onTap={() => incrementStatRep(field)}
                      onReset={() => resetStatRep(field)}
                      onLevelUp={() => confirmStatLevelUp(field)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Gear Mgmt accordion ── */}
          <div className={`mods secondary-accordion${gearOpen ? " open" : ""}`}>
            <button
              type="button"
              className="secondary-toggle"
              onClick={() => setGearOpen((o) => !o)}
            >
              <span>Gear Mgmt</span>
              <span className="secondary-toggle-chevron">{gearOpen ? "▲" : "▼"}</span>
            </button>
            {gearOpen && (
              <div className="viv-row">
                <div style={{ flex: '3 1 0', minWidth: 0 }}>
                  <StatCard
                    label="Inventory Slots"
                    value={inventorySlots}
                    onIncr={() => setInventorySlots(inventorySlots + 1)}
                    onDecr={() => setInventorySlots(inventorySlots - 1)}
                  />
                </div>
                <GearBriefWidget
                  entries={gearEntries ?? []}
                  count={inventorySlots}
                  isOverEncumbered={gearSlotsUsed > inventorySlots}
                />
              </div>
            )}
          </div>

        </section>
      </div>
    </div>
  );
}
