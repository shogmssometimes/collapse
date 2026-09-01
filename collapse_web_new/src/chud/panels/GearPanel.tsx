import { GearBriefWidget } from "../components/GearBriefWidget";
import type { GearSlotEntry } from "../../types/chud";

// Gear queue widget, always visible (no accordion box) like the Combat Queue.
export function GearPanel({
  gearEntries,
  gearSlotsUsed,
  gearSlotsKey,
  inventorySlots,
}: {
  gearEntries: GearSlotEntry[] | null;
  gearSlotsUsed: number;
  gearSlotsKey: string;
  inventorySlots: number;
}) {
  return (
    <div className="mods">
      <GearBriefWidget
        entries={gearEntries ?? []}
        count={inventorySlots}
        isOverEncumbered={gearSlotsUsed > inventorySlots}
        gearSlotsKey={gearSlotsKey}
      />
    </div>
  );
}
