import { useGesture } from "../../hooks/useGesture";

export function StatCard({
  label,
  value,
  onIncr,
  onDecr,
}: {
  label: string;
  value: number;
  onIncr: () => void;
  onDecr: () => void;
}) {
  const handlers = useGesture(onIncr, onDecr);
  return (
    <div
      className="core-card interactive"
      role="button"
      tabIndex={0}
      aria-label={`${label} ${value}`}
      {...handlers}
    >
      <span className="core-label">{label}</span>
      <div className="core-controls">
        <span className="core-value">{value}</span>
      </div>
    </div>
  );
}
