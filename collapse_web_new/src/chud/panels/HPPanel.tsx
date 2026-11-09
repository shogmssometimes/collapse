import type { ReactNode } from "react";
import { useGesture } from "../../hooks/useGesture";
import { GearPanel } from "./GearPanel";
import type { GearSlotEntry } from "../../types/chud";

// HP section: HP bar, then Methods, then nested Set Rolls, Gear queue,
// Grit/Collapse meter, and (last) Chip Sync. Plain section (no accordion).
// Order on screen: HP, Methods, Sets, Gear Queue, Grit/Collapse, Sync.
export function HPPanel({
  hpCounter,
  hpMax,
  collapseLocked,
  onHpIncr,
  onHpDecr,
  gearEntries,
  gearSlotsUsed,
  gearSlotsKey,
  inventorySlots,
  methods,
}: {
  hpCounter: number;
  hpMax: number;
  collapseLocked: boolean;
  onHpIncr: () => void;
  onHpDecr: () => void;
  gearEntries: GearSlotEntry[] | null;
  gearSlotsUsed: number;
  gearSlotsKey: string;
  inventorySlots: number;
  /** The Methods (ApproachPanel) section, rendered directly below HP. */
  methods: ReactNode;
}) {
  const hpHandlers = useGesture(onHpIncr, onHpDecr);
  const hpFillPct = Math.max(0, Math.min(100, (hpCounter / hpMax) * 100));

  return (
    <div className="mods">
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
      {/* Grit/Collapse meter vanilla widget from meter-bridge.js mounts here,
          directly below the gear queue. */}
      <div id="chud-gcm-anchor" />
      {/* Chip Sync (vanilla widget from meter-bridge.js) mounts here, last,
          directly below the Grit/Collapse meter. */}
      <div id="chud-hp-queue-anchor" />
    </div>
  );
}

