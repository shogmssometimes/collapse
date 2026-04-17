import React, { useState, useEffect, useRef, useCallback } from 'react'

const COMBAT_KEY = 'combat.v1'
const QUEUE_KEY = 'combat.queue.v1'
const CHUD_STATE_KEY = 'chud.state.v1'

type QueuedAction = { id: string; action: string; ap: number; mode: 'ap' | 'reaction'; tokenCost: number }

type CombatState = {
  rangeSwapped: boolean  // false = CR:0 FR:-4, true = CR:-4 FR:0
  durability: string
  damage: string
  reactionTokens: number
  spentAp: number
  spentApOnTokens: number
  turnLocked: boolean
}

const DEFAULT: CombatState = { rangeSwapped: false, durability: 'd6', damage: 'd4', reactionTokens: 0, spentAp: 0, spentApOnTokens: 0, turnLocked: false }

/** Cost to purchase the next RT when you already own `owned` tokens: 2^owned */
function nextTokenCost(owned: number): number {
  return Math.pow(2, owned)
}
/** Total AP already spent on `owned` tokens: 2^owned - 1 */
function totalTokenCost(owned: number): number {
  return owned === 0 ? 0 : Math.pow(2, owned) - 1
}

function loadCombat(): CombatState {
  try {
    const raw = localStorage.getItem(COMBAT_KEY)
    if (!raw) return { ...DEFAULT }
    const p = JSON.parse(raw)
    return {
      rangeSwapped: typeof p.rangeSwapped === 'boolean' ? p.rangeSwapped : false,
      durability: typeof p.durability === 'string' && p.durability ? p.durability : 'd6',
      damage: typeof p.damage === 'string' && p.damage ? p.damage : 'd4',
      reactionTokens: typeof p.reactionTokens === 'number' ? p.reactionTokens : 0,
      spentAp: typeof p.spentAp === 'number' ? p.spentAp : 0,
      spentApOnTokens: typeof p.spentApOnTokens === 'number' ? p.spentApOnTokens : 0,
      turnLocked: typeof p.turnLocked === 'boolean' ? p.turnLocked : false,
    }
  } catch { return { ...DEFAULT } }
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.68rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  fontFamily: 'var(--font-display)',
  minWidth: 90,
  flexShrink: 0,
}

const INPUT_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 4,
  padding: '6px 10px',
  color: 'inherit',
  fontSize: '0.88rem',
  flex: '1 1 0',
  minWidth: 0,
  minHeight: 36,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  userSelect: 'text',
  WebkitUserSelect: 'text',
  touchAction: 'auto',
  caretColor: 'auto',
  pointerEvents: 'auto',
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 14px',
  borderRadius: 7,
  border: '1px solid rgba(255,255,255,0.07)',
  background: 'rgba(255,255,255,0.02)',
}

const DICE_ORDER = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']

function cycleDie(current: string): string {
  const idx = DICE_ORDER.indexOf(current)
  return DICE_ORDER[(idx + 1) % DICE_ORDER.length]
}

/** Tappable rounded square that cycles through dice on each click */
function DiceIcon({ die, onCycle }: { die: string; onCycle?: () => void }) {
  const label = die.toUpperCase()
  return (
    <button
      onClick={onCycle}
      aria-label={`Current: ${die}. Tap to cycle.`}
      style={{
        width: 'clamp(48px, 13vw, 72px)',
        height: 'clamp(48px, 13vw, 72px)',
        borderRadius: 'clamp(8px, 2.3vw, 13px)',
        background: 'rgba(15,246,255,0.08)',
        border: '1.5px solid rgba(15,246,255,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxSizing: 'border-box',
        cursor: onCycle ? 'pointer' : 'default',
        padding: 0,
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{
        fontSize: 'clamp(16px, 4.7vw, 26px)',
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        color: 'rgba(15,246,255,0.92)',
        letterSpacing: '0.04em',
        lineHeight: 1,
        userSelect: 'none',
        pointerEvents: 'none',
      }}>{label}</span>
    </button>
  )
}


/** Parse the token cost out of a reaction string like "2 Tokens" or "1 Token" */
function tokenCostFromReaction(reaction: string): number {
  const m = reaction.match(/^(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

const ACTION_DATA: { action: string; ap: number; reaction: string; onTurnDesc: string; reactionDesc: string }[] = [
  { action: 'Zone Movement',        ap: 1, reaction: '2 Tokens',
    onTurnDesc: 'Move from your current Zone to an Adjacent Zone.',
    reactionDesc: 'Move from your current Zone to an Adjacent Zone (this can cancel Attacks).' },
  { action: 'Change Movement Type', ap: 1, reaction: '1 Token',
    onTurnDesc: 'Shift from Standard / Hidden / Reckless Movement.',
    reactionDesc: 'Maintain your Movement Type.' },
  { action: 'Flank',                ap: 1, reaction: '1 Token',
    onTurnDesc: 'Shift within your Zone to gain a +2 to your Strike Action.',
    reactionDesc: 'Shift within your Zone to gain +2 against a Strike.' },
  { action: 'Draw 1 Engram',        ap: 1, reaction: '1 Token',
    onTurnDesc: 'Draw 1 Engram from your Deck to your Hand.',
    reactionDesc: 'Draw 1 Engram from your Deck to your Hand.' },
  { action: 'Use 1 Piece of Gear',  ap: 1, reaction: '1 Token',
    onTurnDesc: 'Consume a piece of gear from your inventory.',
    reactionDesc: 'Consume a piece of gear from your inventory.' },
  { action: 'Discard 1 Engram',     ap: 1, reaction: '1 Token',
    onTurnDesc: 'Discard 1 Engram from your Hand to Null Space.',
    reactionDesc: 'Discard 1 Engram from your Hand to Null Space.' },
  { action: 'Transfer Gear',        ap: 1, reaction: '1 Token',
    onTurnDesc: 'Transfer a piece of gear from your inventory to a Friendly in your Zone.',
    reactionDesc: 'Transfer a piece of gear from your inventory to a Friendly in your Zone.' },
  { action: 'Resync Chip',          ap: 1, reaction: '1 Token',
    onTurnDesc: 'Resync a Desynced Chip (Durability Roll still required at end of Combat).',
    reactionDesc: 'Resync a Desynced Chip (Durability Roll still required at end of Combat).' },
  { action: 'Perception Check',     ap: 1, reaction: '1 Token',
    onTurnDesc: 'Make a Perception Check.',
    reactionDesc: 'Make a Perception Check.' },
  { action: 'Overload',             ap: 1, reaction: '1 Token',
    onTurnDesc: 'When you Hit, add 1d4 Damage Dice to total. Roll Chip Durability after this action.',
    reactionDesc: 'When you are Hit, reduce 1d4 Damage Dice from total. Roll Chip Durability after this action.' },
  { action: 'Feint',                ap: 1, reaction: '1 Token',
    onTurnDesc: 'When you successfully hit, you carry Flanked status against that target into your next turn.',
    reactionDesc: 'When an attacker misses you, you gain Flanked status against that attacker until your next turn.' },
  { action: 'Tank',                 ap: 2, reaction: '2 Tokens',
    onTurnDesc: 'Reduce Damage received by Half for 1d4 Strikes.',
    reactionDesc: 'When you are Hit, reduce Damage received by Half.' },
  { action: 'Strike',               ap: 2, reaction: '2 Tokens',
    onTurnDesc: 'AO Roll to Strike your Target.',
    reactionDesc: 'Hold an AO Roll to Strike your Target.' },
  { action: 'Roleplay Action',      ap: 2, reaction: '2 Tokens',
    onTurnDesc: 'AO Roll to use a Roleplay Action.',
    reactionDesc: 'Hold an AO Roll to use a Roleplay Action.' },
]

/** A queued action chip — long-press 2s to remove (disabled when locked) */
function QueueChip({ item, onRemove, locked }: { item: QueuedAction; onRemove: () => void; locked: boolean }) {
  const [holdProgress, setHoldProgress] = useState(0)
  const [releasing, setReleasing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const HOLD_MS = 1000

  const cancelHold = (fired = false) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (!fired && holdProgress > 0) {
      setReleasing(true)
      releaseTimerRef.current = setTimeout(() => setReleasing(false), 400)
    }
    setHoldProgress(0)
  }

  const start = (e: React.PointerEvent) => {
    if (locked) return
    e.preventDefault()
    const startTime = Date.now()
    intervalRef.current = setInterval(() => {
      setHoldProgress(Math.min(((Date.now() - startTime) / HOLD_MS) * 100, 100))
    }, 30)
    timerRef.current = setTimeout(() => {
      cancelHold(true)
      onRemove()
    }, HOLD_MS)
  }

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current)
  }, [])

  const isReaction = item.mode === 'reaction'
  const baseColor = isReaction ? '255,200,60' : '15,246,255'
  const glow = holdProgress / 100
  const borderColor = holdProgress > 0
    ? `rgba(255,60,60,${0.3 + 0.7 * glow})`
    : releasing
      ? `rgba(${baseColor},0.9)`
      : `rgba(${baseColor},0.45)`
  const boxShadow = holdProgress > 0
    ? `0 0 ${6 + 20 * glow}px rgba(255,60,60,${0.2 + 0.6 * glow})`
    : releasing
      ? `0 0 8px rgba(${baseColor},0.4)`
      : 'none'
  const bg = holdProgress > 0
    ? `rgba(255,60,60,${0.05 + 0.2 * glow})`
    : releasing
      ? `rgba(${baseColor},0.28)`
      : `rgba(${baseColor},0.08)`

  return (
    <div
      onPointerDown={start}
      onPointerUp={() => cancelHold()}
      onPointerLeave={() => cancelHold()}
      onPointerCancel={() => cancelHold()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 9px',
        borderRadius: 6,
        background: bg,
        border: `1.5px solid ${borderColor}`,
        boxShadow,
        cursor: locked ? 'default' : 'pointer',
        userSelect: 'none',
        touchAction: 'none',
        transition: holdProgress > 0 ? 'none' : 'background 0.35s, border-color 0.35s, box-shadow 0.35s',
        WebkitTapHighlightColor: 'transparent',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: '1rem', color: 'var(--text)', lineHeight: 1.3 }}>{item.action}</span>
      <span style={{
        fontSize: '0.8rem',
        color: isReaction ? 'rgba(255,200,60,0.85)' : 'rgba(15,246,255,0.75)',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        lineHeight: 1,
      }}>{isReaction ? <>{item.tokenCost}<span style={{ fontSize: '0.65rem', marginLeft: 1, opacity: 0.8 }}>T</span></> : `${item.ap}AP`}</span>
    </div>
  )
}

/** A single range column: label on top, value on bottom */
/** A single reaction token pip. Long-press 2s on the last one to refund (when not locked). */
function TokenPip({ isLast, canRefund, onRefund, size = 18 }: { isLast: boolean; canRefund: boolean; onRefund: () => void; size?: number }) {
  const [holdProgress, setHoldProgress] = useState(0)
  const [releasing, setReleasing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const HOLD_MS = 1000

  const cancelHold = (fired = false) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (!fired && holdProgress > 0) {
      setReleasing(true)
      releaseTimerRef.current = setTimeout(() => setReleasing(false), 400)
    }
    setHoldProgress(0)
  }

  const start = (e: React.PointerEvent) => {
    if (!canRefund || !isLast) return
    e.preventDefault()
    const startTime = Date.now()
    intervalRef.current = setInterval(() => {
      setHoldProgress(Math.min(((Date.now() - startTime) / HOLD_MS) * 100, 100))
    }, 30)
    timerRef.current = setTimeout(() => {
      cancelHold(true)
      onRefund()
    }, HOLD_MS)
  }

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current)
  }, [])

  const glow = holdProgress / 100
  const bg = holdProgress > 0
    ? `rgba(255,60,60,${0.4 + 0.4 * glow})`
    : 'rgba(255,200,60,0.75)'
  const border = holdProgress > 0
    ? `rgba(255,60,60,${0.6 + 0.4 * glow})`
    : releasing
      ? 'rgba(255,200,60,1)'
      : 'rgba(255,200,60,1)'
  const shadow = holdProgress > 0
    ? `0 0 ${6 + 18 * glow}px rgba(255,60,60,${0.25 + 0.6 * glow})`
    : releasing
      ? '0 0 10px rgba(255,200,60,0.8)'
      : 'none'

  return (
    <div
      onPointerDown={start}
      onPointerUp={() => cancelHold()}
      onPointerLeave={() => cancelHold()}
      onPointerCancel={() => cancelHold()}
      title={isLast && canRefund ? 'Hold to refund token' : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        border: `1.5px solid ${border}`,
        boxShadow: shadow,
        cursor: isLast && canRefund ? 'pointer' : 'default',
        touchAction: 'none',
        transition: holdProgress > 0 ? 'none' : 'background 0.35s, border-color 0.35s, box-shadow 0.35s',
        flexShrink: 0,
      }}
    />
  )
}

function RangeCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 2,
      flex: '1 1 0',
    }}>
      <span style={{
        fontSize: '0.65rem',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        fontFamily: 'var(--font-display)',
        lineHeight: 1,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 'clamp(1.6rem, 10vw, 3.8rem)',
        fontWeight: 700,
        fontFamily: 'var(--font-display)',
        color: 'var(--accent)',
        lineHeight: 1,
        letterSpacing: '0.04em',
      }}>
        {value}
      </span>
    </div>
  )
}

export default function CombatPage() {
  const [combat, setCombat] = useState<CombatState>(loadCombat)
  const [queue, setQueue] = useState<QueuedAction[]>(() => {
    try { const r = localStorage.getItem(QUEUE_KEY); return r ? JSON.parse(r) : [] } catch { return [] }
  })
  const [maxAp, setMaxAp] = useState<number>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(CHUD_STATE_KEY) || '{}')
      return typeof s.ap === 'number' ? s.ap : 4
    } catch { return 4 }
  })
  const [freeActionsOpen, setFreeActionsOpen] = useState(false)
  const [detailModal, setDetailModal] = useState<{ title: string; desc: string } | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdFiredRef = useRef(false)

  const startCellHold = (title: string, desc: string) => (e: React.PointerEvent) => {
    e.preventDefault()
    holdFiredRef.current = false
    holdTimerRef.current = setTimeout(() => {
      holdFiredRef.current = true
      holdTimerRef.current = null
      setDetailModal({ title, desc })
    }, 1000)
  }
  const endCellHold = (tapAction: () => void) => () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
      if (!holdFiredRef.current) tapAction()
    }
  }
  const cancelCellHold = () => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null }
  }

  useEffect(() => {
    const json = JSON.stringify(combat)
    localStorage.setItem(COMBAT_KEY, json)
    window.dispatchEvent(new StorageEvent('storage', { key: COMBAT_KEY, newValue: json, storageArea: localStorage }))
  }, [combat])

  useEffect(() => {
    const json = JSON.stringify(queue)
    localStorage.setItem(QUEUE_KEY, json)
    window.dispatchEvent(new StorageEvent('storage', { key: QUEUE_KEY, newValue: json, storageArea: localStorage }))
  }, [queue])

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== CHUD_STATE_KEY || !e.newValue) return
      try {
        const s = JSON.parse(e.newValue)
        if (typeof s.ap === 'number') setMaxAp(s.ap)
      } catch {}
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const addToQueue = useCallback((action: string, ap: number) => {
    if (combat.turnLocked) return
    if (combat.spentAp + combat.spentApOnTokens + ap > maxAp) return
    setCombat(prev => ({ ...prev, spentAp: prev.spentAp + ap }))
    setQueue(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, action, ap, mode: 'ap' as const, tokenCost: 0 }])
  }, [maxAp, combat.spentAp, combat.spentApOnTokens, combat.turnLocked])

  const addReaction = useCallback((action: string, tokenCost: number) => {
    if (combat.reactionTokens < tokenCost) return
    setCombat(prev => ({ ...prev, reactionTokens: prev.reactionTokens - tokenCost }))
    setQueue(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, action, ap: 0, mode: 'reaction' as const, tokenCost }])
  }, [combat.reactionTokens, combat.turnLocked])

  const removeFromQueue = useCallback((id: string) => {
    if (combat.turnLocked) return
    setQueue(prev => {
      const item = prev.find(a => a.id === id)
      if (!item) return prev
      if (item.mode === 'ap') {
        setCombat(c => ({ ...c, spentAp: Math.max(0, c.spentAp - item.ap) }))
      } else {
        // restore tokens only — AP was spent when buying tokens, not when using them
        setCombat(c => ({ ...c, reactionTokens: c.reactionTokens + item.tokenCost }))
      }
      return prev.filter(a => a.id !== id)
    })
  }, [combat.turnLocked])

  const apUsedByQueue = combat.spentAp
  const apUsedByTokens = combat.spentApOnTokens
  const apUsed = apUsedByQueue + apUsedByTokens
  const apRemaining = maxAp - apUsed
  const actionsFull = apRemaining <= 0
  const nextRtCost = nextTokenCost(combat.reactionTokens)
  const canBuyToken = apRemaining >= nextRtCost

  const crValue = combat.rangeSwapped ? '−4' : '0'
  const frValue = combat.rangeSwapped ? '0' : '−4'

  return (
    <>
    <div className="page" style={{ maxWidth: 680, margin: '0 auto', padding: '1.25rem 1rem 2rem' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px 0' }}>Combat</h1>
        <p className="muted" style={{ margin: 0 }}>
          Combat tools and tracking.
        </p>
      </div>

      {/* Range / Durability / Damage — 3-up horizontal cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 0.9fr', gap: 8 }}>

        {/* Range — tap to swap */}
        <div
          onClick={() => setCombat(prev => ({ ...prev, rangeSwapped: !prev.rangeSwapped }))}
          style={{ ...ROW_STYLE, flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer', WebkitTapHighlightColor: 'transparent', userSelect: 'none' }}
        >
          <span style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'var(--font-display)' }}>Range</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <RangeCell label="CR" value={crValue} />
            <span style={{ fontSize: '1rem', color: 'var(--muted)', opacity: 0.5 }}>⇄</span>
            <RangeCell label="FR" value={frValue} />
          </div>
        </div>

        {/* Durability */}
        <div style={{ ...ROW_STYLE, flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'var(--font-display)' }}>Durability</span>
          <DiceIcon
            die={combat.durability}
            onCycle={() => setCombat(prev => ({ ...prev, durability: cycleDie(prev.durability) }))}
          />
        </div>

        {/* Damage */}
        <div style={{ ...ROW_STYLE, flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'var(--font-display)' }}>Damage</span>
          <DiceIcon
            die={combat.damage}
            onCycle={() => setCombat(prev => ({ ...prev, damage: cycleDie(prev.damage) }))}
          />
        </div>

      </div>

      {/* Action Menu */}
      <h2 style={{
        fontSize: '0.72rem',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        fontFamily: 'var(--font-display)',
        margin: '28px 0 10px',
        fontWeight: 400,
      }}>Queue</h2>

      {/* Queue */}
      {queue.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginBottom: 8,
          padding: '8px 12px',
          borderRadius: 7,
          border: '1px solid rgba(15,246,255,0.15)',
          background: 'rgba(15,246,255,0.03)',
        }}>
          {queue.map(item => (
            <QueueChip key={item.id} item={item} onRemove={() => removeFromQueue(item.id)} locked={combat.turnLocked} />
          ))}
        </div>
      )}

      {/* Manager */}
      <h2 style={{
        fontSize: '0.72rem',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        fontFamily: 'var(--font-display)',
        margin: '18px 0 10px',
        fontWeight: 400,
      }}>Manager</h2>

      {/* AP card */}
      <div style={{ ...ROW_STYLE, flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={LABEL_STYLE}>Action Points</span>
        <div style={{ display: 'flex', gap: 7 }}>
          {Array.from({ length: maxAp }, (_, i) => {
            const spent = i < apUsed
            return (
              <div key={i} style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: spent ? 'rgba(15,246,255,0.15)' : 'rgba(15,246,255,0.75)',
                border: `1.5px solid ${spent ? 'rgba(15,246,255,0.2)' : 'rgba(15,246,255,0.9)'}`,
                transition: 'background 0.15s',
              }} />
            )
          })}
        </div>
        <span style={{
          fontSize: '1.05rem',
          color: actionsFull ? 'rgba(255,100,100,0.9)' : 'var(--muted)',
          fontFamily: 'var(--font-display)',
          fontWeight: actionsFull ? 600 : 400,
        }}>
          {actionsFull ? 'Actions Full' : `${apRemaining} remaining`}
        </span>
      </div>

      {/* Token card */}
      <div style={{ ...ROW_STYLE, flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={LABEL_STYLE}>Reaction Token</span>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          {combat.reactionTokens === 0
            ? <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic' }}>none</span>
            : Array.from({ length: combat.reactionTokens }, (_, i) => (
              <TokenPip
                key={i}
                size={26}
                isLast={i === combat.reactionTokens - 1}
                canRefund={!combat.turnLocked}
                onRefund={() => setCombat(prev => ({
                  ...prev,
                  reactionTokens: prev.reactionTokens - 1,
                  spentApOnTokens: Math.max(0, prev.spentApOnTokens - nextTokenCost(prev.reactionTokens - 1)),
                }))}
              />
            ))
          }
        </div>
        <button
          disabled={!canBuyToken}
          onClick={() => setCombat(prev => ({
            ...prev,
            reactionTokens: prev.reactionTokens + 1,
            spentApOnTokens: prev.spentApOnTokens + nextRtCost,
          }))}
          title={canBuyToken ? `Spend ${nextRtCost}AP for 1 Token` : `Need ${nextRtCost}AP`}
          style={{
            background: canBuyToken ? 'rgba(255,200,60,0.1)' : 'transparent',
            border: `1px solid ${canBuyToken ? 'rgba(255,200,60,0.6)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 6,
            color: canBuyToken ? 'rgba(255,200,60,0.95)' : 'rgba(255,255,255,0.2)',
            fontSize: '0.82rem',
            fontFamily: 'var(--font-display)',
            padding: '6px 14px',
            cursor: canBuyToken ? 'pointer' : 'not-allowed',
            letterSpacing: '0.06em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          + Buy Token
          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{nextRtCost}AP</span>
        </button>
      </div>

      {/* Lock Turn / New Turn card */}
      {(queue.length > 0 || combat.reactionTokens > 0 || combat.spentAp > 0) && (
        <div style={{ marginBottom: 8 }}>
          {!combat.turnLocked && (
            <button
              onClick={() => setCombat(prev => ({ ...prev, turnLocked: true }))}
              style={{
                background: 'rgba(255,200,60,0.08)',
                border: '1.5px solid rgba(255,200,60,0.45)',
                borderRadius: 8,
                color: 'rgba(255,200,60,0.9)',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '10px 16px',
                cursor: 'pointer',
                width: '100%',
              }}
            >Lock Turn</button>
          )}
          {combat.turnLocked && (
            <button
              onClick={() => {
                setQueue([])
                setCombat(prev => ({ ...prev, reactionTokens: 0, spentAp: 0, spentApOnTokens: 0, turnLocked: false }))
              }}
              style={{
                background: 'rgba(15,246,255,0.08)',
                border: '1.5px solid rgba(15,246,255,0.45)',
                borderRadius: 8,
                color: 'rgba(15,246,255,0.9)',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '10px 16px',
                cursor: 'pointer',
                width: '100%',
              }}
            >New Turn</button>
          )}
        </div>
      )}

      {/* Tappable action table */}
      <h2 style={{
        fontSize: '0.72rem',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        fontFamily: 'var(--font-display)',
        margin: '18px 0 10px',
        fontWeight: 400,
      }}>Menu</h2>
      <div style={{
        borderRadius: 7,
        border: '1px solid rgba(255,255,255,0.07)',
        overflow: 'hidden',
      }}>
        {/* Free Actions accordion row */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div
            onClick={() => setFreeActionsOpen(o => !o)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              padding: '9px 12px',
              cursor: 'pointer',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontStyle: 'italic' }}>Free Actions</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)', textAlign: 'center', minWidth: 76 }}>—</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center', minWidth: 76, opacity: 0.6 }}>{freeActionsOpen ? '▲' : '▼'}</span>
          </div>
          {freeActionsOpen && (
            <div style={{ padding: '6px 12px 10px 16px', display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(255,255,255,0.01)' }}>
              {['Speak Briefly', 'Simple Gestures', 'Conduct a Save Roll', 'Conduct a Break Roll'].map(a => (
                <span key={a} style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{a}</span>
              ))}
            </div>
          )}
        </div>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto',
          background: 'rgba(255,255,255,0.04)',
          padding: '6px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          {(['Action', 'On Turn', 'As Reaction'] as const).map(h => (
            <span key={h} style={{
              fontSize: '0.62rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              fontFamily: 'var(--font-display)',
              textAlign: h === 'Action' ? 'left' : 'center',
              minWidth: h === 'Action' ? undefined : 76,
            }}>{h}</span>
          ))}
        </div>
        {ACTION_DATA.map((row, i) => {
          const canAdd = !combat.turnLocked && apRemaining >= row.ap
          const reactionCost = tokenCostFromReaction(row.reaction)
          const canReact = reactionCost > 0 && combat.reactionTokens >= reactionCost
          return (
            <div
              key={row.action}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                userSelect: 'none',
              }}
            >
              {/* Action name — tap to queue, long-press for description */}
              <div
                onPointerDown={startCellHold(`${row.action} — On Turn`, row.onTurnDesc)}
                onPointerUp={endCellHold(() => addToQueue(row.action, row.ap))}
                onPointerLeave={cancelCellHold}
                onPointerCancel={cancelCellHold}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '9px 12px',
                  cursor: canAdd ? 'pointer' : 'default',
                  opacity: canAdd ? 1 : 0.35,
                  transition: 'opacity 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: '0.85rem', color: 'var(--text)', flex: 1 }}>{row.action}</span>
                <span style={{
                  fontSize: '0.82rem',
                  color: 'var(--accent)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  textAlign: 'center',
                  minWidth: 76,
                }}>{row.ap}AP</span>
              </div>
              {/* As Reaction — tap to react, long-press for description */}
              <div
                onPointerDown={startCellHold(`${row.action} — As Reaction`, row.reactionDesc)}
                onPointerUp={endCellHold(() => canReact && addReaction(row.action, reactionCost))}
                onPointerLeave={cancelCellHold}
                onPointerCancel={cancelCellHold}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '9px 12px',
                  minWidth: 76,
                  cursor: canReact ? 'pointer' : 'default',
                  opacity: canReact ? 1 : 0.25,
                  transition: 'opacity 0.15s, background 0.15s',
                  background: canReact ? 'rgba(255,200,60,0.05)' : 'transparent',
                  borderLeft: `1px solid ${ canReact ? 'rgba(255,200,60,0.18)' : 'rgba(255,255,255,0.04)'}`,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{
                  fontSize: '0.82rem',
                  color: canReact ? 'rgba(255,200,60,0.95)' : 'var(--muted)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  textAlign: 'center',
                  letterSpacing: '0.03em',
                }}>{reactionCost}<span style={{ fontSize: '0.62rem', marginLeft: 1, opacity: 0.8 }}>T</span></span>
              </div>
            </div>
          )
        })}
      </div>
    </div>

    {/* Detail modal */}
    {detailModal && (
      <div
        onPointerDown={() => setDetailModal(null)}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.72)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          onPointerDown={e => e.stopPropagation()}
          style={{
            background: '#1a1c1f',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: '22px 24px',
            maxWidth: 340,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <span style={{
            fontSize: '0.65rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            fontFamily: 'var(--font-display)',
          }}>{detailModal.title}</span>
          <p style={{
            fontSize: '0.95rem',
            color: 'var(--text)',
            lineHeight: 1.55,
            margin: 0,
          }}>{detailModal.desc}</p>
          <button
            onPointerDown={() => setDetailModal(null)}
            style={{
              alignSelf: 'flex-end',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 6,
              color: 'var(--muted)',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '5px 14px',
              cursor: 'pointer',
            }}
          >Dismiss</button>
        </div>
      </div>
    )}
    </>
  )
}
