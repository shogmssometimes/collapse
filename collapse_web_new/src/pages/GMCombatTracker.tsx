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

type SetRollState = {
  open: boolean;
  target: number;
  modifier: number;
  lastRoll: number | null;
};

function defaultSetRoll(): SetRollState {
  return { open: false, target: 0, modifier: 0, lastRoll: null };
}

type Combatant = {
  id: string;
  name: string;
  type: CombatantType;
  icon?: string;
  avatarUrl?: string; // optional hosted image URL (e.g. Imgur) shown as circle
  hp: number;
  maxHp: number;
  viv: number;
  maxViv: number;
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
    viv: type === "enemy" ? 0 : 0,
    maxViv: type === "enemy" ? 99 : 0,
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
    const migrateCombatant = (c: any, index: number) => ({
      ...c,
      icon: migrateIcon(c.icon) ?? ICONS[index % ICONS.length],
      notes: migrateNotes(c.notes),
      setRoll: c.setRoll && typeof c.setRoll === "object"
        ? { ...defaultSetRoll(), ...c.setRoll }
        : defaultSetRoll(),
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
// Per-combatant, collapsible status-effect roll tracker. Each combatant owns
// its own SetRollState, so panels never interfere with one another and persist
// with the rest of the combatant's data.

type SetRollPanelProps = {
  value: SetRollState;
  onChange: (next: SetRollState) => void;
};

const SetRollPanel: React.FC<SetRollPanelProps> = ({ value, onChange }) => {
  const hasTarget = value.target > 0;
  const hasModifier = value.modifier !== 0;
  const total = value.lastRoll !== null ? value.lastRoll + value.modifier : null;
  const passing = hasTarget && total !== null ? total >= value.target : null;

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, marginTop: "0.6rem", overflow: "hidden" }}>
      <button
        onClick={(e) => { e.stopPropagation(); onChange({ ...value, open: !value.open }); }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(255,255,255,0.03)",
          border: "none",
          color: "#f8f9fa",
          padding: "0.5rem 0.75rem",
          fontSize: "0.82rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <span>Set Roll (Status Effects)</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {total !== null && (
            <span style={{ fontSize: "0.78rem", color: passing === true ? "var(--accent-influence)" : passing === false ? "var(--error)" : "var(--muted)" }}>
              {total}{hasTarget ? ` / ${value.target}` : ""}
            </span>
          )}
          <span style={{ color: "var(--muted)", transform: value.open ? "rotate(180deg)" : "none", transition: "transform 0.15s", display: "inline-block" }}>▾</span>
        </span>
      </button>
      {value.open && (
        <div style={{ padding: "0.75rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
          <div>
            <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 6, textAlign: "center" }}>Target</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <button
                onClick={() => onChange({ ...value, target: Math.max(0, value.target - 1) })}
                style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", cursor: "pointer" }}
              >−</button>
              <span style={{ minWidth: 28, textAlign: "center", fontWeight: 700, color: hasTarget ? "var(--accent)" : "rgba(255,255,255,0.3)" }}>{value.target}</span>
              <button
                onClick={() => onChange({ ...value, target: Math.min(100, value.target + 1) })}
                style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", cursor: "pointer" }}
              >+</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 6, textAlign: "center" }}>Modifier</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <button
                onClick={() => onChange({ ...value, modifier: Math.max(-100, value.modifier - 1) })}
                style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", cursor: "pointer" }}
              >−</button>
              <span style={{ minWidth: 28, textAlign: "center", fontWeight: 700, color: hasModifier ? "var(--accent-amber)" : "rgba(255,255,255,0.3)" }}>{hasModifier ? (value.modifier > 0 ? `+${value.modifier}` : value.modifier) : 0}</span>
              <button
                onClick={() => onChange({ ...value, modifier: Math.min(100, value.modifier + 1) })}
                style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#fff", cursor: "pointer" }}
              >+</button>
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => onChange({ ...value, lastRoll: Math.floor(Math.random() * 20) + 1 })}
              style={{ flex: 1, background: "rgba(15,246,255,0.08)", border: "1px solid rgba(15,246,255,0.25)", borderRadius: 6, color: "var(--accent)", padding: "0.45rem 0", fontSize: "0.82rem", cursor: "pointer" }}
            >
              Roll d20{total !== null ? ` → ${total}` : ""}
            </button>
            {value.lastRoll !== null && (
              <button
                onClick={() => onChange({ ...value, lastRoll: null })}
                style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "var(--muted)", padding: "0.45rem 0.6rem", fontSize: "0.78rem", cursor: "pointer" }}
              >Clear</button>
            )}
          </div>
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
                ? { ...c, type: "player", hp: 0, maxHp: 0, viv: 0, maxViv: 0 }
                : { ...c, type: "enemy", icon: c.icon || ICONS[index % ICONS.length], hp: c.maxHp > 0 ? c.maxHp : 10, maxHp: c.maxHp > 0 ? c.maxHp : 10, viv: c.viv ?? 0, maxViv: c.maxViv > 0 ? c.maxViv : 99 }
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
              HP starts at max in Run mode. VIV starts at 0.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ color: "var(--muted)", fontSize: "0.88rem", padding: "0.85rem 0.5rem", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, marginBottom: "0.6rem" }}>
          Player placeholders do not track HP or VIV.
        </div>
      )}

      <NotesTable notes={c.notes} onChange={(notes) => onChange({ ...c, notes })} />

      <SetRollPanel value={c.setRoll ?? defaultSetRoll()} onChange={(setRoll) => onChange({ ...c, setRoll })} />
    </div>
  );
};

// ── Run Card ──────────────────────────────────────────────────────────────────
// Horizontal swipe on the card background navigates between combatants.
// Vertical swipe / scroll on counters adjusts HP / Viv.

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
        if (dx < 0 && indexRef.current < totalRef.current - 1) onNextRef.current();
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
            onClick={onNext} disabled={index === total - 1}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: index === total - 1 ? "rgba(255,255,255,0.18)" : "#f8f9fa", padding: "0.4rem 0.85rem", fontSize: "1.1rem", cursor: index === total - 1 ? "default" : "pointer" }}
          >→</button>
        </div>
      </div>

      {/* Counters */}
      {c.type === "enemy" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.75rem" }}>
          <Counter
            label="HP" value={c.hp} max={c.maxHp} accent="var(--accent-influence)"
            onChange={(v) => onChange({ ...c, hp: v })}
            onMaxChange={(v) => onChange({ ...c, maxHp: v, hp: Math.min(c.hp, v) })}
            large
          />
          <Counter
            label="VIV" value={c.viv} max={c.maxViv} accent="var(--accent)"
            onChange={(v) => onChange({ ...c, viv: v })}
            large
            noMax
          />
        </div>
      ) : (
        <div style={{ color: "var(--muted)", fontSize: "0.92rem", padding: "1rem", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10 }}>
          Player placeholder — no HP/VIV values are tracked here.
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
  const [mode, setMode] = useState<"edit" | "run">("edit");
  const [runIndex, setRunIndex] = useState(0);
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
                    const next = {
                      ...prev,
                      combatants: prev.combatants.map((c) =>
                        c.type === "enemy" ? { ...c, hp: c.maxHp, viv: 0 } : c
                      ),
                    };
                    saveApp(next);
                    return next;
                  });
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
              + Add Enemy
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
          onNext={() => setRunIndex((i) => Math.min(combatants.length - 1, i + 1))}
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