import { useGesture } from "../../hooks/useGesture";

export function RepCard({
  label,
  reps,
  threshold,
  ready,
  onTap,
  onReset,
  onLevelUp,
}: {
  label: string;
  reps: number;
  threshold: number;
  ready: boolean;
  onTap: () => void;
  onReset: () => void;
  onLevelUp: () => void;
}) {
  const handlers = useGesture(ready ? () => {} : onTap, onReset);
  return (
    <div
      className={`core-card interactive rep-card${ready ? " rep-ready" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`${label} reps ${reps} of ${threshold}${ready ? " — level up ready" : ""}`}
      {...handlers}
    >
      <span className="core-label">{label}</span>
      <div className="rep-progress">
        <span className="rep-count-num">{reps}</span>
        <span className="rep-sep">/</span>
        <span className="rep-threshold-num">{threshold}</span>
      </div>
      <div className="rep-pips">
        {Array.from({ length: threshold }, (_, i) => (
          <span key={i} className={`rep-pip${i < reps ? " filled" : ""}${ready ? " ready" : ""}`} />
        ))}
      </div>
      {ready && (
        <button
          type="button"
          className="rep-levelup-badge"
          onClick={(e) => { e.stopPropagation(); onLevelUp(); }}
        >
          LEVEL UP
        </button>
      )}
    </div>
  );
}
