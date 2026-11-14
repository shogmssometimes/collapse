import type { ReactNode } from "react";
import { useGesture } from "../../hooks/useGesture";
import { GearPanel } from "./GearPanel";
import { EngramPanel } from "./EngramPanel";
import type { GearSlotEntry } from "../../types/chud";
import type { EngramManagerState } from "../../utils/engramState";

// HP section: HP bar, then Methods, then nested Set Rolls, Gear queue,
// Engram queue, Grit/Collapse meter, and (last) Chip Sync. Plain section
// (no accordion).
// Order on screen: HP, Methods, Sets, Gear Queue, Engram Queue, Grit/Collapse, Sync.
export function HPPanel({
  hpCounter,
  hpMax,
  collapseLocked,
  onHpIncr,
  onHpDecr,
  ganbareRemaining,
  ganbareMax,
  onSpendGanbare,
  gearEntries,
  gearSlotsUsed,
  gearSlotsKey,
  inventorySlots,
  engramState,
  engramStorageKey,
  methods,
}: {
  hpCounter: number;
  hpMax: number;
  collapseLocked: boolean;
  onHpIncr: () => void;
  onHpDecr: () => void;
  /** Ganbare! Charges (the friend-assistance economy) — rendered to the right of HP. */
  ganbareRemaining: number;
  ganbareMax: number;
  onSpendGanbare: () => void;
  gearEntries: GearSlotEntry[] | null;
  gearSlotsUsed: number;
  gearSlotsKey: string;
  inventorySlots: number;
  engramState: EngramManagerState;
  engramStorageKey: string;
  /** The Methods (ApproachPanel) section, rendered directly below HP. */
  methods: ReactNode;
}) {
  // HP is inverted relative to every other stat card: a tap removes 1 HP
  // (the common case — taking damage), a 500ms hold adds 1 HP (healing —
  // deliberately slower/rarer to avoid accidental taps undoing damage).
  const hpHandlers = useGesture(onHpDecr, onHpIncr);
  const hpFillPct = Math.max(0, Math.min(100, (hpCounter / hpMax) * 100));

  return (
    <div className="mods">
      <div className="hp-row">
        <div
          className="stat-card hp-card interactive"
          role="button"
          aria-disabled={collapseLocked ? "true" : "false"}
          tabIndex={collapseLocked ? -1 : 0}
          data-hp-state={hpFillPct <= 30 ? "critical" : hpFillPct <= 60 ? "warning" : "normal"}
          {...(collapseLocked ? {} : hpHandlers)}
        >
          <div className="stat-label">
            <strong>HP</strong>
            <span>{hpCounter} / {hpMax}</span>
          </div>
          <div
            className="stat-bar"
            role="img"
            aria-label={`HP ${hpCounter} of ${hpMax}`}
          >
            <div className="bar-fill" style={{ width: `${hpFillPct}%` }} />
          </div>
        </div>
        <button
          type="button"
          className="chip chip-spendable ganbare-charges-chip"
          onClick={onSpendGanbare}
          disabled={ganbareRemaining <= 0}
          aria-label={`Ganbare! ${ganbareRemaining} of ${ganbareMax} remaining. Tap to spend a Charge.`}
        >
          <span>Ganbare!</span>
          <strong>
            {ganbareRemaining}/{ganbareMax}
          </strong>
        </button>
      </div>
      {methods}
      {/* Set Rolls (Status Effects, vanilla widget from meter-bridge.js)
          mounts here, directly below Methods. */}
      <div id="chud-setrolls-anchor" />
      <GearPanel
        gearEntries={gearEntries}
        gearSlotsUsed={gearSlotsUsed}
        gearSlotsKey={gearSlotsKey}
        inventorySlots={inventorySlots}
      />
      <EngramPanel
        engramState={engramState}
        engramStorageKey={engramStorageKey}
      />
      {/* Grit/Collapse meter vanilla widget from meter-bridge.js mounts here,
          directly below the gear queue. */}
      <div id="chud-gcm-anchor" />
      {/* Chip Sync (vanilla widget from meter-bridge.js) mounts here, last,
          directly below the Grit/Collapse meter. */}
      <div id="chud-hp-queue-anchor" />
    </div>
  );
}

