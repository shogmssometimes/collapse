import { useSemiLongPress } from "../../hooks/useSemiLongPress";
import { StatCard } from "../components/StatCard";
import { GearBriefWidget } from "../components/GearBriefWidget";
import type { GearSlotEntry } from "../../types/chud";

// Gear Mgmt accordion: inventory slots stat + swipeable gear brief widget.
export function GearPanel({
  open,
  onToggleOpen,
  inventorySlots,
  onInventoryIncr,
  onInventoryDecr,
  gearEntries,
  gearSlotsUsed,
  gearSlotsKey,
}: {
  open: boolean;
  onToggleOpen: () => void;
  inventorySlots: number;
  onInventoryIncr: () => void;
  onInventoryDecr: () => void;
  gearEntries: GearSlotEntry[] | null;
  gearSlotsUsed: number;
  gearSlotsKey: string;
}) {
  const toggleHandlers = useSemiLongPress(onToggleOpen);

  return (
    <div className={`mods secondary-accordion${open ? " open" : ""}`}>
      <button
        type="button"
        className="secondary-toggle"
        {...toggleHandlers}
      >
        <span>Gear Mgmt</span>
        <span className="secondary-toggle-chevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="viv-row">
          <div style={{ flex: '3 1 0', minWidth: 0 }}>
            <StatCard
              label="Inventory Slots"
              value={inventorySlots}
              onIncr={onInventoryIncr}
              onDecr={onInventoryDecr}
            />
          </div>
          <GearBriefWidget
            entries={gearEntries ?? []}
            count={inventorySlots}
            isOverEncumbered={gearSlotsUsed > inventorySlots}
            gearSlotsKey={gearSlotsKey}
          />
        </div>
      )}
    </div>
  );
}
