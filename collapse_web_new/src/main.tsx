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
if (typeof window !== 'undefined' && 'ontouchstart' in window) {
  // Add no-select class to root so interactive components prioritize taps
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

  // Prevent text selection triggered by long-press on touch devices, but allow on elements with .selectable
  document.addEventListener('selectstart', (e) => {
    const el = (e.target instanceof Element) ? e.target : null;
    if (!el) return;
    if (el.closest('.selectable')) return; // allow selection inside opt-in areas
    e.preventDefault();
  }, { passive: false });
}
