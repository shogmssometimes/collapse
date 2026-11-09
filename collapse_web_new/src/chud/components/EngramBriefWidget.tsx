import { useRef, useState } from "react";
import { engramCatalogById } from "../../data/handbook/engramCatalog";
import { readEngramState, spendEngramCharges, type EngramManagerState } from "../../utils/engramState";

// Swipeable Engram summary widget — mirrors GearBriefWidget's layout and
// gesture (swipe to cycle, long-press 2s to spend one charge of the active
// Engram), but reads from the Engram Manager's equipped/charges state
// instead of the Gear inventory.
export function EngramBriefWidget({
  state,
  storageKey,
}: {
  state: EngramManagerState;
  storageKey: string;
}) {
  const [idx, setIdx] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0); // 0–100
  const [flashOut, setFlashOut] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHolding = useRef(false);
  const holdFired = useRef(false);
  const HOLD_MS = 1000;

  // only show equipped Engrams with charges remaining
  const activeEntries = Object.entries(state.equipped)
    .filter(([, e]) => e.charges > 0)
    .map(([id, e]) => ({ id, ...e, name: engramCatalogById[id]?.name ?? id }));
  const activeCount = activeEntries.length;

  const safeIdx = activeCount > 0 ? idx % activeCount : 0;

  const prev = () => setIdx(i => (activeCount > 0 ? (i - 1 + activeCount) % activeCount : 0));
  const next = () => setIdx(i => (activeCount > 0 ? (i + 1) % activeCount : 0));

  const entry = activeCount > 0 ? (activeEntries[safeIdx] ?? null) : null;
  const nameText = entry?.name.trim() || '—';
  const chargesText = entry ? String(entry.charges) : '0';
  const hasContent = !!entry;

  const canUse = entry !== null && entry.charges > 0;

  const cancelHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (holdInterval.current) { clearInterval(holdInterval.current); holdInterval.current = null; }
    isHolding.current = false;
    setHoldProgress(0);
  };

  const startHold = () => {
    if (!canUse || !entry) return;
    isHolding.current = true;
    const start = Date.now();
    holdInterval.current = setInterval(() => {
      setHoldProgress(Math.min(((Date.now() - start) / HOLD_MS) * 100, 100));
    }, 30);
    holdTimer.current = setTimeout(() => {
      holdFired.current = true;
      cancelHold();
      spendEngramCharges(storageKey, entry.id, 1);
      setFlashOut(true);
      setTimeout(() => setFlashOut(false), 600);
    }, HOLD_MS);
  };

  // border/shadow driven by hold progress — same accent as Gear's widget,
  // so the two queues read as a matched pair.
  const holdGlow = holdProgress / 100;
  const accentR = 15; const accentG = 246; const accentB = 255;
  const borderColor = holdProgress > 0
    ? `rgba(${accentR},${accentG},${accentB},${0.15 + 0.85 * holdGlow})`
    : 'rgba(255,255,255,0.1)';
  const boxShadow = holdProgress > 0
    ? `0 0 ${8 + 24 * holdGlow}px rgba(${accentR},${accentG},${accentB},${0.15 + 0.55 * holdGlow})`
    : flashOut
    ? `0 0 28px rgba(${accentR},${accentG},${accentB},0.6)`
    : 'none';

  if (activeCount === 0) {
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
          Engrams
        </span>
        <span
          style={{
            fontStyle: "italic",
            color: "rgba(248,250,252,0.25)",
            fontSize: "0.78rem",
            textAlign: "center",
          }}
        >
          no charges
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: '7 1 0',
        background: 'rgba(8,13,23,0.92)',
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
          color: 'var(--muted, #9aa0a6)',
          textAlign: 'center',
        }}
      >
        Engrams
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
            ×{chargesText}
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
