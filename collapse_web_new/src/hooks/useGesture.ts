import { useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";

// Stable gesture hook — returns event handler objects whose callbacks always
// reflect the latest onIncr/onDecr without recreating the handlers on each
// render. Tap = increment, 500ms hold or right-click = decrement.
export function useGesture(onIncr: () => void, onDecr: () => void) {
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
      onPointerDown(e: ReactPointerEvent) {
        if (e.button === 2) return;
        b.didLong = false;
        clear();
        b.timer = setTimeout(() => {
          b.didLong = true;
          decrRef.current();
        }, 500);
      },
      onPointerUp(e: ReactPointerEvent) {
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
      onClick(e: ReactMouseEvent) {
        e.preventDefault();
        if (b.didLong) {
          b.didLong = false;
          return;
        }
        incrRef.current();
      },
      onContextMenu(e: ReactMouseEvent) {
        e.preventDefault();
        clear();
        b.didLong = false;
        decrRef.current();
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable by design — callbacks routed through mutable refs
}
