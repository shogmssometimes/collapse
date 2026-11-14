import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_CORE, computeDerived } from "../domain/chudStats";
import { loadState } from "../utils/chudPersistence";
import { engramCatalog } from "../data/handbook/engramCatalog";
import { rollEngramDice, type EngramRollResult } from "../domain/engrams";
import {
  readEngramState,
  setEngramCopies,
  spendEngramCharges,
  restoreEngramCharge,
  type EngramManagerState,
} from "../utils/engramState";
import HoldButton from "./deckBuilder/HoldButton";

// Player-facing Engram Manager: spell-slot style — equip copies of an
// Engram (capped by Capacity), spend charges to activate (rolling 1 die per
// charge spent, like the handbook's "duplicate copies stack" rule), and
// recover charges via a Short or Full Rest (handled by RestWidget, which
// writes to this same storage key). Only one Engram can be the pending
// selection at a time, but the player can freely change their mind (select
// a different Engram, or deselect) before confirming the spend.
export default function EngramManager({
  storageKey,
  chudStateStorageKey,
}: {
  storageKey: string;
  chudStateStorageKey: string;
}) {
  const [state, setState] = useState<EngramManagerState>(() => readEngramState(storageKey));
  const [core, setCore] = useState(() => loadState(chudStateStorageKey)?.core ?? DEFAULT_CORE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [diceToSpend, setDiceToSpend] = useState(1);
  const [lastRoll, setLastRoll] = useState<{ id: string; result: EngramRollResult } | null>(null);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === storageKey) setState(readEngramState(storageKey));
      if (e.key === chudStateStorageKey) {
        const saved = loadState(chudStateStorageKey)?.core;
        if (saved) setCore(saved);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [storageKey, chudStateStorageKey]);

  const refresh = useCallback(() => setState(readEngramState(storageKey)), [storageKey]);

  const capacity = computeDerived(core).capacity;
  const capacityUsed = useMemo(
    () =>
      Object.entries(state.equipped).reduce((sum, [id, e]) => {
        const def = engramCatalog.find((entry) => entry.id === id);
        return sum + (def ? def.level * e.copies : 0);
      }, 0),
    [state.equipped]
  );
  const capacityRemaining = Math.max(0, capacity - capacityUsed);
  // Lowering Inference/Personality (via the AAG page) after Engrams are
  // already equipped can leave capacityUsed above the new, lower capacity —
  // the book only allows Engram edits at a Full Rest, so there's no way to
  // silently re-clamp this; surface it instead (B6).
  const isOverCapacity = capacityUsed > capacity;

  const selected = selectedId ? state.equipped[selectedId] : undefined;
  const maxDice = selected ? Math.min(selected.copies, selected.charges) : 0;

  const changeCopies = useCallback(
    (id: string, level: number, delta: number) => {
      const current = state.equipped[id]?.copies ?? 0;
      const next = current + delta;
      if (next < 0) return;
      if (delta > 0 && level * delta > capacityRemaining) return; // not enough Capacity left
      setEngramCopies(storageKey, id, next);
      refresh();
      if (next <= 0 && selectedId === id) {
        setSelectedId(null);
      }
    },
    [state.equipped, capacityRemaining, storageKey, refresh, selectedId]
  );

  const selectEngram = useCallback(
    (id: string) => {
      setLastRoll(null);
      setDiceToSpend(1);
      setSelectedId((prev) => (prev === id ? null : id));
    },
    []
  );

  const confirmSpend = useCallback(() => {
    if (!selectedId || !selected) return;
    const count = Math.max(1, Math.min(diceToSpend, maxDice));
    const result = rollEngramDice(count);
    spendEngramCharges(storageKey, selectedId, count);
    setLastRoll({ id: selectedId, result });
    if (count >= selected.charges) {
      // No charges left to spend from — clear the pending selection instead
      // of leaving a disabled "Selected" state lingering on screen.
      setSelectedId(null);
      setDiceToSpend(1);
    }
    refresh();
  }, [selectedId, selected, diceToSpend, maxDice, storageKey, refresh]);

  const restoreBudget = state.pendingEngramRestoreBudget;

  return (
    <div className="page engram-manager">
      <div className="engram-manager-header">
        <h2>Engrams</h2>
        <div className={`engram-capacity-readout${isOverCapacity ? " over-capacity" : ""}`}>
          Capacity: <strong>{capacityUsed}</strong> / {capacity}
        </div>
        {isOverCapacity && (
          <div className="engram-over-capacity-banner" role="alert">
            <span className="engram-over-capacity-icon">⚠</span>
            <div>
              <div className="engram-over-capacity-title">Over Capacity</div>
              <div className="engram-over-capacity-detail">
                Equipped Engrams exceed Capacity by {capacityUsed - capacity} — unequip copies to fix this. Engrams
                can only be changed at a Full Rest.
              </div>
            </div>
          </div>
        )}
        {restoreBudget > 0 && (
          <div className="engram-restore-budget" role="status">
            Short Rest: {restoreBudget} Engram charge{restoreBudget === 1 ? "" : "s"} to restore — tap{" "}
            <span className="engram-restore-hint">Restore</span> on any Engram below.
          </div>
        )}
      </div>

      <div className="engram-catalog-list">
        {engramCatalog.map((def) => {
          const equipped = state.equipped[def.id];
          const copies = equipped?.copies ?? 0;
          const charges = equipped?.charges ?? 0;
          const isSelected = selectedId === def.id;
          const canAddCopy = def.level <= capacityRemaining;
          const canRestore = restoreBudget > 0 && copies > 0 && charges < copies;
          return (
            <div key={def.id} className={`engram-row${isSelected ? " selected" : ""}`}>
              <div className="engram-row-main">
                <div className="engram-row-title">
                  <span className="engram-name">{def.name}</span>
                  <span className="engram-level-badge">LVL {def.level}</span>
                </div>
                {def.effect && <div className="engram-effect">{def.effect}</div>}
                {def.note && <div className="engram-note muted">{def.note}</div>}
              </div>
              <div className="engram-row-controls">
                <div className="engram-copies-stepper" role="group" aria-label={`${def.name} copies owned`}>
                  <button type="button" onClick={() => changeCopies(def.id, def.level, -1)} disabled={copies <= 0}>
                    −
                  </button>
                  <span className="engram-copies-count">{copies}</span>
                  <button type="button" onClick={() => changeCopies(def.id, def.level, 1)} disabled={!canAddCopy}>
                    +
                  </button>
                </div>
                {copies > 0 && (
                  <>
                    <div className="engram-charges-readout">
                      {charges} / {copies} charges
                    </div>
                    {canRestore && (
                      <button
                        type="button"
                        className="engram-restore-btn"
                        onClick={() => {
                          restoreEngramCharge(storageKey, def.id);
                          refresh();
                        }}
                      >
                        Restore
                      </button>
                    )}
                    <button
                      type="button"
                      className="engram-select-btn"
                      onClick={() => selectEngram(def.id)}
                      disabled={charges <= 0}
                      aria-pressed={isSelected}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </button>
                  </>
                )}
              </div>
              {lastRoll?.id === def.id && (
                <div className="engram-roll-result" role="status">
                  {lastRoll.result.dice.map((value, i) => (
                    <span key={i} className="notification-die-chip" aria-label={`Rolled d4: ${value}`}>
                      {value}
                    </span>
                  ))}
                  <span className="engram-roll-total">Total {lastRoll.result.total}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="engram-spend-bar">
          <div className="engram-spend-label">
            Spending from <strong>{engramCatalog.find((e) => e.id === selectedId)?.name}</strong>
          </div>
          <div className="engram-spend-dice-stepper">
            <button type="button" onClick={() => setDiceToSpend((n) => Math.max(1, n - 1))} disabled={diceToSpend <= 1}>
              −
            </button>
            <span>{Math.min(diceToSpend, maxDice)} dice</span>
            <button
              type="button"
              onClick={() => setDiceToSpend((n) => Math.min(maxDice, n + 1))}
              disabled={diceToSpend >= maxDice}
            >
              +
            </button>
          </div>
          <HoldButton label="Spend" onHold={confirmSpend} />
          <button type="button" className="engram-cancel-btn" onClick={() => setSelectedId(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
