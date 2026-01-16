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
