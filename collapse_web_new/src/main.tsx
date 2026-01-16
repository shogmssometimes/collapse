import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/variables.css';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Avoid service worker interference during development; only register in production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swPath).catch((error) => {
      console.error('Service worker registration failed', error);
    });
  });
}

// Debug: add 'debug-overflow' class to documentElement when ?debug=overflow is present
if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('debug') === 'overflow') {
      document.documentElement.classList.add('debug-overflow')
    }
  } catch (e) {
    // ignore
  }
}

// If running on a touch device, disable text selection globally (can be narrowed to components if desired)
// Add no-select class to root on touch devices to prioritize taps
if (typeof window !== 'undefined' && 'ontouchstart' in window) {
  document.getElementById('root')?.classList.add('no-select');

  // Track recent touch to distinguish touch-triggered contextmenu (long-press) from mouse right-click
  let lastTouch = 0;
  document.addEventListener('touchstart', () => { lastTouch = Date.now(); }, { passive: true });

  // Prevent the contextmenu (long-press menu) when it was triggered by a recent touch
  document.addEventListener('contextmenu', (e) => {
    if (Date.now() - lastTouch < 1000) {
      e.preventDefault();
    }
  }, { passive: false });

  // Proactive long-press handling: clear selection if a touch is held down for ~450ms
  let holdTimer: number | null = null;
  document.addEventListener('touchstart', (e) => {
    // ignore if inside a selectable area
    const el = (e.target instanceof Element) ? e.target as Element : null;
    if (el && el.closest && el.closest('.selectable')) return;
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    holdTimer = window.setTimeout(() => {
      // Clear selection and prevent any menu from showing
      clearSelectionUnlessSelectable();
    }, 450);
  }, { passive: true });
  document.addEventListener('touchend', () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } }, { passive: true });
}

// Clear any text selection unless the selection is inside an element with `.selectable`.
// This complements the CSS rule and ensures long-press or programmatic selection won't stick.
function clearSelectionUnlessSelectable() {
  try {
    const sel = window.getSelection && window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const anchor = sel.anchorNode && (sel.anchorNode.nodeType === Node.TEXT_NODE ? sel.anchorNode.parentElement : (sel.anchorNode as Element));
    if (anchor && anchor.closest && anchor.closest('.selectable')) return;
    sel.removeAllRanges();
  } catch (e) {
    // ignore
  }
}

// Add transparent touch-blocker overlays to buttons to intercept long-press selection
function attachTouchBlockerToButton(btn: HTMLElement) {
  // avoid double-attaching
  if ((btn as any)._touchBlockerAttached) return;
  // ensure positioning context
  const cs = getComputedStyle(btn);
  if (cs.position === 'static') {
    btn.style.position = 'relative';
  }

  const blocker = document.createElement('span');
  blocker.className = 'touch-blocker';
  blocker.setAttribute('aria-hidden', 'true');
  blocker.setAttribute('tabindex', '-1');

  // touch handling: start a hold timer; short taps synthesize a click
  let downTime = 0;
  let holdTimer: number | null = null;

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType && e.pointerType !== 'touch') return;
    // ignore events inside selectable areas
    const el = (e.target instanceof Element) ? (e.target as Element) : null;
    if (el && el.closest && el.closest('.selectable')) return;

    downTime = Date.now();
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    holdTimer = window.setTimeout(() => {
      // clear selection if user is holding
      clearSelectionUnlessSelectable();
      holdTimer = null;
    }, 350);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType && e.pointerType !== 'touch') return;
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    const dt = Date.now() - downTime;
    downTime = 0;
    // short tap -> activate the button
    if (dt < 350) {
      // synthesize a click to preserve native behavior
      btn.click();
    }
  };

  blocker.addEventListener('pointerdown', onPointerDown, { passive: true });
  blocker.addEventListener('pointerup', onPointerUp, { passive: true });
  // fallback for older touch-only environments
  blocker.addEventListener('touchstart', (e) => {
    // ignore inside selectable
    const el = (e.target instanceof Element) ? (e.target as Element) : null;
    if (el && el.closest && el.closest('.selectable')) return;
    downTime = Date.now();
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    holdTimer = window.setTimeout(() => { clearSelectionUnlessSelectable(); holdTimer = null; }, 350);
  }, { passive: true });
  blocker.addEventListener('touchend', (e) => {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    const dt = Date.now() - downTime; downTime = 0;
    if (dt < 350) btn.click();
  }, { passive: true });

  // insert overlay
  btn.insertBefore(blocker, btn.firstChild);
  (btn as any)._touchBlockerAttached = true;
}

function attachBlockersToAllButtons() {
  try {
    document.querySelectorAll('button, a.button, .button').forEach((el) => {
      if (el instanceof HTMLElement) attachTouchBlockerToButton(el);
    });
  } catch (e) {
    // ignore
  }
}

// auto-attach on load and watch for new buttons
if (typeof window !== 'undefined') {
  attachBlockersToAllButtons();
  try {
    const mo = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches && node.matches('button, a.button, .button')) attachTouchBlockerToButton(node);
          node.querySelectorAll && node.querySelectorAll('button, a.button, .button').forEach((el) => { if (el instanceof HTMLElement) attachTouchBlockerToButton(el); });
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    // ignore
  }
}

// Global handlers: run on selectionchange and pointer/touch events
if (typeof window !== 'undefined') {
  // Clear immediately when selection changes
  document.addEventListener('selectionchange', () => {
    // use rAF to ensure we clear after browser selection update
    requestAnimationFrame(clearSelectionUnlessSelectable);
  }, { passive: true });

  // Immediately clear on pointer/touch interactions to prevent handles popping up
  document.addEventListener('pointerdown', clearSelectionUnlessSelectable, { passive: true });
  document.addEventListener('touchstart', clearSelectionUnlessSelectable, { passive: true });
  document.addEventListener('touchmove', clearSelectionUnlessSelectable, { passive: true });
  document.addEventListener('pointerup', clearSelectionUnlessSelectable, { passive: true });
  document.addEventListener('touchend', clearSelectionUnlessSelectable, { passive: true });
}
