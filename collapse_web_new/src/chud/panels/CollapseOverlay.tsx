// Full-screen overlay shown when HP has dropped to 0 and hasn't been revived yet.
export function CollapseOverlay({
  locked,
  onRevive,
}: {
  locked: boolean;
  onRevive: () => void;
}) {
  if (!locked) return null;
  return (
    <div className="collapse-overlay">
      <div className="collapse-panel">
        <span className="collapse-eyebrow">Critical Status</span>
        <h3>You Have Collapsed</h3>
        <p className="collapse-copy">
          Tap REVIVED once stabilized to resume HP edits.
        </p>
        <button
          type="button"
          className="revive-btn"
          onClick={onRevive}
        >
          REVIVED
        </button>
      </div>
    </div>
  );
}
