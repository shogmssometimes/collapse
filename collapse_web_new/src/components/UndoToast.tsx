import React, { useCallback, useRef, useState } from 'react';

// Shared "soft delete" pattern for single-value destructive actions: perform the
// action immediately (no blocking confirm dialog), but surface a brief toast
// with an Undo button that reverses it within a short window.
const UNDO_WINDOW_MS = 8000;

interface PendingUndo {
  id: number;
  label: string;
  undo: () => void;
}

export function useUndoToast() {
  const [pending, setPending] = useState<PendingUndo | null>(null);
  const timerRef = useRef<number | null>(null);
  const idRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showUndo = useCallback((label: string, undo: () => void) => {
    clearTimer();
    const id = ++idRef.current;
    setPending({ id, label, undo });
    timerRef.current = window.setTimeout(() => {
      setPending((p) => (p && p.id === id ? null : p));
    }, UNDO_WINDOW_MS);
  }, [clearTimer]);

  const handleUndo = useCallback(() => {
    setPending((p) => {
      if (p) p.undo();
      return null;
    });
    clearTimer();
  }, [clearTimer]);

  const dismiss = useCallback(() => {
    clearTimer();
    setPending(null);
  }, [clearTimer]);

  const toast = pending ? (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: '1.5rem',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(10,14,18,0.95)',
        border: '1px solid rgba(15,246,255,0.35)',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
        fontFamily: 'Courier Prime, Courier New, monospace',
        fontSize: '0.8rem',
        color: 'rgba(255,255,255,0.85)',
      }}
    >
      <span>{pending.label}</span>
      <button
        type="button"
        onClick={handleUndo}
        style={{
          background: 'rgba(15,246,255,0.12)',
          border: '1px solid rgba(15,246,255,0.5)',
          borderRadius: 6,
          color: '#0ff6ff',
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          padding: '5px 10px',
          cursor: 'pointer',
        }}
      >
        UNDO
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px' }}
      >
        ×
      </button>
    </div>
  ) : null;

  return { toast, showUndo };
}
