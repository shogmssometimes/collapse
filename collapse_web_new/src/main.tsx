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

// Global handlers: run on selectionchange and pointer/touch end events
if (typeof window !== 'undefined') {
  document.addEventListener('selectionchange', clearSelectionUnlessSelectable, { passive: true });
  document.addEventListener('pointerup', clearSelectionUnlessSelectable, { passive: true });
  document.addEventListener('touchend', clearSelectionUnlessSelectable, { passive: true });
}
