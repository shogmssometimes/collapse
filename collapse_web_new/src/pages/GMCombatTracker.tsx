import React, { useState, useCallback, useRef, useEffect } from "react";

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "collapse.gm.tracker.v2";
const MAX_SCENARIOS = 8;

const INPUT: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 4,
  color: "var(--text)",
  padding: "0.35rem 0.5rem",
  fontSize: "0.9rem",
  width: "100%",
};

// ── Types ────────────────────────────────────────────────────────────────────

type CombatantType = "enemy" | "player";

type NoteEntry = { id: string; category: string; text: string };

// Set Roll: a direct, per-combatant copy of the CHUD's "Set Rolls (Status
// Effects)" panel — each combatant owns its own independent rows, not synced
// to the shared CHUD localStorage state.
type SetRollRow = { id: string; name: string; effect: string; roll: number };

type SetRollState = {
  open: boolean;
  rows: SetRollRow[];
};

function newSetRollRow(): SetRollRow {
  return { id: `sr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: "", effect: "", roll: 0 };
}

function defaultSetRoll(): SetRollState {
  return { open: false, rows: [newSetRollRow(), newSetRollRow()] };
}

type Combatant = {
  id: string;
  name: string;
  type: CombatantType;
  icon?: string;
  avatarUrl?: string; // optional hosted image URL (e.g. Imgur) shown as circle
  hp: number;
  maxHp: number;
  rdy: number;
  notes: NoteEntry[];
  partyId?: string; // set when imported from a Party slot
  setRoll: SetRollState;
};

type Scenario = {
  id: string;
  name: string;
  combatants: Combatant[];
  savedAt: number;
};

type Party = {
  id: string;
  name: string;
  players: Combatant[]; // only player-type combatants
  savedAt: number;
};

const MAX_PARTIES = 8;

type AppState = {
  combatants: Combatant[];
  scenarios: Scenario[];
  parties: Party[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

const ICONS = [
  "🟢","🔴","🔵","🟡","🟣","🟠","⚔️","🛡️","🔥","💀","👁️","👽","🧠","🌀","🌪️","⚡","🌙","⭐","🌊","🍂","🦾","🦴","🧊","🪓","🏹","🪄","🦅","🐉","🐺","🦂","🕷️","🐙","🐍","🦇","🦉","🧿","🎯","🧨","🛠️","🪨"
];

function autoName(existing: Combatant[]): string {
  let n = existing.length + 1;
  while (existing.some((c) => c.name === `Combatant ${n}`)) n++;
  return `Combatant ${n}`;
}

const ICON_MIGRATION: Record<string, string> = {
  "🟩": "🟢",
  "🟥": "🔴",
  "🟦": "🔵",
  "🟨": "🟡",
  "🟪": "🟣",
  "🟧": "🟠",
};

function pickIcon(existing: Combatant[], icon?: string): string {
  if (icon) return icon;
  return ICONS[existing.length % ICONS.length];
}

function migrateIcon(icon: any): string | undefined {
  if (typeof icon !== "string") return undefined;
  return ICON_MIGRATION[icon] ?? icon;
}

function normalizeAvatarUrl(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const withScheme = /^[a-z][a-z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    if (["imgur.com", "www.imgur.com", "m.imgur.com"].includes(host)) {
      const segments = path.split("/");
      if (segments[0] === "a" || segments[0] === "gallery") {
        const id = segments[1];
        if (id) return `https://i.imgur.com/${id}.jpg`;
      }
      const lastSegment = segments[segments.length - 1];
      if (lastSegment && !lastSegment.includes(".")) {
        return `https://i.imgur.com/${lastSegment}.jpg`;
      }
      return `https://i.imgur.com/${lastSegment}`;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function makeCombatant(existing: Combatant[], type: CombatantType = "enemy"): Combatant {
  return {
    id: uid(),
    name: autoName(existing),
    type,
    icon: pickIcon(existing),
    hp: type === "enemy" ? 10 : 0,
    maxHp: type === "enemy" ? 10 : 0,
    rdy: 0,
    notes: [],
    setRoll: defaultSetRoll(),
  };
}

// ── Persistence ──────────────────────────────────────────────────────────────

function loadApp(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { combatants: [], scenarios: [], parties: [] };
    const p = JSON.parse(raw);
    const migrateNotes = (n: any): NoteEntry[] => {
      if (Array.isArray(n)) return n;
      if (typeof n === "string" && n.trim()) return [{ id: uid(), category: "", text: n }];
      return [];
    };
    const migrateSetRoll = (sr: any): SetRollState => {
      if (sr && typeof sr === "object" && Array.isArray(sr.rows)) {
        return { open: !!sr.open, rows: sr.rows.map((r: any) => ({ id: String(r?.id || newSetRollRow().id), name: String(r?.name || ""), effect: String(r?.effect || ""), roll: clampStatusRoll(Number(r?.roll ?? 0)) })) };
      }
      return defaultSetRoll();
    };
    const migrateCombatant = (c: any, index: number) => ({
      ...c,
      icon: migrateIcon(c.icon) ?? ICONS[index % ICONS.length],
      rdy: typeof c.rdy === "number" ? c.rdy : 0,
      notes: migrateNotes(c.notes),
      setRoll: migrateSetRoll(c.setRoll),
    });
    return {
      combatants: Array.isArray(p.combatants)
        ? p.combatants.map(migrateCombatant)
        : [],
      scenarios: Array.isArray(p.scenarios)
        ? p.scenarios.map((s: any) => ({
            ...s,
            combatants: Array.isArray(s.combatants)
              ? s.combatants.map(migrateCombatant)
              : [],
          }))
        : [],
      parties: Array.isArray(p.parties)
        ? p.parties.map((pt: any) => ({
            ...pt,
            players: Array.isArray(pt.players) ? pt.players.map(migrateCombatant) : [],
          }))
        : [],
    };
  } catch {
    return { combatants: [], scenarios: [], parties: [] };
  }
}

function saveApp(s: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

// ── Run state persistence ─────────────────────────────────────────────────────
// Keeps Run mode (and which combatant is active) alive across navigation until
// the GM explicitly ends combat (Edit / Clear).

const RUN_STATE_KEY = "collapse.gm.tracker.runstate.v1";

function loadRunState(): { mode: "edit" | "run"; runIndex: number } {
  try {
    const raw = localStorage.getItem(RUN_STATE_KEY);
    if (!raw) return { mode: "edit", runIndex: 0 };
    const p = JSON.parse(raw);
    return {
      mode: p.mode === "run" ? "run" : "edit",
      runIndex: typeof p.runIndex === "number" && p.runIndex >= 0 ? p.runIndex : 0,
    };
  } catch {
    return { mode: "edit", runIndex: 0 };
  }
}

function saveRunState(mode: "edit" | "run", runIndex: number) {
  try {
    localStorage.setItem(RUN_STATE_KEY, JSON.stringify({ mode, runIndex }));
  } catch {}
}

// ── Counter ───────────────────────────────────────────────────────────────────
// Supports: scroll wheel (↑ +1  ↓ −1), vertical touch swipe, tap value to type,
// tap max to edit max, ± buttons.

type CounterProps = {
  label: string;
  value: number;
  max: number;
  accent: string;
  onChange: (v: number) => void;
  onMaxChange?: (v: number) => void;
  large?: boolean;
  noMax?: boolean;
};

const Counter: React.FC<CounterProps> = ({
  label, value, max, accent, onChange, onMaxChange, large, noMax,
}) => {
  const elRef = useRef<HTMLDivElement>(null);
  const [editingVal, setEditingVal] = useState(false);
  const [editingMax, setEditingMax] = useState(false);

  // Live refs so one-time event handlers never go stale
  const valRef = useRef(value);
  const maxRef = useRef(max);
  const onChangeRef = useRef(onChange);
  valRef.current = value;
  maxRef.current = max;
  onChangeRef.current = onChange;

  // Attach non-passive wheel + touch once
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const clamp = (v: number) => noMax ? Math.max(0, v) : Math.max(0, Math.min(maxRef.current, v));

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      onChangeRef.current(clamp(valRef.current + (e.deltaY < 0 ? 1 : -1)));
    };

    let touchLastY = 0;
    let touchAccum = 0;

    const onTouchStart = (e: TouchEvent) => {
      e.stopPropagation(); // prevent RunCard horizontal-swipe handler from seeing this
      touchLastY = e.touches[0].clientY;
      touchAccum = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const dy = touchLastY - e.touches[0].clientY; // positive = swipe up = increase
      touchAccum += dy;
      touchLastY = e.touches[0].clientY;
      const steps = Math.trunc(touchAccum / 24);
      if (steps !== 0) {
        onChangeRef.current(clamp(valRef.current + steps));
        touchAccum -= steps * 24;
      }
    };

    const onTouchEnd = () => { touchAccum = 0; };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const barColor = pct > 50 ? accent : pct > 25 ? "var(--accent-amber)" : "var(--error)";
  const valFs = large ? "2rem" : "1.25rem";
  const denomFs = large ? "0.9rem" : "0.72rem";
  const btnPad = large ? "0.55rem 0" : "0.22rem 0";
  const btnFs = large ? "1.2rem" : "0.88rem";

  return (
    <div ref={elRef} style={{ userSelect: "none", touchAction: "none", cursor: "ns-resize" }}>
      <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.13em", color: "var(--muted)", marginBottom: 3 }}>
        {label}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginBottom: 5 }}>
        {editingVal ? (
          <input
            autoFocus
            type="number"
            defaultValue={value}
            style={{ width: large ? 62 : 44, fontSize: valFs, fontWeight: 700, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 4, color: "#f8f9fa", padding: "0.05rem 0.25rem" }}
            onBlur={(e) => { onChange(Math.max(0, Math.min(max, Number(e.target.value)))); setEditingVal(false); }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <span
            onClick={(e) => { e.stopPropagation(); setEditingVal(true); }}
            style={{ fontSize: valFs, fontWeight: 700, color: barColor, cursor: "text", lineHeight: 1 }}
          >
            {value}
          </span>
        )}
        {!noMax && (
          <>
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: denomFs }}>/</span>
            {editingMax && onMaxChange ? (
              <input
                autoFocus
                type="number"
                defaultValue={max}
                style={{ width: large ? 46 : 34, fontSize: denomFs, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 4, color: "#f8f9fa", padding: "0.05rem 0.25rem" }}
                onBlur={(e) => { onMaxChange(Math.max(1, Number(e.target.value))); setEditingMax(false); }}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
            ) : (
              <span
                onClick={(e) => { e.stopPropagation(); onMaxChange && setEditingMax(true); }}
                style={{ color: "rgba(255,255,255,0.35)", fontSize: denomFs, cursor: onMaxChange ? "text" : "default" }}
              >
                {max}
              </span>
            )}
          </>
        )}
      </div>

      {!noMax && (
        <div style={{ height: large ? 5 : 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 2, transition: "width 0.12s, background 0.12s" }} />
        </div>
      )}

      <div style={{ display: "flex", gap: 4, marginTop: large ? 12 : 7 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onChange(Math.max(0, value - 1)); }}
          style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "var(--error)", fontSize: btnFs, padding: btnPad, cursor: "pointer" }}
        >−</button>
        <button
          onClick={(e) => { e.stopPropagation(); onChange(noMax ? value + 1 : Math.min(max, value + 1)); }}
          style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: accent, fontSize: btnFs, padding: btnPad, cursor: "pointer" }}
        >+</button>
      </div>
    </div>
  );
};

// ── Notes Table ───────────────────────────────────────────────────────────────

type NotesTableProps = {
  notes: NoteEntry[];
  onChange: (notes: NoteEntry[]) => void;
};

const NotesTable: React.FC<NotesTableProps> = ({ notes, onChange }) => {
  const addRow = () =>
    onChange([...notes, { id: uid(), category: "", text: "" }]);

  const updateRow = (id: string, field: keyof Omit<NoteEntry, "id">, value: string) =>
    onChange(notes.map((n) => (n.id === id ? { ...n, [field]: value } : n)));

  const removeRow = (id: string) =>
    onChange(notes.filter((n) => n.id !== id));

  const cellBase: React.CSSProperties = {
    background: "transparent",
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    color: "#f8f9fa",
    fontSize: "0.83rem",
    padding: "0.3rem 0.4rem",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{ marginTop: "0.7rem" }}>
      {notes.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2rem calc(25% - 1.2rem) 1fr 1.4rem", gap: "0 0.3rem", marginBottom: "0.2rem" }}>
          <span />
          <span style={{ fontSize: "0.67rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", paddingLeft: "0.4rem" }}>Category</span>
          <span style={{ fontSize: "0.67rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", paddingLeft: "0.4rem" }}>Note</span>
          <span />
        </div>
      )}
      {notes.map((n, i) => (
        <div key={n.id} style={{ display: "grid", gridTemplateColumns: "1.2rem calc(25% - 1.2rem) 1fr 1.4rem", gap: "0 0.3rem", alignItems: "center", marginBottom: "0.15rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "right" }}>{i + 1}.</span>
          <input
            value={n.category}
            placeholder="Category"
            onChange={(e) => updateRow(n.id, "category", e.target.value)}
            style={cellBase}
          />
          <input
            value={n.text}
            placeholder="Note…"
            onChange={(e) => updateRow(n.id, "text", e.target.value)}
            style={cellBase}
          />
          <button
            onClick={() => removeRow(n.id)}
            style={{ background: "none", border: "none", color: "rgba(255,107,107,0.5)", cursor: "pointer", fontSize: "0.85rem", padding: 0, lineHeight: 1 }}
          >✕</button>
        </div>
      ))}
      <button
        onClick={addRow}
        style={{ marginTop: notes.length > 0 ? "0.4rem" : 0, background: "none", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 5, color: "var(--muted)", fontSize: "0.78rem", padding: "0.25rem 0.65rem", cursor: "pointer", width: "100%" }}
      >+ Add note</button>
    </div>
  );
};

// ── Set Roll Panel ────────────────────────────────────────────────────────────
// A direct copy of the CHUD's "Set Rolls (Status Effects)" panel — a Name /
// Effect / Set Roll (+/-) / Clear table with catalog autocomplete and
// hold-to-clear rows. Stopgapped here so each Combat Tracker combatant owns
// its own independent set of rows (not synced to any shared CHUD state).

const STATUS_ROLL_MAX = 50;
const STATUS_ROLL_MAX_ROWS = 10;
const STATUS_ROLL_CLEAR_HOLD_MS = 700;

const STATUS_EFFECTS_CATALOG: { name: string; effect: string }[] = [
  { name: "Slowed", effect: "Any movement costs +1 additional AP" },
  { name: "Bound", effect: "Cannot take movement actions" },
  { name: "Stunned", effect: "Reduce AP by 1d4" },
  { name: "Distracted", effect: "Cannot purchase/use Reaction Tokens" },
  { name: "Taunted", effect: "Must target Taunter with Combat Action or lose 2AP" },
  { name: "Marked", effect: "Cannot be Hidden" },
  { name: "Exposed", effect: "WT reduced by 1" },
  { name: "Nullified", effect: "Cannot use Mod Engrams" },
  { name: "Overheated", effect: "Cannot use Grit" },
  { name: "Irradiated", effect: "Lose 1 Grit" },
  { name: "Afflicted (Poison, Burn, Suffocation etc)", effect: "At the bottom of your turn, roll a dice, on evens reduce WT by 1, on odds, nothing happens." },
  { name: "Frightened", effect: "Must remain adjacent to fear source" },
  { name: "Crushed", effect: "Double AP Costs" },
  { name: "Confused", effect: "Roll twice, take lower" },
  { name: "Hacked", effect: "Roll 1d4, control target for that # of Turns" },
  { name: "Discombobulated", effect: "Roll 1d4, on 1, Combat Actions hit a random target" },
  { name: "Focused", effect: "On rolls, roll twice, take higher" },
  { name: "Shielded", effect: "Damage halved" },
  { name: "Fortified", effect: "WT increased by 1" },
  { name: "Hastened", effect: "Any movement costs 1 less AP" },
  { name: "Inspired", effect: "Gain 1 Grit" },
  { name: "Energized", effect: "Gain +1AP" },
  { name: "Overclocked", effect: "Chip damage die steps up one tier" },
  { name: "Bleeding", effect: "On hit, Lose 1HP regardless of WT" },
  { name: "Charmed", effect: "Treat source as friendly" },
  { name: "Demoralized", effect: "Cannot Ganbare or receive Ganbare" },
  { name: "Rattled", effect: "Cannot use Overdrive" },
  { name: "Pressured", effect: "Cannot Flank or gain positional bonuses" },
  { name: "Exhausted", effect: "Reduce all AO/PCDC rolls by 1d4" },
  { name: "Downed", effect: "Out of the fight, must be revived" },
  { name: "Desynced", effect: "Your Chip is Desynced" },
];

function normalizeStatusName(s: string): string {
  return String(s || "").trim().toLowerCase();
}

const STATUS_EFFECTS_BY_NAME = new Map(STATUS_EFFECTS_CATALOG.map((it) => [normalizeStatusName(it.name), it]));

function clampStatusRoll(n: number): number {
  return Math.max(0, Math.min(STATUS_ROLL_MAX, Number.isFinite(n) ? n : 0));
}

function getStatusSuggestions(query: string): { name: string; effect: string }[] {
  const q = normalizeStatusName(query);
  if (!q) return [];
  return STATUS_EFFECTS_CATALOG
    .filter((it) => normalizeStatusName(it.name).includes(q))
    .sort((a, b) => {
      const aStarts = normalizeStatusName(a.name).startsWith(q) ? 0 : 1;
      const bStarts = normalizeStatusName(b.name).startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 6);
}

type SetRollPanelProps = {
  value: SetRollState;
  onChange: (next: SetRollState) => void;
};

const SetRollRowView: React.FC<{
  row: SetRollRow;
  onUpdate: (next: SetRollRow) => void;
  onRemove: () => void;
}> = ({ row, onUpdate, onRemove }) => {
  const [nameFocused, setNameFocused] = useState(false);
  const [holdPct, setHoldPct] = useState(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const exact = STATUS_EFFECTS_BY_NAME.get(normalizeStatusName(row.name));
  const effectReadOnly = !!exact;
  const suggestions = nameFocused ? getStatusSuggestions(row.name) : [];

  const applySuggestion = (item: { name: string; effect: string }) => {
    onUpdate({ ...row, name: item.name, effect: item.effect });
    setNameFocused(false);
  };

  const clearHold = () => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (holdTickRef.current) { clearInterval(holdTickRef.current); holdTickRef.current = null; }
    setHoldPct(0);
  };

  const startHold = () => {
    const started = Date.now();
    holdTickRef.current = setInterval(() => {
      setHoldPct(Math.min(100, ((Date.now() - started) / STATUS_ROLL_CLEAR_HOLD_MS) * 100));
    }, 30);
    holdTimerRef.current = setTimeout(() => {
      clearHold();
      onRemove();
    }, STATUS_ROLL_CLEAR_HOLD_MS);
  };

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "stretch", position: "relative" }}>
      <div style={{ position: "relative", flex: "26 1 0", minWidth: 0 }}>
        <input
          type="text"
          value={row.name}
          placeholder="Type effect name..."
          autoComplete="off"
          onChange={(e) => {
            const name = e.target.value;
            const match = STATUS_EFFECTS_BY_NAME.get(normalizeStatusName(name));
            onUpdate({ ...row, name, effect: match ? match.effect : (effectReadOnly ? "" : row.effect) });
          }}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setTimeout(() => setNameFocused(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const first = getStatusSuggestions(row.name)[0];
              if (first) { e.preventDefault(); applySuggestion(first); }
            }
          }}
          style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, padding: "7px 8px", fontSize: "0.72rem", color: "#e9f0ff", outline: "none" }}
        />
        {suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 3, background: "#0d1117", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 8, maxHeight: 170, overflowY: "auto", zIndex: 30, boxShadow: "0 10px 28px rgba(0,0,0,0.55)" }}>
            {suggestions.map((item) => (
              <div
                key={item.name}
                onPointerDown={(e) => { e.preventDefault(); applySuggestion(item); }}
                style={{ padding: "8px 10px", fontSize: "0.7rem", color: "#e9f0ff", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                {item.name}
              </div>
            ))}
          </div>
        )}
      </div>
      <textarea
        rows={2}
        value={row.effect}
        readOnly={effectReadOnly}
        onChange={(e) => { if (!effectReadOnly) onUpdate({ ...row, effect: e.target.value }); }}
        style={{ flex: "42 1 0", minWidth: 0, boxSizing: "border-box", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "7px 8px", fontSize: "0.68rem", color: effectReadOnly ? "rgba(248,250,252,0.55)" : "rgba(248,250,252,0.8)", fontStyle: effectReadOnly ? "italic" : "normal", outline: "none", lineHeight: 1.25, resize: "none" }}
      />
      <div style={{ flex: "22 1 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <button
          onClick={() => onUpdate({ ...row, roll: clampStatusRoll(row.roll - 1) })}
          style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 6, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.07)", color: "#fff", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >−</button>
        <span style={{ minWidth: 20, textAlign: "center", fontVariantNumeric: "tabular-nums", fontWeight: 800, color: "#6ac7ff", fontSize: "0.72rem" }}>{row.roll}</span>
        <button
          onClick={() => onUpdate({ ...row, roll: clampStatusRoll(row.roll + 1) })}
          style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 6, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.07)", color: "#fff", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >+</button>
      </div>
      <button
        onPointerDown={(e) => { e.preventDefault(); startHold(); }}
        onPointerUp={clearHold}
        onPointerLeave={clearHold}
        onPointerCancel={clearHold}
        style={{ flex: "10 1 0", minWidth: 30, borderRadius: 8, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: "0.78rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}
      >
        <span style={{ position: "absolute", inset: 0, background: "rgba(239,68,68,0.4)", width: `${holdPct}%`, pointerEvents: "none" }} />
        <span style={{ position: "relative", zIndex: 1 }}>X</span>
      </button>
    </div>
  );
};

const SetRollPanel: React.FC<SetRollPanelProps> = ({ value, onChange }) => {
  return (
    <div style={{ marginTop: "0.6rem" }}>
      <button
        onClick={(e) => { e.stopPropagation(); onChange({ ...value, open: !value.open }); }}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.12)", padding: "6px 0 8px", cursor: "pointer", color: "rgba(248,250,252,0.65)", fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase" }}
      >
        <span>Set Rolls (Status Effects)</span>
        <span style={{ fontSize: "0.55rem", opacity: 0.7 }}>{value.open ? "▲" : "▼"}</span>
      </button>
      {value.open && (
        <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", gap: 6, padding: "0 2px" }}>
            <span style={{ flex: "26 1 0", fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(248,250,252,0.4)", fontWeight: 600 }}>Name</span>
            <span style={{ flex: "42 1 0", fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(248,250,252,0.4)", fontWeight: 600 }}>Effect</span>
            <span style={{ flex: "22 1 0", textAlign: "center", fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(248,250,252,0.4)", fontWeight: 600 }}>Set Roll</span>
            <span style={{ flex: "10 1 0", textAlign: "center", fontSize: "0.55rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(248,250,252,0.4)", fontWeight: 600 }}>Clear</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {value.rows.map((row) => (
              <SetRollRowView
                key={row.id}
                row={row}
                onUpdate={(next) => onChange({ ...value, rows: value.rows.map((r) => (r.id === row.id ? next : r)) })}
                onRemove={() => onChange({ ...value, rows: value.rows.filter((r) => r.id !== row.id) })}
              />
            ))}
          </div>
          <button
            disabled={value.rows.length >= STATUS_ROLL_MAX_ROWS}
            onClick={() => onChange({ ...value, rows: [...value.rows, newSetRollRow()] })}
            style={{ alignSelf: "flex-start", marginTop: 2, padding: "7px 14px", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.26)", background: "transparent", color: "rgba(248,250,252,0.65)", fontSize: "0.62rem", cursor: value.rows.length >= STATUS_ROLL_MAX_ROWS ? "not-allowed" : "pointer", letterSpacing: "0.08em", textTransform: "uppercase", opacity: value.rows.length >= STATUS_ROLL_MAX_ROWS ? 0.35 : 1 }}
          >
            Add Row
          </button>
        </div>
      )}
    </div>
  );
};

// ── Edit Row ──────────────────────────────────────────────────────────────────

type EditRowProps = {
  c: Combatant;
  index: number;
  isLast: boolean;
  onChange: (c: Combatant) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  partySelected?: boolean;
  onPartyToggle?: () => void;
};

const EditRow: React.FC<EditRowProps> = ({ c, index, isLast, onChange, onRemove, onMoveUp, onMoveDown, partySelected, onPartyToggle }) => {
  const [editingName, setEditingName] = useState(false);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.9rem 1rem", marginBottom: "0.55rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.8rem" }}>
        <div style={{ minWidth: 24, color: "var(--muted)", fontWeight: 700, fontSize: "0.85rem", textAlign: "center" }}>
          {index + 1}
        </div>
        {editingName ? (
          <input
            autoFocus
            style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 4, color: "#f8f9fa", padding: "0.3rem 0.5rem", fontSize: "0.95rem" }}
            defaultValue={c.name}
            onBlur={(e) => { onChange({ ...c, name: e.target.value.trim() || c.name }); setEditingName(false); }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <span onClick={() => setEditingName(true)} style={{ flex: 1, fontWeight: 600, fontSize: "0.95rem", cursor: "text", display: "flex", alignItems: "center", gap: 8 }}>
            {c.avatarUrl ? (
              <img
                src={c.avatarUrl}
                alt=""
                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,0.15)" }}
              />
            ) : (
              <span style={{ fontSize: "1.4rem" }}>{c.icon || ICONS[index % ICONS.length]}</span>
            )}
            {c.name}
          </span>
        )}
        <button
          onClick={() => {
            const nextType = c.type === "enemy" ? "player" : "enemy" as CombatantType;
            onChange(
              nextType === "player"
                ? { ...c, type: "player", hp: 0, maxHp: 0 }
                : { ...c, type: "enemy", icon: c.icon || ICONS[index % ICONS.length], hp: c.maxHp > 0 ? c.maxHp : 10, maxHp: c.maxHp > 0 ? c.maxHp : 10 }
            );
          }}
          style={{
            background: c.type === "player" ? "rgba(99,255,177,0.12)" : "rgba(99,160,255,0.12)",
            border: `1px solid ${c.type === "player" ? "rgba(99,255,177,0.25)" : "rgba(99,160,255,0.25)"}`,
            borderRadius: 6,
            color: c.type === "player" ? "var(--accent-influence)" : "var(--accent)",
            padding: "0.3rem 0.7rem",
            cursor: "pointer",
            fontSize: "0.82rem",
            whiteSpace: "nowrap",
          }}
        >
          {c.type === "player" ? "Player" : "Enemy"}
        </button>
        {c.type === "player" && (
          <label
            title="Include in Party save"
            style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: "0.78rem", color: partySelected ? "var(--accent-influence)" : "var(--muted)", whiteSpace: "nowrap", userSelect: "none" }}
          >
            <input
              type="checkbox"
              checked={!!partySelected}
              onChange={onPartyToggle}
              style={{ accentColor: "var(--accent-influence)", cursor: "pointer" }}
            />
            Party
          </label>
        )}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              color: index === 0 ? "rgba(255,255,255,0.3)" : "#f8f9fa",
              padding: "0.25rem 0.5rem",
              cursor: index === 0 ? "default" : "pointer",
            }}
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 6,
              color: isLast ? "rgba(255,255,255,0.3)" : "#f8f9fa",
              padding: "0.25rem 0.5rem",
              cursor: isLast ? "default" : "pointer",
            }}
          >
            ↓
          </button>
          <button
            onClick={onRemove}
            aria-label="Remove"
            style={{ background: "none", border: "none", color: "rgba(255,107,107,0.55)", cursor: "pointer", fontSize: "1rem", padding: "0.15rem 0.35rem", lineHeight: 1 }}
          >✕</button>
        </div>
      </div>

      <div>
        <span style={{ display: "block", fontSize: "0.82rem", color: "var(--muted)", marginBottom: 5 }}>Profile Picture URL</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {c.avatarUrl && (
            <img
              src={c.avatarUrl}
              alt=""
              style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255,255,255,0.15)" }}
            />
          )}
          <input
            type="url"
            placeholder="https://i.imgur.com/…"
            value={c.avatarUrl ?? ""}
            onChange={(e) => onChange({ ...c, avatarUrl: e.target.value.trim() || undefined })}
            onBlur={(e) => {
              const normalized = normalizeAvatarUrl(e.target.value.trim());
              if (normalized !== (c.avatarUrl ?? undefined)) {
                onChange({ ...c, avatarUrl: normalized });
              }
            }}
            style={{ ...INPUT, flex: 1 }}
          />
          {c.avatarUrl && (
            <button
              onClick={() => onChange({ ...c, avatarUrl: undefined })}
              style={{ background: "none", border: "none", color: "rgba(255,107,107,0.55)", cursor: "pointer", fontSize: "1rem", padding: "0.15rem 0.35rem", lineHeight: 1 }}
              title="Remove picture"
            >✕</button>
          )}
        </div>
      </div>

      <div>
        <span style={{ display: "block", fontSize: "0.82rem", color: "var(--muted)", marginBottom: 5 }}>RDY</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="-?[0-9]*"
          value={c.rdy}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "" || raw === "-") { onChange({ ...c, rdy: 0 }); return; }
            const n = Number(raw);
            if (!Number.isNaN(n)) onChange({ ...c, rdy: n });
          }}
          style={{ ...INPUT, maxWidth: 120 }}
        />
        <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: 6 }}>
          When Run starts, combatants are ordered highest RDY to lowest.
        </div>
      </div>

      {c.type === "enemy" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <span style={{ display: "block", fontSize: "0.82rem", color: "var(--muted)", marginBottom: 5 }}>HP Max</span>
            <input
              type="number"
              min={1}
              value={c.maxHp}
              onChange={(e) => {
                const nextMax = Math.max(1, Number(e.target.value));
                onChange({ ...c, maxHp: nextMax, hp: nextMax });
              }}
              style={INPUT}
            />
            <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: 6 }}>
              HP starts at max in Run mode.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ color: "var(--muted)", fontSize: "0.88rem", padding: "0.85rem 0.5rem", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, marginBottom: "0.6rem" }}>
          Player placeholders do not track HP.
        </div>
      )}

      <NotesTable notes={c.notes} onChange={(notes) => onChange({ ...c, notes })} />

      <SetRollPanel value={c.setRoll ?? defaultSetRoll()} onChange={(setRoll) => onChange({ ...c, setRoll })} />
    </div>
  );
};

// ── Run Card ──────────────────────────────────────────────────────────────────
// Horizontal swipe on the card background navigates between combatants.
// Vertical swipe / scroll on counters adjusts HP.

type RunCardProps = {
  c: Combatant;
  index: number;
  total: number;
  onChange: (c: Combatant) => void;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (i: number) => void;
};

const RunCard: React.FC<RunCardProps> = ({ c, index, total, onChange, onPrev, onNext, onGoTo }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);
  const indexRef = useRef(index);
  const totalRef = useRef(total);
  onPrevRef.current = onPrev;
  onNextRef.current = onNext;
  indexRef.current = index;
  totalRef.current = total;

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    let startX = 0, startY = 0;

    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (Math.abs(dx) > 55 && dy < Math.abs(dx) * 0.7) {
        if (dx < 0 && totalRef.current > 1) onNextRef.current();
        else if (dx > 0 && indexRef.current > 0) onPrevRef.current();
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={cardRef}
      style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.5rem 1.25rem 1.25rem", minHeight: "58vh", display: "flex", flexDirection: "column", gap: "1.5rem", touchAction: "pan-y" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.13em", color: "var(--muted)" }}>
            {index + 1} / {total}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {c.avatarUrl ? (
              <img
                src={c.avatarUrl}
                alt=""
                style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "2px solid rgba(255,255,255,0.15)" }}
              />
            ) : (
              <span style={{ fontSize: "2rem" }}>{c.icon || ICONS[index % ICONS.length]}</span>
            )}
            <div style={{ fontWeight: 700, fontSize: "1.5rem", marginTop: 3, lineHeight: 1.1 }}>{c.name}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onPrev} disabled={index === 0}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: index === 0 ? "rgba(255,255,255,0.18)" : "#f8f9fa", padding: "0.4rem 0.85rem", fontSize: "1.1rem", cursor: index === 0 ? "default" : "pointer" }}
          >←</button>
          <button
            onClick={onNext} disabled={total <= 1}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: total <= 1 ? "rgba(255,255,255,0.18)" : "#f8f9fa", padding: "0.4rem 0.85rem", fontSize: "1.1rem", cursor: total <= 1 ? "default" : "pointer" }}
          >→</button>
        </div>
      </div>

      {/* Counters */}
      {c.type === "enemy" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.75rem" }}>
          <Counter
            label="HP" value={c.hp} max={c.maxHp} accent="var(--accent-influence)"
            onChange={(v) => onChange({ ...c, hp: v })}
            onMaxChange={(v) => onChange({ ...c, maxHp: v, hp: Math.min(c.hp, v) })}
            large
          />
        </div>
      ) : (
        <div style={{ color: "var(--muted)", fontSize: "0.92rem", padding: "1rem", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}>
          Player placeholder — no HP values are tracked here.
        </div>
      )}

      {/* Notes */}
      <NotesTable notes={c.notes} onChange={(notes) => onChange({ ...c, notes })} />

      {/* Set Roll (Status Effects) */}
      <SetRollPanel value={c.setRoll ?? defaultSetRoll()} onChange={(setRoll) => onChange({ ...c, setRoll })} />

      {/* Dot navigation */}
      {total > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 9, marginTop: "auto", paddingBottom: "0.25rem" }}>
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              onClick={() => onGoTo(i)}
              aria-label={`Combatant ${i + 1}`}
              style={{ width: 9, height: 9, borderRadius: "50%", padding: 0, border: "none", background: i === index ? "#f8f9fa" : "rgba(255,255,255,0.2)", cursor: "pointer", transition: "background 0.15s" }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Party Panel ───────────────────────────────────────────────────────────────

type PartyPanelProps = {
  parties: Party[];
  selectedIds: Set<string>;
  combatants: Combatant[];
  onImport: (p: Party) => void;
  onSaveNew: (name: string) => void;
  onOverwrite: (id: string, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

const PartyPanel: React.FC<PartyPanelProps> = ({
  parties, selectedIds, combatants, onImport, onSaveNew, onOverwrite, onRename, onDelete, onClose,
}) => {
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingVal, setRenamingVal] = useState("");
  const [saveAsId, setSaveAsId] = useState<string | null>(null);
  const [saveAsName, setSaveAsName] = useState("");

  const selectedPlayers = combatants.filter((c) => c.type === "player" && selectedIds.has(c.id));
  const canSaveNew = parties.length < MAX_PARTIES && selectedPlayers.length > 0;

  const commitSaveNew = () => {
    if (!selectedPlayers.length) return;
    const name = newName.trim() || `Party ${parties.length + 1}`;
    onSaveNew(name);
    setNewName("");
  };

  const commitSaveAs = (id: string) => {
    if (!selectedPlayers.length) return;
    const name = saveAsName.trim() || parties.find((p) => p.id === id)?.name || `Party ${parties.length}`;
    onOverwrite(id, name);
    setSaveAsId(null);
    setSaveAsName("");
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "var(--bg-dark)", border: "1px solid var(--border)", borderRadius: "12px 12px 0 0", padding: "1.25rem 1.25rem 2.5rem", width: "100%", maxWidth: 600, maxHeight: "72vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Parties
            <span style={{ marginLeft: 8, color: "var(--muted)", fontSize: "0.8rem", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
              {parties.length} / {MAX_PARTIES}
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.2rem", lineHeight: 1, padding: "0.15rem 0.3rem" }}>✕</button>
        </div>

        <div style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: "1rem", lineHeight: 1.4 }}>
          Check the <strong style={{ color: "var(--text)" }}>Party</strong> checkbox on player combatants in Edit mode, then save them here. Loading a party appends those players to the current pool.
        </div>

        {selectedPlayers.length > 0 ? (
          <div style={{ background: "rgba(99,255,177,0.06)", border: "1px solid rgba(99,255,177,0.18)", borderRadius: 6, padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "var(--accent-influence)", marginBottom: "1rem" }}>
            {selectedPlayers.length} player{selectedPlayers.length !== 1 ? "s" : ""} selected: {selectedPlayers.map((p) => p.name).join(", ")}
          </div>
        ) : (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "var(--muted)", marginBottom: "1rem" }}>
            No players checked — check Party on player rows in Edit mode to enable saving.
          </div>
        )}

        {parties.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: "0.85rem", textAlign: "center", padding: "1.5rem 0" }}>
            No saved parties yet.
          </div>
        )}

        {parties.map((p) => (
          <React.Fragment key={p.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.65rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {renamingId === p.id ? (
                  <input
                    autoFocus
                    style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 4, color: "#f8f9fa", padding: "0.25rem 0.5rem", fontSize: "0.9rem", boxSizing: "border-box" }}
                    value={renamingVal}
                    onChange={(e) => setRenamingVal(e.target.value)}
                    onBlur={() => { onRename(p.id, renamingVal.trim() || p.name); setRenamingId(null); }}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  />
                ) : (
                  <>
                    <div
                      onClick={() => { setRenamingId(p.id); setRenamingVal(p.name); }}
                      style={{ fontWeight: 600, fontSize: "0.9rem", cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {p.name}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>
                      {p.players.length} player{p.players.length !== 1 ? "s" : ""}: {p.players.map((pl) => pl.name).join(", ")} · {new Date(p.savedAt).toLocaleDateString()}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => onImport(p)}
                style={{ background: "rgba(99,255,177,0.08)", border: "1px solid rgba(99,255,177,0.22)", borderRadius: 4, color: "var(--accent-influence)", fontSize: "0.8rem", padding: "0.3rem 0.6rem", cursor: "pointer", whiteSpace: "nowrap" }}
              >Import</button>
              <button
                onClick={() => {
                  if (!selectedPlayers.length) return;
                  setSaveAsId(p.id);
                  setSaveAsName(p.name);
                }}
                disabled={!selectedPlayers.length}
                title={selectedPlayers.length ? "Overwrite with selected players" : "Check Party on players first"}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: selectedPlayers.length ? "var(--muted)" : "rgba(255,255,255,0.2)", fontSize: "0.8rem", padding: "0.3rem 0.55rem", cursor: selectedPlayers.length ? "pointer" : "default" }}
              >Save As</button>
              <button
                onClick={() => onDelete(p.id)}
                aria-label="Delete party"
                style={{ background: "none", border: "none", color: "rgba(255,107,107,0.55)", cursor: "pointer", fontSize: "0.95rem", padding: "0.15rem 0.3rem" }}
              >✕</button>
            </div>
            {saveAsId === p.id && (
              <div style={{ display: "flex", gap: 8, marginBottom: "0.75rem" }}>
                <input
                  autoFocus
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#f8f9fa", padding: "0.4rem 0.65rem", fontSize: "0.9rem" }}
                />
                <button
                  onClick={() => commitSaveAs(p.id)}
                  style={{ background: "rgba(99,255,177,0.08)", border: "1px solid rgba(99,255,177,0.25)", borderRadius: 4, color: "var(--accent-influence)", fontSize: "0.85rem", padding: "0.4rem 0.8rem", cursor: "pointer" }}
                >Save</button>
                <button
                  onClick={() => { setSaveAsId(null); setSaveAsName(""); }}
                  style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "var(--muted)", fontSize: "0.85rem", padding: "0.4rem 0.8rem", cursor: "pointer" }}
                >Cancel</button>
              </div>
            )}
          </React.Fragment>
        ))}

        {canSaveNew ? (
          <div style={{ display: "flex", gap: 8, marginTop: "1rem" }}>
            <input
              style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#f8f9fa", padding: "0.4rem 0.65rem", fontSize: "0.9rem" }}
              placeholder={`Party ${parties.length + 1}…`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commitSaveNew()}
            />
            <button
              onClick={commitSaveNew}
              style={{ background: "rgba(99,255,177,0.08)", border: "1px solid rgba(99,255,177,0.25)", borderRadius: 4, color: "var(--accent-influence)", fontSize: "0.85rem", padding: "0.4rem 0.8rem", cursor: "pointer", whiteSpace: "nowrap" }}
            >Save New</button>
          </div>
        ) : parties.length >= MAX_PARTIES ? (
          <div style={{ color: "var(--muted)", fontSize: "0.8rem", textAlign: "center", marginTop: "0.85rem" }}>
            Max {MAX_PARTIES} slots reached — overwrite or delete to add a new one.
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ── Scenario Panel ────────────────────────────────────────────────────────────

type ScenarioPanelProps = {
  scenarios: Scenario[];
  combatants: Combatant[];
  onLoad: (s: Scenario) => void;
  onSaveNew: (name: string) => void;
  onOverwrite: (id: string, name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

const ScenarioPanel: React.FC<ScenarioPanelProps> = ({
  scenarios, onLoad, onSaveNew, onOverwrite, onRename, onDelete, onClose,
}) => {
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingVal, setRenamingVal] = useState("");
  const [saveAsId, setSaveAsId] = useState<string | null>(null);
  const [saveAsName, setSaveAsName] = useState("");

  const canAddNew = scenarios.length < MAX_SCENARIOS;

  const commitSaveNew = () => {
    const name = newName.trim() || `Scenario ${scenarios.length + 1}`;
    onSaveNew(name);
    setNewName("");
  };

  const commitSaveAs = (id: string) => {
    const name = saveAsName.trim() || scenarios.find((s) => s.id === id)?.name || `Scenario ${scenarios.length}`;
    onOverwrite(id, name);
    setSaveAsId(null);
    setSaveAsName("");
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "var(--bg-dark)", border: "1px solid var(--border)", borderRadius: "12px 12px 0 0", padding: "1.25rem 1.25rem 2.5rem", width: "100%", maxWidth: 600, maxHeight: "72vh", overflowY: "auto" }}>
        {/* Title */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Scenarios
            <span style={{ marginLeft: 8, color: "var(--muted)", fontSize: "0.8rem", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
              {scenarios.length} / {MAX_SCENARIOS}
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.2rem", lineHeight: 1, padding: "0.15rem 0.3rem" }}>✕</button>
        </div>

        <div style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: "1rem", lineHeight: 1.4 }}>
          Build your pool, then save it to an empty slot or overwrite an existing one. The Save As action lets you keep or rename the scenario name before saving.
        </div>

        {scenarios.length === 0 && (
          <div style={{ color: "var(--muted)", fontSize: "0.85rem", textAlign: "center", padding: "1.5rem 0" }}>
            No saved scenarios yet.
          </div>
        )}

        {scenarios.map((s) => (
          <React.Fragment key={s.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.65rem 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {renamingId === s.id ? (
                  <input
                    autoFocus
                    style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 4, color: "#f8f9fa", padding: "0.25rem 0.5rem", fontSize: "0.9rem", boxSizing: "border-box" }}
                    value={renamingVal}
                    onChange={(e) => setRenamingVal(e.target.value)}
                    onBlur={() => { onRename(s.id, renamingVal.trim() || s.name); setRenamingId(null); }}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  />
                ) : (
                  <>
                    <div
                      onClick={() => { setRenamingId(s.id); setRenamingVal(s.name); }}
                      style={{ fontWeight: 600, fontSize: "0.9rem", cursor: "text", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {s.name}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 2 }}>
                      {s.combatants.length} combatant{s.combatants.length !== 1 ? "s" : ""} · {new Date(s.savedAt).toLocaleDateString()}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => onLoad(s)}
                style={{ background: "rgba(99,255,177,0.08)", border: "1px solid rgba(99,255,177,0.22)", borderRadius: 4, color: "var(--accent-influence)", fontSize: "0.8rem", padding: "0.3rem 0.6rem", cursor: "pointer", whiteSpace: "nowrap" }}
              >Load</button>
              <button
                onClick={() => {
                  setSaveAsId(s.id);
                  setSaveAsName(s.name);
                }}
                title="Save As: overwrite this scenario with the current pool"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "var(--muted)", fontSize: "0.8rem", padding: "0.3rem 0.55rem", cursor: "pointer" }}
              >Save As</button>
              <button
                onClick={() => onDelete(s.id)}
                aria-label="Delete scenario"
                style={{ background: "none", border: "none", color: "rgba(255,107,107,0.55)", cursor: "pointer", fontSize: "0.95rem", padding: "0.15rem 0.3rem" }}
              >✕</button>
            </div>
            {saveAsId === s.id && (
              <div style={{ display: "flex", gap: 8, marginBottom: "0.75rem" }}>
                <input
                  autoFocus
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#f8f9fa", padding: "0.4rem 0.65rem", fontSize: "0.9rem" }}
                />
                <button
                  onClick={() => commitSaveAs(s.id)}
                  style={{ background: "rgba(99,255,177,0.08)", border: "1px solid rgba(99,255,177,0.25)", borderRadius: 4, color: "var(--accent-influence)", fontSize: "0.85rem", padding: "0.4rem 0.8rem", cursor: "pointer" }}
                >Save</button>
                <button
                  onClick={() => { setSaveAsId(null); setSaveAsName(""); }}
                  style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "var(--muted)", fontSize: "0.85rem", padding: "0.4rem 0.8rem", cursor: "pointer" }}
                >Cancel</button>
              </div>
            )}
          </React.Fragment>
        ))}

        {canAddNew ? (
          <div style={{ display: "flex", gap: 8, marginTop: "1rem" }}>
            <input
              style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#f8f9fa", padding: "0.4rem 0.65rem", fontSize: "0.9rem" }}
              placeholder={`Scenario ${scenarios.length + 1}…`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commitSaveNew()}
            />
            <button
              onClick={commitSaveNew}
              style={{ background: "rgba(99,255,177,0.08)", border: "1px solid rgba(99,255,177,0.25)", borderRadius: 4, color: "var(--accent-influence)", fontSize: "0.85rem", padding: "0.4rem 0.8rem", cursor: "pointer", whiteSpace: "nowrap" }}
            >Save New</button>
          </div>
        ) : (
          <div style={{ color: "var(--muted)", fontSize: "0.8rem", textAlign: "center", marginTop: "0.85rem" }}>
            Max {MAX_SCENARIOS} slots reached — overwrite or delete to add a new one.
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function GMCombatTracker() {
  const [appState, setAppState] = useState<AppState>(loadApp);
  const [mode, setMode] = useState<"edit" | "run">(() => loadRunState().mode);
  const [runIndex, setRunIndex] = useState(() => loadRunState().runIndex);
  const [showScenarios, setShowScenarios] = useState(false);
  const [showParties, setShowParties] = useState(false);
  const [partySelected, setPartySelected] = useState<Set<string>>(new Set());

  const { combatants, scenarios, parties } = appState;

  const updateApp = useCallback((next: AppState) => {
    setAppState(next);
    saveApp(next);
  }, []);

  // Clamp run index when pool shrinks
  useEffect(() => {
    if (combatants.length > 0 && runIndex >= combatants.length) {
      setRunIndex(combatants.length - 1);
    }
  }, [combatants.length, runIndex]);

  // Persist Run mode / active index so combat stays running across navigation
  // until the GM explicitly ends it (Edit / Clear).
  useEffect(() => {
    saveRunState(mode, runIndex);
  }, [mode, runIndex]);

  // ── Pool actions ──────────────────────────────────────────────────────────

  const addCombatant = () => {
    setAppState((prev) => {
      const next = { ...prev, combatants: [...prev.combatants, makeCombatant(prev.combatants)] };
      saveApp(next);
      return next;
    });
  };

  // Functional update prevents stale-state overwrites during rapid counter changes
  const updateCombatant = useCallback((updated: Combatant) => {
    setAppState((prev) => {
      const next = { ...prev, combatants: prev.combatants.map((c) => (c.id === updated.id ? updated : c)) };
      saveApp(next);
      return next;
    });
  }, []);

  const moveCombatant = useCallback((id: string, direction: "up" | "down") => {
    setAppState((prev) => {
      const index = prev.combatants.findIndex((c) => c.id === id);
      if (index === -1) return prev;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.combatants.length) return prev;
      const nextCombatants = [...prev.combatants];
      [nextCombatants[index], nextCombatants[nextIndex]] = [nextCombatants[nextIndex], nextCombatants[index]];
      const next = { ...prev, combatants: nextCombatants };
      saveApp(next);
      return next;
    });
  }, []);

  const removeCombatant = (id: string) => {
    setAppState((prev) => {
      const next = { ...prev, combatants: prev.combatants.filter((c) => c.id !== id) };
      if (runIndex >= next.combatants.length && runIndex > 0) setRunIndex(next.combatants.length - 1);
      saveApp(next);
      return next;
    });
  };

  const clearPool = () => {
    if (!window.confirm("Clear all combatants from the pool?")) return;
    updateApp({ ...appState, combatants: [] });
    setRunIndex(0);
    setMode("edit");
  };

  // ── Scenario actions ──────────────────────────────────────────────────────

  const saveNewScenario = (name: string) => {
    if (scenarios.length >= MAX_SCENARIOS) return;
    const snap: Scenario = { id: uid(), name, combatants: [...combatants], savedAt: Date.now() };
    updateApp({ ...appState, scenarios: [...scenarios, snap] });
  };

  const overwriteScenario = (id: string, name: string) => {
    updateApp({
      ...appState,
      scenarios: scenarios.map((s) =>
        s.id === id
          ? { ...s, name, combatants: [...combatants], savedAt: Date.now() }
          : s
      ),
    });
  };

  const renameScenario = (id: string, name: string) => {
    updateApp({ ...appState, scenarios: scenarios.map((s) => s.id === id ? { ...s, name } : s) });
  };

  const loadScenario = (s: Scenario) => {
    updateApp({ ...appState, combatants: s.combatants });
    setRunIndex(0);
    setShowScenarios(false);
  };

  const deleteScenario = (id: string) => {
    if (!window.confirm("Delete this scenario?")) return;
    updateApp({ ...appState, scenarios: scenarios.filter((s) => s.id !== id) });
  };

  // ── Party actions ─────────────────────────────────────────────────────────

  const togglePartySelect = useCallback((id: string) => {
    setPartySelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const saveNewParty = (name: string) => {
    if (parties.length >= MAX_PARTIES) return;
    const players = combatants.filter((c) => c.type === "player" && partySelected.has(c.id));
    if (!players.length) return;
    const snap: Party = { id: uid(), name, players, savedAt: Date.now() };
    updateApp({ ...appState, parties: [...parties, snap] });
  };

  const overwriteParty = (id: string, name: string) => {
    const players = combatants.filter((c) => c.type === "player" && partySelected.has(c.id));
    if (!players.length) return;
    updateApp({
      ...appState,
      parties: parties.map((p) =>
        p.id === id ? { ...p, name, players, savedAt: Date.now() } : p
      ),
    });
  };

  const renameParty = (id: string, name: string) => {
    updateApp({ ...appState, parties: parties.map((p) => p.id === id ? { ...p, name } : p) });
  };

  const importParty = (party: Party) => {
    const alreadyImported = combatants.some((c) => c.partyId === party.id);
    if (alreadyImported) {
      window.alert(`"${party.name}" is already in the pool. Clear those players first before importing again.`);
      return;
    }
    const freshPlayers = party.players.map((p) => ({ ...p, id: uid(), partyId: party.id }));
    updateApp({ ...appState, combatants: [...combatants, ...freshPlayers] });
    setShowParties(false);
  };

  const deleteParty = (id: string) => {
    if (!window.confirm("Delete this party?")) return;
    updateApp({ ...appState, parties: parties.filter((p) => p.id !== id) });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const safeIndex = Math.min(runIndex, Math.max(0, combatants.length - 1));

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "1rem 1rem 4rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>GM</div>
          <h1 style={{ margin: "0.1rem 0 0", fontSize: "1.5rem" }}>Enemy Pool</h1>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setShowParties(true)}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#f8f9fa", padding: "0.4rem 0.75rem", fontSize: "0.82rem", cursor: "pointer" }}
          >
            Party{parties.length > 0 ? ` (${parties.length})` : ""}
          </button>
          <button
            onClick={() => setShowScenarios(true)}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#f8f9fa", padding: "0.4rem 0.75rem", fontSize: "0.82rem", cursor: "pointer" }}
          >
            Scenarios{scenarios.length > 0 ? ` (${scenarios.length})` : ""}
          </button>
          {combatants.length > 0 && (
            <button
              onClick={() => setMode((m) => {
                if (m === "edit") {
                  setAppState((prev) => {
                    const sorted = [...prev.combatants].sort((a, b) => (b.rdy ?? 0) - (a.rdy ?? 0));
                    const next = {
                      ...prev,
                      combatants: sorted.map((c) =>
                        c.type === "enemy" ? { ...c, hp: c.maxHp } : c
                      ),
                    };
                    saveApp(next);
                    return next;
                  });
                  setRunIndex(0);
                  return "run";
                }
                return "edit";
              })}
              style={{ background: mode === "run" ? "rgba(99,255,177,0.1)" : "rgba(255,255,255,0.05)", border: `1px solid ${mode === "run" ? "rgba(99,255,177,0.35)" : "rgba(255,255,255,0.1)"}`, borderRadius: 6, color: mode === "run" ? "var(--accent-influence)" : "#f8f9fa", padding: "0.4rem 0.75rem", fontSize: "0.82rem", cursor: "pointer" }}
            >
              {mode === "edit" ? "▶ Run" : "✎ Edit"}
            </button>
          )}
        </div>
      </div>

      {/* Edit mode */}
      {mode === "edit" && (
        <>
          {combatants.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--muted)", padding: "2.5rem 1rem", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 8, fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              No enemies yet. Add combatants to start tracking.
            </div>
          )}
          {combatants.map((c, index) => (
            <EditRow
              key={c.id}
              c={c}
              index={index}
              isLast={index === combatants.length - 1}
              onChange={updateCombatant}
              onMoveUp={() => moveCombatant(c.id, "up")}
              onMoveDown={() => moveCombatant(c.id, "down")}
              onRemove={() => removeCombatant(c.id)}
              partySelected={partySelected.has(c.id)}
              onPartyToggle={() => togglePartySelect(c.id)}
            />
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: "0.25rem" }}>
            <button
              onClick={addCombatant}
              style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.13)", borderRadius: 8, color: "var(--muted)", padding: "0.75rem", fontSize: "0.88rem", cursor: "pointer" }}
            >
              + Add
            </button>
            {combatants.length > 0 && (
              <button
                onClick={clearPool}
                style={{ background: "none", border: "1px solid rgba(255,107,107,0.18)", borderRadius: 8, color: "rgba(255,107,107,0.65)", padding: "0.75rem 1rem", fontSize: "0.85rem", cursor: "pointer" }}
              >
                Clear
              </button>
            )}
          </div>
        </>
      )}

      {/* Run mode */}
      {mode === "run" && combatants.length > 0 && (
        <RunCard
          c={combatants[safeIndex]}
          index={safeIndex}
          total={combatants.length}
          onChange={updateCombatant}
          onPrev={() => setRunIndex((i) => Math.max(0, i - 1))}
          onNext={() => setRunIndex((i) => (i + 1) % combatants.length)}
          onGoTo={setRunIndex}
        />
      )}

      {/* Party panel */}
      {showParties && (
        <PartyPanel
          parties={parties}
          selectedIds={partySelected}
          combatants={combatants}
          onImport={importParty}
          onSaveNew={saveNewParty}
          onOverwrite={overwriteParty}
          onRename={renameParty}
          onDelete={deleteParty}
          onClose={() => setShowParties(false)}
        />
      )}

      {/* Scenario panel */}
      {showScenarios && (
        <ScenarioPanel
          scenarios={scenarios}
          combatants={combatants}
          onLoad={loadScenario}
          onSaveNew={saveNewScenario}
          onOverwrite={overwriteScenario}
          onRename={renameScenario}
          onDelete={deleteScenario}
          onClose={() => setShowScenarios(false)}
        />
      )}
    </div>
  );
}