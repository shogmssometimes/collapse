import { useGesture } from "../../hooks/useGesture";
import { useSemiLongPress } from "../../hooks/useSemiLongPress";
import { VivCard } from "../components/VivCard";
import { StatCard } from "../components/StatCard";

// HP & Viv accordion: HP bar, Viv card, WT/AP/Draw row, Capacity/Readyness row.
export function HPVivPanel({
  open,
  onToggleOpen,
  hpCounter,
  hpMax,
  collapseLocked,
  onHpIncr,
  onHpDecr,
  viv,
  onVivIncr,
  onVivDecr,
  wt,
  onWtIncr,
  onWtDecr,
  ap,
  onApIncr,
  onApDecr,
  draw,
  onDrawIncr,
  onDrawDecr,
  capacity,
  readyness,
  isOverEncumbered,
}: {
  open: boolean;
  onToggleOpen: () => void;
  hpCounter: number;
  hpMax: number;
  collapseLocked: boolean;
  onHpIncr: () => void;
  onHpDecr: () => void;
  viv: number;
  onVivIncr: () => void;
  onVivDecr: () => void;
  wt: number;
  onWtIncr: () => void;
  onWtDecr: () => void;
  ap: number;
  onApIncr: () => void;
  onApDecr: () => void;
  draw: number;
  onDrawIncr: () => void;
  onDrawDecr: () => void;
  capacity: number;
  readyness: number;
  isOverEncumbered: boolean;
}) {
  const hpHandlers = useGesture(onHpIncr, onHpDecr);
  const toggleHandlers = useSemiLongPress(onToggleOpen);
  const hpFillPct = Math.max(0, Math.min(100, (hpCounter / hpMax) * 100));

  return (
    <div className={`mods secondary-accordion${open ? " open" : ""}`}>
      <button
        type="button"
        className="secondary-toggle"
        {...toggleHandlers}
      >
        <span>HP &amp; Viv</span>
        <span className="secondary-toggle-chevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <>
          {/* ── Row 1: HP (70%) | VIV (30%) ── */}
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <div style={{ flex: 7, minWidth: 0 }}>
              <div
                className="stat-card hp-card interactive"
                role="button"
                aria-disabled={collapseLocked ? "true" : "false"}
                tabIndex={collapseLocked ? -1 : 0}
                data-hp-state={hpFillPct <= 30 ? "critical" : hpFillPct <= 60 ? "warning" : "normal"}
                style={{ height: "100%" }}
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
            </div>
            <div style={{ flex: 3, minWidth: 0 }}>
              <VivCard
                viv={viv}
                onIncr={onVivIncr}
                onDecr={onVivDecr}
              />
            </div>
          </div>

          {/* ── Row 2: WT | AP | Draw ── */}
          <div className="viv-row">
            <StatCard
              label="WT"
              value={wt}
              onIncr={onWtIncr}
              onDecr={onWtDecr}
            />
            <StatCard
              label="AP"
              value={ap}
              onIncr={onApIncr}
              onDecr={onApDecr}
            />
            <StatCard
              label="Draw"
              value={draw}
              onIncr={onDrawIncr}
              onDecr={onDrawDecr}
            />
          </div>

          {/* ── Row 3: Capacity | Readyness ── */}
          <div className="stat-row trio">
            <div className="chip">
              <span>Capacity</span>
              <strong>{capacity}</strong>
            </div>
            <div className="chip">
              <span>Readyness</span>
              <strong style={isOverEncumbered ? { color: 'rgba(255,100,100,0.95)', fontStyle: 'italic' } : undefined}>
                {isOverEncumbered ? 'Last' : readyness}
              </strong>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
