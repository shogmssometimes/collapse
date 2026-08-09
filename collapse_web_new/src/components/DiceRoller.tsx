import React, { useReducer, useRef } from "react";

// ─── Dice Roller ──────────────────────────────────────────────────────────────
// Shared dice roller dock used on both the player side and GM side.
export const DICE_OPEN_EVENT = 'dice-open';
type DieSides = 4 | 6 | 8 | 10 | 12 | 20;
type ResultMode = 'total' | 'per-dice';
interface DieRoll { id: string; sides: DieSides; value: number; acedFrom?: string; }
interface DiceState { rolls: DieRoll[]; target: number; mode: ResultMode; modifier: number; }
type DiceAction =
  | { type: 'ROLL'; sides: DieSides }
  | { type: 'ROLL_SOLO'; sides: DieSides }
  | { type: 'ACE_REROLL'; parentId: string }
  | { type: 'CLEAR' }
  | { type: 'REMOVE'; id: string }
  | { type: 'SET_TARGET'; value: number }
  | { type: 'SET_MODIFIER'; value: number }
  | { type: 'TOGGLE_MODE' };

const DICE_SIDES: DieSides[] = [4, 6, 8, 10, 12, 20];
const DIE_COLOR: Record<DieSides, string> = {
  4: '#ff6b6b', 6: '#ffa94d', 8: '#ffd43b', 10: '#69db7c', 12: '#4dabf7', 20: '#cc5de8',
};

// Acing: rolling max value on a die steps down to the next smallest standard
// die size and adds another roll. Chain stops when a roll isn't max, or once
// 1d4 has been rolled (smallest standard die).
const ACE_STEP_DOWN: Record<DieSides, DieSides | null> = {
  20: 12, 12: 10, 10: 8, 8: 6, 6: 4, 4: null,
};

function isAce(roll: DieRoll): boolean {
  return roll.value === roll.sides;
}

function diceReducer(state: DiceState, action: DiceAction): DiceState {
  switch (action.type) {
    case 'ROLL':
      return { ...state, rolls: [...state.rolls, { id: `${Date.now()}-${Math.random()}`, sides: action.sides, value: Math.floor(Math.random() * action.sides) + 1 }] };
    case 'ROLL_SOLO':
      return { ...state, rolls: [{ id: `${Date.now()}-${Math.random()}`, sides: action.sides, value: Math.floor(Math.random() * action.sides) + 1 }] };
    case 'ACE_REROLL': {
      const parent = state.rolls.find(r => r.id === action.parentId);
      if (!parent) return state;
      const nextSides = ACE_STEP_DOWN[parent.sides];
      if (!nextSides) return state;
      // Already stepped down from this roll — don't allow a second reroll off the same parent.
      if (state.rolls.some(r => r.acedFrom === action.parentId)) return state;
      const newRoll: DieRoll = { id: `${Date.now()}-${Math.random()}`, sides: nextSides, value: Math.floor(Math.random() * nextSides) + 1, acedFrom: action.parentId };
      return { ...state, rolls: [...state.rolls, newRoll] };
    }
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

export const DiceIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="4" ry="4" />
    <circle cx="8.5"  cy="8.5"  r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="8.5"  r="1.4" fill="currentColor" stroke="none" />
    <circle cx="8.5"  cy="15.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12"   cy="12"   r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const DiceDock: React.FC = () => {
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
                    const aced = !rolling && isAce(roll);
                    const hasChild = ds.rolls.some(r => r.acedFrom === roll.id);
                    const canReroll = aced && !hasChild && ACE_STEP_DOWN[roll.sides] !== null;
                    const acedMaxed = aced && !hasChild && ACE_STEP_DOWN[roll.sides] === null;
                    return (
                      <div key={roll.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div
                          onPointerDown={() => {
                            longPressRef.current = setTimeout(() => {
                              vibe();
                              dispatchDice({ type: 'REMOVE', id: roll.id });
                            }, 500);
                          }}
                          onPointerUp={() => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } }}
                          onPointerLeave={() => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } }}
                          style={{ width: 54, height: 54, borderRadius: 13, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${aced ? '#ffd43b' : glow ? color : color + '44'}`, background: aced ? 'radial-gradient(circle at 50% 60%,#ffd43b28,#ffd43b0a)' : glow ? `radial-gradient(circle at 50% 60%,${color}28,${color}0a)` : `${color}0d`, boxShadow: aced ? '0 0 0 1px #ffd43b66,0 0 16px #ffd43b55' : glow ? `0 0 0 1px ${color}66,0 0 16px ${color}55,0 6px 20px ${color}30` : rolling ? `0 0 14px ${color}88` : '0 2px 8px rgba(0,0,0,0.35)', transition: 'box-shadow 0.25s,background 0.25s,border-color 0.25s', flexShrink: 0, userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', cursor: 'pointer', animation: rolling ? 'diceRollPulse 0.12s linear infinite' : 'none' }}>
                          <span style={{ ...labelStyle, fontSize: '1.15rem', color: aced ? '#ffd43b' : glow ? color : '#fff', lineHeight: 1 }}>{roll.value}</span>
                          <span style={{ fontSize: '0.48rem', color: aced ? '#ffd43b99' : `${color}77`, marginTop: 2, ...labelStyle }}>D{roll.sides}</span>
                        </div>
                        {canReroll && (
                          <button
                            onClick={() => { vibe(); dispatchDice({ type: 'ACE_REROLL', parentId: roll.id }); }}
                            style={{ background: 'rgba(255,212,59,0.12)', border: '1px solid rgba(255,212,59,0.4)', borderRadius: 6, color: '#ffd43b', fontSize: '0.5rem', letterSpacing: '0.06em', ...labelStyle, padding: '3px 6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            ⚡ ACE
                          </button>
                        )}
                        {acedMaxed && (
                          <span style={{ fontSize: '0.48rem', color: 'rgba(255,212,59,0.6)', ...labelStyle, letterSpacing: '0.06em' }}>ACED (MAX)</span>
                        )}
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
