import { EngramBriefWidget } from "../components/EngramBriefWidget";
import type { EngramManagerState } from "../../utils/engramState";

// Engram queue widget, always visible (no accordion box) — same treatment
// as the Gear queue, cycling through equipped Engrams with charges left.
export function EngramPanel({
  engramState,
  engramStorageKey,
}: {
  engramState: EngramManagerState;
  engramStorageKey: string;
}) {
  return (
    <div className="mods">
      <EngramBriefWidget state={engramState} storageKey={engramStorageKey} />
    </div>
  );
}
