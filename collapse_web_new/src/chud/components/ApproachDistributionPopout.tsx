import { createPortal } from "react-dom";
import type { ApproachStats } from "../../types/chud";

// Modal popout opened by long-pressing a Core Stat card. Lets the player
// distribute that Core stat's point pool across its two linked Approaches.
// Tapping the backdrop or the Close button applies and closes.
export function ApproachDistributionPopout({
  coreLabel,
  poolTotal,
  approachA,
  approachALabel,
  approachAValue,
  onApproachAChange,
  approachB,
  approachBLabel,
  approachBValue,
  onApproachBChange,
  onClose,
}: {
  coreLabel: string;
  poolTotal: number;
  approachA: keyof ApproachStats;
  approachALabel: string;
  approachAValue: number;
  onApproachAChange: (updater: (v: number) => number) => void;
  approachB: keyof ApproachStats;
  approachBLabel: string;
  approachBValue: number;
  onApproachBChange: (updater: (v: number) => number) => void;
  onClose: () => void;
}) {
  const spent = approachAValue + approachBValue;
  const remaining = Math.max(0, poolTotal - spent);

  const incr = (which: "a" | "b") => {
    if (remaining <= 0) return;
    const updater = (v: number) => v + 1;
    if (which === "a") onApproachAChange(updater);
    else onApproachBChange(updater);
  };

  const decr = (which: "a" | "b") => {
    const updater = (v: number) => Math.max(0, v - 1);
    if (which === "a") onApproachAChange(updater);
    else onApproachBChange(updater);
  };

  return createPortal(
    <div
      className="approach-distribution-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="approach-distribution-popout" onPointerDown={(event) => event.stopPropagation()}>
        <div className="approach-distribution-header">
          <span className="approach-distribution-title">{coreLabel} DISTRIBUTION</span>
          <span className="approach-distribution-remaining">
            {remaining} / {poolTotal} remaining
          </span>
        </div>

        {([
          [approachA, approachALabel, approachAValue, "a"],
          [approachB, approachBLabel, approachBValue, "b"],
        ] as const).map(([field, label, value, which]) => (
          <div className="approach-distribution-row" key={field}>
            <span className="approach-distribution-row-label">{label}</span>
            <div className="approach-distribution-row-controls">
              <button
                type="button"
                className="approach-distribution-btn"
                onClick={() => decr(which)}
                disabled={value <= 0}
                aria-label={`Decrease ${label}`}
              >
                -
              </button>
              <span className="approach-distribution-row-value">{value}</span>
              <button
                type="button"
                className="approach-distribution-btn"
                onClick={() => incr(which)}
                disabled={remaining <= 0}
                aria-label={`Increase ${label}`}
              >
                +
              </button>
            </div>
          </div>
        ))}

        <button type="button" className="approach-distribution-close" onClick={onClose}>
          X
        </button>
      </div>
    </div>,
    document.body
  );
}
