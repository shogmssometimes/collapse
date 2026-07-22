import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";
import { vibrate } from "../utils/vibrate";

// Tap = callback immediately. Hold ~260 ms = callback. Moved finger = cancel.
export function useSemiLongPress(callback: () => void) {
  const state = useRef({
    timer: null as number | null,
    moved: false,
    fired: false,
    startX: 0,
    startY: 0,
    ignoreClick: false,
  });

  const cancel = useCallback(() => {
    if (state.current.timer) {
      clearTimeout(state.current.timer);
      state.current.timer = null;
    }
    state.current.moved = false;
    state.current.fired = false;
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.pointerType && e.pointerType !== 'touch' && e.pointerType !== 'mouse') return;
      state.current.startX = e.clientX;
      state.current.startY = e.clientY;
      state.current.moved = false;
      state.current.fired = false;
      if (e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      cancel();
      state.current.timer = window.setTimeout(() => {
        state.current.fired = true;
        callback();
        vibrate(10);
        state.current.timer = null;
      }, 260);
    },
    [callback, cancel]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!state.current.timer) return;
      if (
        Math.abs(e.clientX - state.current.startX) > 10 ||
        Math.abs(e.clientY - state.current.startY) > 10
      ) {
        state.current.moved = true;
        cancel();
      }
    },
    [cancel]
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (state.current.timer) {
        clearTimeout(state.current.timer);
        state.current.timer = null;
        if (!state.current.moved && !state.current.fired) {
          callback();
          vibrate(10);
          state.current.ignoreClick = true;
        }
      }
      state.current.fired = false;
    },
    [callback]
  );

  const onClick = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      if (state.current.ignoreClick) {
        state.current.ignoreClick = false;
        e.preventDefault();
        return;
      }
      callback();
    },
    [callback]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: cancel,
    onClick,
  };
}
