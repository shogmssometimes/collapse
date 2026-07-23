import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import DeckBuilder from "./pages/DeckBuilder";
import GearPage from "./pages/Gear";
import CombatPage from "./pages/Combat";
import NotesPage from "./pages/Notes";
import CharMgmt, { CHAR_SWITCH_EVENT } from "./pages/CharMgmt";
import ProfilePage from "./pages/Profile";
import { deckBuilderKey, gearSlotsKey, wardrobeKey, chudStateKey, notesKey, profileKey, CHAR_ACTIVE_KEY } from "./utils/slotKeys";
import { parseHashRoute } from "./utils/routing";

function readActiveCharSlot(): number {
  if (typeof window === 'undefined') return 1;
  const raw = window.localStorage.getItem(CHAR_ACTIVE_KEY);
  const n = raw ? parseInt(raw, 10) : 1;
  return isNaN(n) || n < 1 || n > 3 ? 1 : n;
}

type Route = "hub" | "player" | "player-ops" | "chud" | "csmatrix" | "gear" | "combat" | "notes" | "char-mgmt" | "profile";
type HubCard = {
  id: Route;
  title: string;
  description: string;
};

const buildPath = (path: string) => `${import.meta.env.BASE_URL}${path}`;

// ─── Dice Roller ──────────────────────────────────────────────────────────────
const DICE_OPEN_EVENT = 'dice-open';
type DieSides = 4 | 6 | 8 | 10 | 12 | 20;
type ResultMode = 'total' | 'per-dice';
interface DieRoll { id: string; sides: DieSides; value: number; }
interface DiceState { rolls: DieRoll[]; target: number; mode: ResultMode; modifier: number; }
type DiceAction =
  | { type: 'ROLL'; sides: DieSides }
  | { type: 'ROLL_SOLO'; sides: DieSides }
  | { type: 'CLEAR' }
  | { type: 'REMOVE'; id: string }
  | { type: 'SET_TARGET'; value: number }
  | { type: 'SET_MODIFIER'; value: number }
  | { type: 'TOGGLE_MODE' };

const DICE_SIDES: DieSides[] = [4, 6, 8, 10, 12, 20];
const DIE_COLOR: Record<DieSides, string> = {
  4: '#ff6b6b', 6: '#ffa94d', 8: '#ffd43b', 10: '#69db7c', 12: '#4dabf7', 20: '#cc5de8',
};

function diceReducer(state: DiceState, action: DiceAction): DiceState {
  switch (action.type) {
    case 'ROLL':
      return { ...state, rolls: [...state.rolls, { id: `${Date.now()}-${Math.random()}`, sides: action.sides, value: Math.floor(Math.random() * action.sides) + 1 }] };
    case 'ROLL_SOLO':
      return { ...state, rolls: [{ id: `${Date.now()}-${Math.random()}`, sides: action.sides, value: Math.floor(Math.random() * action.sides) + 1 }] };
    case 'CLEAR':
      return { ...state, rolls: [] };
    case 'REMOVE':
      return { ...state, rolls: state.rolls.filter(r => r.id !== action.id) };
    case 'SET_TARGET':
      return { ...state, target: Math.max(0, Math.min(100, action.value)) };
    case 'SET_MODIFIER':
      return { ...state, modifier: Math.max(-100, Math.min(100, action.value)) };
    case 'TOGGLE_MODE':
      return { ...state, mode: state.mode === 'total' ? 'per-dice' : 'total' };
    default:
      return state;
  }
}

const deriveRoute = (): Route => {
  const { segment, sub } = parseHashRoute();
  if (segment === "player") {
    if (sub === "ops") return "player-ops";
    return "player";
  }
  if (segment === "chud") return "chud";
  if (segment === "csmatrix") return "csmatrix";
  if (segment === "gear") return "gear";
  if (segment === "combat") return "combat";
  if (segment === "notes") return "notes";
  if (segment === "char-mgmt") return "char-mgmt";
  if (segment === "profile") return "profile";
  return "hub";
};

const SubAppFrame: React.FC<{ title: string; src: string; onBack: () => void; actions?: React.ReactNode; actionsClassName?: string; frameRef?: React.Ref<HTMLIFrameElement>; onFrameLoad?: () => void }> = ({
  title,
  src,
  onBack,
  actions,
  actionsClassName,
  frameRef,
  onFrameLoad,
}) => (
  <>
  <DiceDock />
  <main className="route-view" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
    <header className="topbar" style={{ position: 'relative' }}>
      <button className="ghost-btn ghost-btn-icon" onClick={onBack} aria-label="Back to hub">
        <span aria-hidden="true">←</span>
      </button>
      <button className="ghost-btn ghost-btn-icon" onClick={() => window.dispatchEvent(new Event(DICE_OPEN_EVENT))} aria-label="Open dice roller" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.65)' }}>
        <DiceIcon size={18} />
      </button>
      {actions ? <div className={actionsClassName || "topbar-actions"}>{actions}</div> : null}
    </header>
    <div className="subapp-frame">
      <iframe
        title={title}
        src={src}
        ref={frameRef}
        onLoad={onFrameLoad}
        style={{ border: "none" }}
        allow="fullscreen"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-pointer-lock"
      />
    </div>
  </main>
  </>
);

const PlayerShell: React.FC<{ onBack: () => void; children: React.ReactNode; chudDock?: React.ReactNode }> = ({ onBack, children, chudDock }) => {
  const openChud = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("chud-open"));
  };
  return (
  <div className="player-shell" style={{ minHeight: "100vh", background: "var(--bg-dark)" }}>
    <DiceDock />
    <header className="topbar" style={{ position: 'relative' }}>
      <button className="ghost-btn ghost-btn-icon" onClick={onBack} aria-label="Back to hub">
        <span aria-hidden="true">←</span>
      </button>
      <button className="ghost-btn ghost-btn-icon" onClick={() => window.dispatchEvent(new Event(DICE_OPEN_EVENT))} aria-label="Open dice roller" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.65)' }}>
        <DiceIcon size={18} />
      </button>
      <div className="topbar-actions">
        <button className="chud-top-btn" onClick={openChud} aria-label="Open cHUD overlay">cHUD</button>
      </div>
    </header>
    {chudDock}
    {children}
  </div>
  );
};

const DiceIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="4" ry="4" />
    <circle cx="8.5"  cy="8.5"  r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="8.5"  r="1.4" fill="currentColor" stroke="none" />
    <circle cx="8.5"  cy="15.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12"   cy="12"   r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

const DiceDock: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [ds, dispatchDice] = useReducer(diceReducer, { rolls: [], target: 0, mode: 'total', modifier: 0 });
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipsEndRef = useRef<HTMLDivElement>(null);
  const prevRollIdsRef = useRef<Set<string>>(new Set());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const [rollingId, setRollingId] = React.useState<string | null>(null);
  const [rollingValue, setRollingValue] = React.useState<number>(1);

  const vibe = () => { try { if (navigator.vibrate) navigator.vibrate(8); } catch { /* ignore */ } };

  React.useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener(DICE_OPEN_EVENT, h);
    return () => window.removeEventListener(DICE_OPEN_EVENT, h);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const y = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${y}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, y);
    };
  }, [open]);

  React.useEffect(() => {
    chipsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [ds.rolls.length]);

  React.useEffect(() => {
    const newRoll = ds.rolls.find(r => !prevRollIdsRef.current.has(r.id));
    prevRollIdsRef.current = new Set(ds.rolls.map(r => r.id));
    if (!newRoll) return;
    setRollingId(newRoll.id);
    let ticks = 0;
    const maxTicks = 8;
    const interval = setInterval(() => {
      ticks++;
      setRollingValue(Math.floor(Math.random() * newRoll.sides) + 1);
      if (ticks >= maxTicks) {
        clearInterval(interval);
        setRollingId(null);
      }
    }, 60);
    return () => clearInterval(interval);
  }, [ds.rolls]);

  if (!open) return null;

  const displayRolls = ds.rolls.map(r => r.id === rollingId ? { ...r, value: rollingValue } : r);
  const rollsTotal = displayRolls.reduce((s, r) => s + r.value, 0);
  const total = rollsTotal + ds.modifier;
  const hasTarget = ds.target > 0;
  const hasModifier = ds.modifier !== 0;
  const passing = hasTarget ? displayRolls.filter(r => r.value >= ds.target) : [];
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-display)', letterSpacing: '0.14em' };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dice Roller"
      style={{ position: 'fixed', inset: 0, background: 'rgba(4,6,10,0.75)', backdropFilter: 'blur(12px)', zIndex: 402, display: 'flex', justifyContent: 'center', alignItems: 'stretch', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div style={{ width: 'min(960px,100vw)', background: '#0c0f16', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', height: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', ...labelStyle, fontSize: '1rem', color: 'var(--accent)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DiceIcon size={18} />DICE ROLLER
          </div>
          <button onPointerUp={() => { vibe(); setOpen(false); }} aria-label="Close dice roller" style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: '#eaf2ff', borderRadius: 8, padding: '6px 10px', fontSize: '0.95rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '10px 14px 24px', display: 'flex', flexDirection: 'column', gap: 14 } as React.CSSProperties}>

          {/* Mode toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 11, padding: 3 }}>
            {(['total', 'per-dice'] as ResultMode[]).map(m => (
              <button key={m} onClick={() => dispatchDice({ type: 'TOGGLE_MODE' })} style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: ds.mode === m ? 'rgba(15,246,255,0.12)' : 'transparent', color: ds.mode === m ? 'var(--accent)' : 'rgba(255,255,255,0.3)', ...labelStyle, fontSize: '0.68rem', cursor: 'pointer', transition: 'background 0.15s,color 0.15s', boxShadow: ds.mode === m ? 'inset 0 0 0 1px rgba(15,246,255,0.2)' : 'none' }}>
                {m === 'total' ? 'TOTAL' : 'PER DICE'}
              </button>
            ))}
          </div>

          {/* Results — fixed height so layout doesn't shift on roll */}
          <div style={{ minHeight: 210, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          {ds.rolls.length === 0
            ? <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem', ...labelStyle }}>NO ROLLS YET</div>
            : ds.mode === 'total'
              ? <div style={{ textAlign: 'center' }}>
                  <div style={{ height: 34, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                    {hasModifier && <>
                      <span style={{ ...labelStyle, fontSize: '1.6rem', color: 'rgba(255,255,255,0.4)' }}>{rollsTotal}</span>
                      <span style={{ ...labelStyle, fontSize: '1rem', color: 'rgba(255,165,77,0.5)' }}>{ds.modifier > 0 ? '+' : '−'}</span>
                      <span style={{ ...labelStyle, fontSize: '1.6rem', color: '#ffa94d66' }}>{Math.abs(ds.modifier)}</span>
                      <span style={{ ...labelStyle, fontSize: '1rem', color: 'rgba(255,255,255,0.15)' }}>=</span>
                    </>}
                  </div>
                  <div style={{ ...labelStyle, fontSize: '3.8rem', lineHeight: 1, color: hasTarget && total >= ds.target ? '#69db7c' : '#fff', textShadow: hasTarget && total >= ds.target ? '0 0 24px #69db7c99, 0 0 48px #69db7c44' : 'none', transition: 'color 0.25s, text-shadow 0.25s' }}>{total}</div>
                  <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)', ...labelStyle, marginTop: 6, marginBottom: 18 }}>TOTAL</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onPointerDown={e => { e.preventDefault(); dispatchDice({ type: 'SET_MODIFIER', value: ds.modifier - 1 }); vibe(); }} style={{ width: 48, height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>−</button>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)', ...labelStyle, marginBottom: 3 }}>MODIFIER</div>
                      <span style={{ ...labelStyle, fontSize: '2rem', color: hasModifier ? '#ffa94d' : 'rgba(255,255,255,0.2)', lineHeight: 1 }}>
                        {hasModifier ? (ds.modifier > 0 ? `+${ds.modifier}` : `${ds.modifier}`) : '0'}
                      </span>
                    </div>
                    <button onPointerDown={e => { e.preventDefault(); dispatchDice({ type: 'SET_MODIFIER', value: ds.modifier + 1 }); vibe(); }} style={{ width: 48, height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>+</button>
                  </div>
                </div>
              : <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', ...labelStyle, marginBottom: 8 }}>DICE MEETING TARGET</div>
                  {!hasTarget
                    ? <div style={{ color: 'rgba(255,255,255,0.25)', ...labelStyle, fontSize: '0.75rem' }}>SET A TARGET ABOVE</div>
                    : <>
                        <div style={{ lineHeight: 1 }}>
                          <span style={{ ...labelStyle, fontSize: '5rem', color: passing.length > 0 ? '#69db7c' : 'rgba(255,255,255,0.25)' }}>{passing.length}</span>
                          <span style={{ ...labelStyle, fontSize: '2rem', color: 'rgba(255,255,255,0.25)' }}>/{ds.rolls.length}</span>
                        </div>
                        <div style={{ marginTop: 8, fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', ...labelStyle }}>MEET OR BEAT {ds.target}</div>
                      </>
                  }
                </div>
          }
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

          {/* Target */}
          <div>
            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', ...labelStyle, marginBottom: 10 }}>TARGET</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <button onPointerDown={e => { e.preventDefault(); dispatchDice({ type: 'SET_TARGET', value: ds.target - 1 }); vibe(); }} style={{ width: 48, height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>−</button>
              <div style={{ minWidth: 56, textAlign: 'center' }}>
                <span style={{ ...labelStyle, fontSize: '2.2rem', color: hasTarget ? 'var(--accent)' : 'rgba(255,255,255,0.2)', lineHeight: 1 }}>{ds.target}</span>
              </div>
              <button onPointerDown={e => { e.preventDefault(); dispatchDice({ type: 'SET_TARGET', value: ds.target + 1 }); vibe(); }} style={{ width: 48, height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}>+</button>
            </div>
          </div>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

          {/* Die buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '0 12%' }}>
            {DICE_SIDES.map(sides => {
              const color = DIE_COLOR[sides];
              const startLongPress = (e: React.PointerEvent<HTMLButtonElement>) => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px ${color}55`;
                (e.currentTarget as HTMLElement).style.background = `${color}22`;
                longPressFiredRef.current = false;
                longPressTimerRef.current = setTimeout(() => {
                  longPressFiredRef.current = true;
                  vibe();
                  dispatchDice({ type: 'ROLL_SOLO', sides });
                }, 500);
              };
              const cancelLongPress = (e: React.PointerEvent<HTMLButtonElement>) => {
                (e.currentTarget as HTMLElement).style.boxShadow = '';
                (e.currentTarget as HTMLElement).style.background = `${color}0f`;
                if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
              };
              return (
                <button
                  key={sides}
                  onClick={() => {
                    if (longPressFiredRef.current) { longPressFiredRef.current = false; return; }
                    vibe(); dispatchDice({ type: 'ROLL', sides });
                  }}
                  onPointerDown={startLongPress}
                  onPointerUp={cancelLongPress}
                  onPointerLeave={cancelLongPress}
                  onPointerCancel={cancelLongPress}
                  onContextMenu={e => e.preventDefault()}
                  style={{ aspectRatio: '1', padding: 0, borderRadius: 16, border: `1.5px solid ${color}44`, background: `${color}0f`, color, ...labelStyle, fontSize: '1.5rem', cursor: 'pointer', transition: 'box-shadow 0.1s', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  D{sides}
                </button>
              );
            })}
          </div>

          {/* Roll chips */}
          <div>
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', ...labelStyle }}>ROLLS{ds.rolls.length > 0 ? ` · ${ds.rolls.length}` : ''}</span>
            </div>
            {ds.rolls.length === 0
              ? <div style={{ padding: 22, textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '0.82rem', border: '1px dashed rgba(255,255,255,0.07)', borderRadius: 12 }}>Tap a die to roll</div>
              : <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {displayRolls.map(roll => {
                    const color = DIE_COLOR[roll.sides];
                    const rolling = roll.id === rollingId;
                    const glow = !rolling && ds.mode === 'per-dice' && hasTarget && roll.value >= ds.target;
                    return (
                      <div
                        key={roll.id}
                        onPointerDown={() => {
                          longPressRef.current = setTimeout(() => {
                            vibe();
                            dispatchDice({ type: 'REMOVE', id: roll.id });
                          }, 500);
                        }}
                        onPointerUp={() => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } }}
                        onPointerLeave={() => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } }}
                        style={{ width: 54, height: 54, borderRadius: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${glow ? color : color + '44'}`, background: glow ? `radial-gradient(circle at 50% 60%,${color}28,${color}0a)` : `${color}0d`, boxShadow: glow ? `0 0 0 1px ${color}66,0 0 16px ${color}55,0 6px 20px ${color}30` : rolling ? `0 0 14px ${color}88` : '0 2px 8px rgba(0,0,0,0.35)', transition: 'box-shadow 0.25s,background 0.25s,border-color 0.25s', flexShrink: 0, userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', cursor: 'pointer', animation: rolling ? 'diceRollPulse 0.12s linear infinite' : 'none' }}>
                        <span style={{ ...labelStyle, fontSize: '1.15rem', color: glow ? color : '#fff', lineHeight: 1 }}>{roll.value}</span>
                        <span style={{ fontSize: '0.48rem', color: `${color}77`, marginTop: 2, ...labelStyle }}>D{roll.sides}</span>
                      </div>
                    );
                  })}
                  <div ref={chipsEndRef} style={{ width: 0 }} />
                </div>
            }
            {ds.rolls.length > 0 && (
              <button onClick={() => dispatchDice({ type: 'CLEAR' })} style={{ marginTop: 14, width: '100%', padding: '12px 0', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', ...labelStyle, cursor: 'pointer', letterSpacing: '0.12em' }}>CLEAR ALL</button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

const ChudDock: React.FC<{ basePath: string; charSlot?: number }> = ({ basePath, charSlot = 1 }) => {
  const [open, setOpen] = React.useState(false);
  const vibrate = (pattern: number = 10) => {
    if (typeof navigator !== "undefined" && typeof (navigator as any).vibrate === "function") {
      (navigator as any).vibrate(pattern);
    }
  };
  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("chud-open", handler as EventListener);
    return () => window.removeEventListener("chud-open", handler as EventListener);
  }, []);
  React.useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [open]);
  return (
    <>
      <button className="chud-fab" onClick={() => setOpen(true)} aria-label="Open cHUD overlay">
        cHUD
      </button>
      {open && (
        <div
          className="chud-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="cHUD overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              vibrate();
              setOpen(false);
            }
          }}
        >
          <div className="chud-sheet">
            <div className="chud-sheet-header">
              <span>cHUD</span>
              <button
                className="chud-close"
                onClick={() => {
                  vibrate();
                  setOpen(false);
                }}
                aria-label="Close cHUD"
              >
                ✕
              </button>
            </div>
            <div className="chud-sheet-body">
              <iframe
                title="cHUD"
                src={`${basePath}chud/index.html?slot=${charSlot}`}
                allow="fullscreen"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-pointer-lock"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const HUB_CARD_DEFS: HubCard[] = [
  {
    id: "player",
    title: "Deck Builder",
    description: "Player-facing tools with deck builder and ops.",
  },
  {
    id: "player-ops",
    title: "Deck Ops",
    description: "Standalone deck operations for the player deck.",
  },
  {
    id: "csmatrix",
    title: "CS Matrix",
    description: "Campaign Support Matrix with draggable nodes.",
  },
  {
    id: "gear",
    title: "Wardrobe & Gear",
    description: "Browse equipment and items.",
  },
  {
    id: "combat",
    title: "Combat",
    description: "Combat tools and tracking.",
  },
  {
    id: "notes",
    title: "Notes",
    description: "Campaign notes and reminders.",
  },
  {
    id: "chud",
    title: "cHUD",
    description: "Compact HUD for derived stats.",
  },
  {
    id: "char-mgmt",
    title: "Character Management",
    description: "Manage up to 3 characters. Hot swap decks and export or import saves.",
  },
  {
    id: "profile",
    title: "Profile",
    description: "Character profile and background.",
  },
];

type HubOrderMode = "build" | "play" | "custom";
const HUB_MODE_KEY = "hub.order.mode.v1";
const HUB_CUSTOM_ORDER_KEY = "hub.order.custom.v1";

const HUB_BUILD_ORDER: Route[] = ["csmatrix", "gear", "chud", "combat", "player", "profile", "char-mgmt", "player-ops", "notes"];
const HUB_PLAY_ORDER: Route[] = ["chud", "player-ops", "csmatrix", "gear", "combat", "player", "notes", "profile", "char-mgmt"];

function orderCards(order: Route[]): HubCard[] {
  const byId = new Map(HUB_CARD_DEFS.map(c => [c.id, c]));
  const ordered = order.map(id => byId.get(id)).filter((c): c is HubCard => !!c);
  // Include any cards missing from the order list (safety net for future additions)
  const seen = new Set(ordered.map(c => c.id));
  for (const c of HUB_CARD_DEFS) if (!seen.has(c.id)) ordered.push(c);
  return ordered;
}

function loadHubMode(): HubOrderMode {
  try {
    const raw = localStorage.getItem(HUB_MODE_KEY);
    if (raw === "build" || raw === "play" || raw === "custom") return raw;
  } catch {}
  return "build";
}

function loadCustomOrder(): Route[] {
  try {
    const raw = localStorage.getItem(HUB_CUSTOM_ORDER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Route[];
    }
  } catch {}
  return HUB_CARD_DEFS.map(c => c.id);
}

const HubLanding: React.FC<{
  onNavigate: (route: Route) => void;
}> = ({ onNavigate }) => {
  const [mode, setMode] = useState<HubOrderMode>(() => loadHubMode());
  const [customOrder, setCustomOrder] = useState<Route[]>(() => loadCustomOrder());
  const [dragId, setDragId] = useState<Route | null>(null);
  const [dragOverId, setDragOverId] = useState<Route | null>(null);
  const cardRefs = useRef<Map<Route, HTMLButtonElement>>(new Map());
  const dragMovedRef = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(HUB_MODE_KEY, mode); } catch {}
  }, [mode]);

  useEffect(() => {
    try { localStorage.setItem(HUB_CUSTOM_ORDER_KEY, JSON.stringify(customOrder)); } catch {}
  }, [customOrder]);

  const cards = useMemo<HubCard[]>(() => {
    if (mode === "build") return orderCards(HUB_BUILD_ORDER);
    if (mode === "play") return orderCards(HUB_PLAY_ORDER);
    return orderCards(customOrder);
  }, [mode, customOrder]);

  const reorderCustom = useCallback((fromId: Route, toId: Route) => {
    if (fromId === toId) return;
    setCustomOrder(prev => {
      const next = [...prev];
      const fromIdx = next.indexOf(fromId);
      const toIdx = next.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromId);
      return next;
    });
  }, []);

  // Pointer-based drag reordering (works on touch and mouse, unlike HTML5 drag-and-drop
  // which iOS Safari does not support).
  const findCardIdAtPoint = useCallback((x: number, y: number): Route | null => {
    for (const [id, el] of cardRefs.current) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return id;
    }
    return null;
  }, []);

  const handlePointerDown = useCallback((cardId: Route) => (e: React.PointerEvent) => {
    dragMovedRef.current = false;
    if (mode !== "custom") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragId(cardId);
  }, [mode]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (mode !== "custom" || !dragId) return;
    dragMovedRef.current = true;
    const overId = findCardIdAtPoint(e.clientX, e.clientY);
    setDragOverId(overId);
  }, [mode, dragId, findCardIdAtPoint]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (mode !== "custom" || !dragId) return;
    const overId = findCardIdAtPoint(e.clientX, e.clientY);
    if (overId) reorderCustom(dragId, overId);
    setDragId(null);
    setDragOverId(null);
  }, [mode, dragId, findCardIdAtPoint, reorderCustom]);

  return (
    <>
    <main className="hub-landing">
      <div className="hub-landing-content" style={{ width: "min(1100px, 100%)", padding: "1.25rem 1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <button
            className="ghost-btn ghost-btn-icon"
            onClick={() => window.dispatchEvent(new Event(DICE_OPEN_EVENT))}
            aria-label="Open dice roller"
            style={{ color: "var(--muted)" }}
          >
            <DiceIcon size={18} />
          </button>
          <a
            href={`${import.meta.env.BASE_URL}gm.html`}
            style={{ color: "var(--muted)", fontSize: "0.85rem", textDecoration: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.75rem" }}
          >
            Switch to GM →
          </a>
        </div>
        <div
          role="group"
          aria-label="Hub link order"
          style={{
            display: "inline-flex",
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            marginBottom: "0.75rem",
          }}
        >
          {(["build", "play", "custom"] as HubOrderMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "0.4rem 1rem",
                fontSize: "0.8rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontFamily: "var(--font-display)",
                border: "none",
                cursor: "pointer",
                background: mode === m ? "var(--accent)" : "transparent",
                color: mode === m ? "#000" : "var(--muted)",
              }}
            >
              {m}
            </button>
          ))}
        </div>
        {mode === "custom" && (
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0 0 0.5rem" }}>
            Tap and drag a card to reorder.
          </p>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            marginTop: "0.6rem",
          }}
        >
          {cards.map((card, index) => {
            const isCustom = mode === "custom";
            const isDragging = dragId === card.id;
            const isDragOver = isCustom && dragOverId === card.id && dragId !== card.id;
            return (
              <button
                key={card.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(card.id, el);
                  else cardRefs.current.delete(card.id);
                }}
                className="hub-card"
                onPointerDown={handlePointerDown(card.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => { setDragId(null); setDragOverId(null); }}
                style={{
                  border: `1px solid ${isDragOver ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 8,
                  padding: "1rem",
                  background: "var(--surface)",
                  minHeight: 126,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  textAlign: "center",
                  cursor: isCustom ? "grab" : "pointer",
                  opacity: isDragging ? 0.5 : 1,
                  touchAction: isCustom ? "none" : "auto",
                  transition: "opacity 0.15s, border-color 0.15s",
                '--card-index': index,
                } as React.CSSProperties}
                onClick={() => { if (!isCustom && !dragMovedRef.current) onNavigate(card.id); }}
              >
                <h2 style={{ margin: 0 }}>{card.title}</h2>
                <p style={{ color: "var(--muted)", margin: "0.25rem 0" }}>{card.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </main>
    </>
  );
};

export default function App() {
  const [route, setRoute] = useState<Route>(() => deriveRoute());
  const [charSlot, setCharSlot] = useState<number>(() => readActiveCharSlot());
  const matrixFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [matrixState, setMatrixState] = useState({ controlsOpen: false, nodesOpen: false });

  const chudDock = route !== "chud" ? <ChudDock basePath={buildPath("")} charSlot={charSlot} /> : null;
  const deckStorageKey = deckBuilderKey(charSlot);

  useEffect(() => {
    const handler = (e: Event) => {
      const slot = (e as CustomEvent<number>).detail;
      if (typeof slot === 'number') setCharSlot(slot);
    };
    window.addEventListener(CHAR_SWITCH_EVENT, handler);
    return () => window.removeEventListener(CHAR_SWITCH_EVENT, handler);
  }, []);

  useEffect(() => {
    const syncRoute = () => setRoute(deriveRoute());
    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const expectedOrigin = window.location.origin && window.location.origin !== "null" ? window.location.origin : "*";
    const handleMessage = (event: MessageEvent) => {
      if (expectedOrigin !== "*" && event.origin !== expectedOrigin) return;
      const data = event.data;
      if (!data) return;
      if (data.type === "collapse-csmatrix-state") {
        setMatrixState({
          controlsOpen: Boolean(data.controlsOpen),
          nodesOpen: Boolean(data.nodesOpen),
        });
      }
      if (data.type === "collapse-navigate" && typeof data.route === "string") {
        setRoute(data.route as Route);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const postToMatrix = useCallback((action: "toggle-controls" | "toggle-nodes" | "request-state") => {
    if (typeof window === "undefined") return;
    const frameWin = matrixFrameRef.current?.contentWindow;
    if (!frameWin) return;
    const targetOrigin = window.location.origin && window.location.origin !== "null" ? window.location.origin : "*";
    frameWin.postMessage({ target: "csmatrix", action }, targetOrigin);
  }, []);

  const requestMatrixState = useCallback(() => {
    postToMatrix("request-state");
  }, [postToMatrix]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const desiredHash = (() => {
      switch (route) {
        case "player":    return "#/player";
        case "player-ops": return "#/player/ops";
        case "chud":      return "#/chud";
        case "csmatrix":  return "#/csmatrix";
        case "gear":      return "#/gear";
        case "combat":    return "#/combat";
        case "char-mgmt": return "#/char-mgmt";
        case "profile":   return "#/profile";
        default:          return "#/hub";
      }
    })();
    if (window.location.hash !== desiredHash) {
      window.location.hash = desiredHash;
    }
  }, [route]);

  if (route === "player") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock}>
        <DeckBuilder
          key={`player-${charSlot}`}
          storageKey={deckStorageKey}
          chudStateStorageKey={chudStateKey(charSlot)}
          showOpsSections={false}
          showModifierCards={true}
          showModifierCardCounter={false}
          showModifierCapacity={true}
          showBaseCounters={true}
          showBaseAdjusters={false}
        />
      </PlayerShell>
    );
  }

  if (route === "player-ops") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock}>
        <DeckBuilder
          key={`player-ops-${charSlot}`}
          storageKey={deckStorageKey}
          chudStateStorageKey={chudStateKey(charSlot)}
          showBuilderSections={false}
          showOpsSections={true}
          lockControlsInOps={false}
        />
      </PlayerShell>
    );
  }

  if (route === "chud") {
    return (
      <SubAppFrame
        key={route}
        title="cHUD — Compact HUD"
        src={`${buildPath("")}chud/index.html?slot=${charSlot}`}
        onBack={() => setRoute("hub")}
      />
    );
  }

  if (route === "csmatrix") {
    return (
      <SubAppFrame
        key={route}
        title="CS Matrix"
        src={buildPath("csmatrix/index.html")}
        onBack={() => setRoute("hub")}
        actionsClassName="topbar-actions topbar-actions-stack"
        actions={
          <>
            <button
              className="topbar-pill"
              onClick={() => postToMatrix("toggle-controls")}
              aria-pressed={matrixState.controlsOpen}
            >
              {matrixState.controlsOpen ? "Hide Controls" : "Show Controls"}
            </button>
          </>
        }
        frameRef={matrixFrameRef}
        onFrameLoad={requestMatrixState}
      />
    );
  }

  if (route === "notes") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock}>
        <NotesPage key={`notes-${charSlot}`} storageKey={notesKey(charSlot)} />
      </PlayerShell>
    );
  }

  if (route === "gear") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock}>
        <GearPage
          key={`gear-${charSlot}`}
          gearSlotsStorageKey={gearSlotsKey(charSlot)}
          wardrobeStorageKey={wardrobeKey(charSlot)}
          chudStateStorageKey={chudStateKey(charSlot)}
        />
      </PlayerShell>
    );
  }

  if (route === "combat") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock}>
        <CombatPage />
      </PlayerShell>
    );
  }

  if (route === "char-mgmt") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock}>
        <CharMgmt />
      </PlayerShell>
    );
  }

  if (route === "profile") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock}>
        <ProfilePage key={`profile-${charSlot}`} storageKey={profileKey(charSlot)} charSlot={charSlot} />
      </PlayerShell>
    );
  }

  return (
    <>
      <DiceDock />
      {chudDock}
      <HubLanding onNavigate={(next) => setRoute(next)} />
    </>
  );
}
