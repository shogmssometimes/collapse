import { useGesture } from "../../hooks/useGesture";
import { VIV_TIERS, VIV_CYCLE } from "../../data/vivTiers";

export function VivCard({
  viv,
  onIncr,
  onDecr,
}: {
  viv: number;
  onIncr: () => void;
  onDecr: () => void;
}) {
  const handlers = useGesture(onIncr, onDecr);
  const tier =
    VIV_TIERS.find((t) => viv >= t.min && viv <= t.max) ??
    VIV_TIERS[VIV_TIERS.length - 1];
  const tierDots = VIV_TIERS.map((t) => ({ ...t, active: viv >= t.min }));

  const overflowCount = Math.max(0, Math.floor(viv / VIV_CYCLE));
  const fillFraction = (viv % VIV_CYCLE) / VIV_CYCLE;
  const fillPct = (fillFraction * 100).toFixed(2) + "%";
  const fillOpacity = Math.min(
    0.65,
    0.35 + fillFraction * 0.35 + Math.min(overflowCount * 0.05, 0.3)
  );
  const pillCount = Math.min(overflowCount, 6);
  const pills = Array.from({ length: pillCount }, (_, i) => i + 1);
  const extraOverflow = Math.max(0, overflowCount - pillCount);
  const chargeLabel =
    overflowCount > 0
      ? `${Math.round(fillFraction * 100)}% +${overflowCount}`
      : `${Math.round(fillFraction * 100)}%`;

  return (
    <div
      className="stat-card viv-card interactive"
      role="button"
      tabIndex={0}
      aria-label={`${tier.title} Viv ${viv}`}
      style={{
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${tier.accent}`,
        boxShadow: `0 8px 24px ${tier.glow}`,
        background: "rgba(8,13,23,0.92)",
        isolation: "isolate",
        transition: "border 200ms ease, box-shadow 220ms ease",
        cursor: "pointer",
      }}
      {...handlers}
    >
      {/* Background gradient */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          background: `linear-gradient(140deg, ${tier.fill}, rgba(2,6,23,0.9))`,
          opacity: 0.9,
          pointerEvents: "none",
          transition: "background 240ms ease",
        }}
      />
      {/* Animated fill strip */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          left: 4,
          borderRadius: 12,
          background: `linear-gradient(120deg, ${tier.accent}, rgba(2,6,23,0))`,
          width: fillPct,
          maxWidth: "calc(100% - 8px)",
          opacity: fillOpacity,
          filter: `drop-shadow(0 0 10px ${tier.glow})`,
          pointerEvents: "none",
          transition: "width 220ms ease, opacity 220ms ease",
        }}
      />
      {/* Overflow border glow */}
      {overflowCount > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 2,
            borderRadius: "inherit",
            border: `1px dashed rgba(248,250,252,${0.2 + Math.min(overflowCount * 0.05, 0.5)})`,
            opacity: 0.2 + Math.min(overflowCount * 0.08, 0.4),
            mixBlendMode: "screen" as const,
            pointerEvents: "none",
          }}
        />
      )}
      {/* Content */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 1,
        }}
      >
        {/* Label + value */}
        <div
          className="stat-label"
          style={{ justifyContent: "space-between" }}
        >
          <strong>Viv</strong>
          <span>{viv}</span>
        </div>
        {/* Progress bar */}
        <div
          style={{
            position: "relative",
            height: 5,
            borderRadius: 999,
            background: "rgba(15,23,42,0.6)",
            overflow: "hidden",
            boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.4)",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              width: fillPct,
              background: `linear-gradient(90deg, ${tier.accent}, ${tier.glow})`,
              transition: "width 220ms ease",
              boxShadow: `0 0 10px ${tier.glow}`,
            }}
          />
        </div>
        {/* Tier dots */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {tierDots.map((d) => (
            <span
              key={d.title}
              aria-hidden="true"
              style={{
                flex: "1 1 16%",
                height: 3,
                borderRadius: 999,
                background: d.active ? d.accent : "rgba(148,163,184,0.25)",
                opacity: d.active ? 1 : 0.35,
                transition: "all 160ms ease",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
