import { useRef, useState } from "react";
import type { GearSlotEntry } from "../../types/chud";

// Swipeable inventory summary widget. Long-press (2s) consumes one unit of
// the active entry and writes the decrement back to the gear slots storage.
export function GearBriefWidget({
  entries,
  count,
  isOverEncumbered,
  gearSlotsKey,
}: {
  entries: GearSlotEntry[];
  count: number;
  isOverEncumbered: boolean;
  gearSlotsKey: string;
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
        const raw = window.localStorage.getItem(gearSlotsKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const arr: GearSlotEntry[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.entries) ? parsed.entries : []);
          const slotsUsed: number = typeof parsed?.slotsUsed === 'number' ? parsed.slotsUsed : 0;
          const updated = arr.map((e, i) => {
            if (i !== entryOriginalIdx) return e;
            const q = parseFloat(e.qty);
            return { ...e, qty: String(isNaN(q) || q <= 0 ? 0 : q - 1) };
          });
          window.localStorage.setItem(gearSlotsKey, JSON.stringify({ entries: updated, slotsUsed }));
          // trigger storage event for Gear page
          window.dispatchEvent(new StorageEvent('storage', { key: gearSlotsKey, newValue: JSON.stringify({ entries: updated, slotsUsed }), storageArea: window.localStorage }));
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

  if (count === 0 || activeCount === 0) {
    return (
      <div
        style={{
          flex: "7 1 0",
          background: "rgba(8,13,23,0.92)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 8,
          padding: "8px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 0,
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <span
          style={{
            fontSize: "0.58rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--muted, #9aa0a6)",
            textAlign: "center",
          }}
        >
          In Brief
        </span>
        <span
          style={{
            fontStyle: "italic",
            color: "rgba(248,250,252,0.25)",
            fontSize: "0.78rem",
            textAlign: "center",
          }}
        >
          no inventory
        </span>
      </div>
    );
  }

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
          {safeIdx + 1} / {activeCount}
        </span>
      </div>
    </div>
  );
}
