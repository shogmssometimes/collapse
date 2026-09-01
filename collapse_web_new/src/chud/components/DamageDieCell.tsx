import { useEffect, useState } from "react";

const COMBAT_KEY = "combat.v1";

function readDamage(): string {
  try {
    const raw = window.localStorage.getItem(COMBAT_KEY);
    if (!raw) return "d4";
    const parsed = JSON.parse(raw);
    return typeof parsed?.damage === "string" ? parsed.damage : "d4";
  } catch {
    return "d4";
  }
}

// Read-only display of the damage die chosen on the standalone Combat page.
export function DamageDieCell() {
  const [damage, setDamage] = useState<string>(() =>
    typeof window !== "undefined" ? readDamage() : "d4"
  );

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === COMBAT_KEY) setDamage(readDamage());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <div className="combat-info-cell">
      <span className="combat-info-cell-label">DAMAGE</span>
      <div className="combat-info-die">{damage.toUpperCase()}</div>
    </div>
  );
}
