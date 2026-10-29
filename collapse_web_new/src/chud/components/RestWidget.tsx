import { useCallback, useEffect, useState } from "react";
import type { CoreStats } from "../../types/chud";
import { DEFAULT_CORE, computeDerived } from "../../domain/chudStats";
import {
  NOTIFICATIONS_STORAGE_KEY,
  hasPendingNotification,
  pushNotification,
} from "../../domain/notifications";
import {
  readGlobalMeters,
  readHpCounter,
  readCore,
  resetApproachOverload,
} from "../../utils/chudVanillaBridge";
import { grantEngramRestoreBudget, fullRestEngrams } from "../../utils/engramState";

function readState(storageKey: string): Record<string, unknown> {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
}

function writeState(storageKey: string, patch: Record<string, unknown>) {
  try {
    const next = { ...readState(storageKey), ...patch };
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // storage unavailable — ignore
  }
}

const SHORT_REST_KINDS = ["short-rest-grit", "short-rest-hp", "short-rest-engrams"] as const;

function anyShortRestPending(): boolean {
  return SHORT_REST_KINDS.some((k) => hasPendingNotification(k));
}

// Short Rest / Dig Deep / Full Rest, rendered at the bottom of the AAG page.
// Every Rest effect is rolled up-front (when applicable) and queued as a
// notification — nothing applies automatically. Dig Deep already followed
// this pattern; Short/Full Rest now do too:
//   - Short Rest: choose exactly one of Grit (+1) / HP (1d6) / Engrams
//     (1d4 restore budget, spent later in the Engram Manager).
//   - Full Rest: Grit set to 1d6 + Rest Bonus (max 6), HP to max, Overload
//     dice (Method dice) fully reset, and all Engram charges refilled.
export function RestWidget({
  storageKey,
  deckBuilderStorageKey,
  core,
}: {
  storageKey: string;
  deckBuilderStorageKey: string;
  core?: CoreStats;
}) {
  const [digDeepPending, setDigDeepPending] = useState<boolean>(() =>
    typeof window !== "undefined" ? hasPendingNotification("dig-deep") : false
  );
  const [shortRestPending, setShortRestPending] = useState<boolean>(() =>
    typeof window !== "undefined" ? anyShortRestPending() : false
  );
  const [fullRestPending, setFullRestPending] = useState<boolean>(() =>
    typeof window !== "undefined" ? hasPendingNotification("full-rest") : false
  );
  const [shortRestOpen, setShortRestOpen] = useState(false);
  const [restBonus, setRestBonus] = useState<number>(() => {
    const v = readState(storageKey).restBonus;
    return typeof v === "number" ? v : 0;
  });

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== NOTIFICATIONS_STORAGE_KEY) return;
      setDigDeepPending(hasPendingNotification("dig-deep"));
      setShortRestPending(anyShortRestPending());
      setFullRestPending(hasPendingNotification("full-rest"));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const onDigDeep = useCallback(() => {
    if (hasPendingNotification("dig-deep")) return;
    const d1 = 1 + Math.floor(Math.random() * 4);
    const d2 = 1 + Math.floor(Math.random() * 4);
    const lose = Math.max(d1, d2);
    const gain = Math.min(d1, d2);
    const created = pushNotification(
      "dig-deep",
      "Dig Deep",
      `Rolled ${d1}, ${d2}. Accept to lose ${lose} HP and gain ${gain} Grit.`,
      { hp: -lose, grit: gain }
    );
    if (created) setDigDeepPending(true);
  }, []);

  const chooseShortRestGrit = useCallback(() => {
    if (anyShortRestPending()) return;
    const created = pushNotification(
      "short-rest-grit",
      "Short Rest — Restore Grit",
      "Accept to gain +1 Grit.",
      { grit: 1 }
    );
    if (created) {
      setShortRestPending(true);
      setShortRestOpen(false);
    }
  }, []);

  const chooseShortRestHp = useCallback(() => {
    if (anyShortRestPending()) return;
    const roll = 1 + Math.floor(Math.random() * 6);
    const created = pushNotification(
      "short-rest-hp",
      "Short Rest — Restore HP",
      `Rolled ${roll}. Accept to gain ${roll} HP.`,
      { hp: roll },
      { roll: { die: 6, value: roll } }
    );
    if (created) {
      setShortRestPending(true);
      setShortRestOpen(false);
    }
  }, []);

  const chooseShortRestEngrams = useCallback(() => {
    if (anyShortRestPending()) return;
    const roll = 1 + Math.floor(Math.random() * 4);
    const created = pushNotification(
      "short-rest-engrams",
      "Short Rest — Restore Engrams",
      `Rolled ${roll}. Accept to restore ${roll} Engram charge${roll === 1 ? "" : "s"} (choose which in the Engram Manager).`,
      { engramRestoreBudget: roll },
      { roll: { die: 4, value: roll } }
    );
    if (created) {
      setShortRestPending(true);
      setShortRestOpen(false);
    }
  }, []);

  const onFullRest = useCallback(() => {
    if (hasPendingNotification("full-rest")) return;
    const roll = 1 + Math.floor(Math.random() * 6);
    const targetGrit = Math.min(6, roll + restBonus);
    const { grit: currentGrit } = readGlobalMeters();
    const gritDelta = targetGrit - currentGrit;
    const activeCore = core ?? readCore(storageKey) ?? DEFAULT_CORE;
    const hpMax = computeDerived(activeCore).hp;
    const hpDelta = hpMax - readHpCounter(storageKey);
    const bonusText = restBonus ? ` + ${restBonus} Rest Bonus` : "";
    const created = pushNotification(
      "full-rest",
      "Full Rest",
      `Rolled ${roll}${bonusText} (max 6) for Grit. Accept to set Grit to ${targetGrit}, restore HP to full, refill all Engram charges, and reset Method dice.`,
      { grit: gritDelta, hp: hpDelta, restoreOverload: true, fullEngramRestore: true },
      { roll: { die: 6, value: roll } }
    );
    if (created) setFullRestPending(true);
  }, [core, storageKey, restBonus]);

  const changeRestBonus = useCallback(
    (delta: number) => {
      setRestBonus((prev) => {
        const next = Math.max(0, prev + delta);
        writeState(storageKey, { restBonus: next });
        return next;
      });
    },
    [storageKey]
  );

  return (
    <div className="mods rest-widget">
      <h3>Rest</h3>

      <div className="rest-stack">
        <button
          type="button"
          className="rest-stack-btn short"
          onClick={() => setShortRestOpen((v) => !v)}
          disabled={shortRestPending}
          title={shortRestPending ? "Resolve the pending Short Rest notification first" : undefined}
        >
          {shortRestPending ? "Short Rest (pending…)" : "Short Rest"}
        </button>
        {shortRestOpen && !shortRestPending && (
          <div className="short-rest-choices" role="group" aria-label="Choose one Short Rest option">
            <button type="button" onClick={chooseShortRestGrit}>
              Restore Grit (+1)
            </button>
            <button type="button" onClick={chooseShortRestHp}>
              Restore HP (1d6)
            </button>
            <button type="button" onClick={chooseShortRestEngrams}>
              Restore Engrams (1d4)
            </button>
          </div>
        )}
        <button
          type="button"
          className="rest-stack-btn digdeep"
          onClick={onDigDeep}
          disabled={digDeepPending}
          title={digDeepPending ? "Resolve the pending Dig Deep notification first" : undefined}
        >
          {digDeepPending ? "Dig Deep (pending…)" : "Dig Deep"}
        </button>
        <div className="full-rest-row">
          <button
            type="button"
            className="rest-stack-btn fullrest"
            onClick={onFullRest}
            disabled={fullRestPending}
            title={fullRestPending ? "Resolve the pending Full Rest notification first" : undefined}
          >
            {fullRestPending ? "Full Rest (pending…)" : "Full Rest"}
          </button>
          <div className="rest-bonus-stepper" title="GM-set Rest Bonus added to the Full Rest Grit roll">
            <span>Rest Bonus</span>
            <button type="button" onClick={() => changeRestBonus(-1)} disabled={restBonus <= 0}>
              −
            </button>
            <span className="rest-bonus-value">{restBonus}</span>
            <button type="button" onClick={() => changeRestBonus(1)}>
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Applies an accepted "full-rest" notification's Engram/Method-dice side
// effects (the Grit/HP deltas go through the normal effect-application path
// already shared by every notification kind). Exported so the header bell
// and Chud.tsx's resolver can call it without duplicating the logic.
export function applyFullRestExtras(chudStateKey: string, deckBuilderStorageKey: string): void {
  resetApproachOverload(chudStateKey);
  fullRestEngrams(deckBuilderStorageKey);
}

// Applies an accepted "short-rest-engrams" notification: grants the rolled
// restore budget, to be spent interactively (player's choice of Engram) in
// the Engram Manager.
export function applyShortRestEngramBudget(deckBuilderStorageKey: string, amount: number): void {
  grantEngramRestoreBudget(deckBuilderStorageKey, amount);
}
