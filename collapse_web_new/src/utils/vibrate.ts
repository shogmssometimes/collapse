// Cross-browser navigator.vibrate() wrapper. No-op if unsupported.
export function vibrate(pattern: number = 10) {
  if (typeof navigator !== 'undefined' && typeof (navigator as any).vibrate === 'function') {
    (navigator as any).vibrate(pattern);
  }
}
