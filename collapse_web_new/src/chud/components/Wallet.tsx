import { useEffect, useState } from "react";

const WALLET_KEY = "chud.wallet";

function readWallet(): number {
  try {
    const raw = window.localStorage.getItem(WALLET_KEY);
    return raw !== null ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function writeWallet(balance: number) {
  try {
    const value = String(balance);
    window.localStorage.setItem(WALLET_KEY, value);
    window.dispatchEvent(new StorageEvent("storage", { key: WALLET_KEY, newValue: value }));
  } catch {
    // storage unavailable — ignore
  }
}

// React reimplementation of the vanilla-JS Wallet widget from meter-bridge.js,
// for use outside the CHUD iframe (e.g. the MGR page).
export function Wallet() {
  const [balance, setBalance] = useState<number>(() => (typeof window !== "undefined" ? readWallet() : 0));
  const [input, setInput] = useState("");

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === WALLET_KEY) setBalance(readWallet());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const getAmount = () => {
    const v = parseInt(input, 10);
    return isNaN(v) || v < 0 ? 0 : v;
  };

  const handleDebit = () => {
    const amt = getAmount();
    if (!amt) return;
    const next = balance + amt;
    setBalance(next);
    writeWallet(next);
    setInput("");
  };

  const handleCredit = () => {
    const amt = getAmount();
    if (!amt) return;
    const next = Math.max(0, balance - amt);
    setBalance(next);
    writeWallet(next);
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
          onChange={(e) => setInput(e.target.value)}
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
