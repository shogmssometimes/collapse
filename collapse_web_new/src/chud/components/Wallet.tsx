import { useEffect, useState } from "react";
import { walletKey } from "../../utils/slotKeys";

// Collapse Credits are a whole-number currency with no handbook-specified
// upper bound; capped here purely so a huge/garbled input (e.g. "1e20")
// can't blow out the header's fixed width (B4).
const WALLET_AMOUNT_MAX = 999_999_999;

function readWallet(key: string): number {
  try {
    const raw = window.localStorage.getItem(key);
    return raw !== null ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function writeWallet(key: string, balance: number) {
  try {
    const value = String(balance);
    window.localStorage.setItem(key, value);
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: value }));
  } catch {
    // storage unavailable — ignore
  }
}

/**
 * Sanitizes the Debit/Credit amount field live as the player types (B4):
 * `parseInt` alone stops at the first non-digit, so e.g. "1e9" silently
 * became 1 instead of being rejected or treated as 1000000000, and
 * fractional input ("2.5") was silently truncated with no visual feedback.
 * Using `Number()` instead catches scientific notation and non-numeric
 * input alike; flooring + capping here keeps what's typed matching what a
 * tap on +/− will actually apply.
 */
function sanitizeWalletAmountInput(raw: string): string {
  if (raw === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  const clamped = Math.min(WALLET_AMOUNT_MAX, Math.floor(Math.abs(n)));
  return String(clamped);
}

// React reimplementation of the vanilla-JS Wallet widget from meter-bridge.js,
// for use outside the CHUD iframe (e.g. the MGR page). `charSlot` defaults to
// 1 (the legacy un-suffixed key) so this stays per-character (B2) when the
// page passes it, rather than one balance shared by every slot.
export function Wallet({ charSlot = 1 }: { charSlot?: number }) {
  const storageKey = walletKey(charSlot);
  const [balance, setBalance] = useState<number>(() => (typeof window !== "undefined" ? readWallet(storageKey) : 0));
  const [input, setInput] = useState("");

  useEffect(() => {
    setBalance(readWallet(storageKey));
  }, [storageKey]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === storageKey) setBalance(readWallet(storageKey));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [storageKey]);

  const getAmount = () => {
    const n = Number(input);
    return Number.isFinite(n) ? Math.min(WALLET_AMOUNT_MAX, Math.floor(Math.abs(n))) : 0;
  };

  const handleDebit = () => {
    const amt = getAmount();
    if (!amt) return;
    // Balance isn't capped/floored on this side — debt (a negative balance)
    // is intentional (B4); only the typed amount is bounded above.
    const next = balance + amt;
    setBalance(next);
    writeWallet(storageKey, next);
    setInput("");
  };

  const handleCredit = () => {
    const amt = getAmount();
    if (!amt) return;
    const next = balance - amt;
    setBalance(next);
    writeWallet(storageKey, next);
    setInput("");
  };

  return (
    <div className="chud-wallet">
      <div className="chud-wallet-header">
        <div>
          <span className="chud-wallet-balance">{balance}</span>
          <span className="chud-wallet-balance-unit">CC</span>
        </div>
      </div>
      <div className="chud-wallet-controls">
        <input
          type="number"
          className="chud-wallet-input"
          placeholder="0"
          min={0}
          inputMode="numeric"
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(sanitizeWalletAmountInput(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleDebit();
          }}
        />
        <button type="button" className="chud-wallet-btn debit" onClick={handleDebit}>+</button>
        <button type="button" className="chud-wallet-btn credit" onClick={handleCredit}>−</button>
      </div>
    </div>
  );
}
