// Shared timing for every "hold to confirm" control in the app EXCEPT the
// two areas intentionally left alone during the gesture simplification
// pass: Method dice rolling's arm-then-swipe (METHOD_ARM_MS in
// ApproachDie.tsx) and the roll-result popup's die pickup (DIE_LONG_PRESS_MS,
// also in ApproachDie.tsx). Everything else — Core Stat distribution
// (now swipe-based, no hold), Ganbare!, notifications, Gear/Engram HUD
// queues, the Gear page, and every Deck Builder hold button — uses this one
// duration and the shared `.hold-progress-fill` visual (src/index.css) so a
// "hold this down" affordance always looks and feels the same everywhere.
export const STANDARD_LONG_PRESS_MS = 500;
