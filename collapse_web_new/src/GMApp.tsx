import React, { useEffect, useMemo, useState } from "react";
import DeckBuilder from "./pages/DeckBuilder";
import GMCombatTracker from "./pages/GMCombatTracker";
import { Card } from "./domain/decks/DeckEngine";

// ── Types ────────────────────────────────────────────────────────────────────

type GMRoute = "hub" | "deck" | "ops" | "combat";

// ── Route helpers ────────────────────────────────────────────────────────────

const deriveGMRoute = (): GMRoute => {
  if (typeof window === "undefined") return "hub";
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [segment, sub] = hash.split(/[\/?]/);
  if (segment === "deck") return "deck";
  if (segment === "ops") return "ops";
  if (segment === "combat") return "combat";
  if (segment === "gm") {
    if (sub === "ops") return "ops";
    return "deck";
  }
  return "hub";
};

// ── Shell ────────────────────────────────────────────────────────────────────

const GMShell: React.FC<{
  onBack?: () => void;
  children: React.ReactNode;
  subtitle?: string;
}> = ({ onBack, children, subtitle }) => (
  <div className="gm-shell" style={{ minHeight: "100vh", background: "var(--bg-dark)" }}>
    <header className="topbar">
      {onBack && (
        <button className="ghost-btn ghost-btn-icon" onClick={onBack} aria-label="Back to hub">
          <span aria-hidden="true">←</span>
        </button>
      )}
      <div className="topbar-title">
        <div className="muted" style={{ fontSize: "0.85rem" }}>Collapse GM Companion</div>
        <strong>{subtitle ?? "GM Tools"}</strong>
      </div>
    </header>
    {children}
  </div>
);

// ── Intro banner ─────────────────────────────────────────────────────────────

const CompanionIntro: React.FC<{
  eyebrow: string;
  title: string;
  description: string;
  helper?: string;
}> = ({ eyebrow, title, description, helper }) => (
  <div className="page">
    <div className="page-header">
      <div>
        <div className="muted" style={{ fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {eyebrow}
        </div>
        <h1 style={{ margin: "0.15rem 0 0.35rem 0" }}>{title}</h1>
        <p className="muted" style={{ margin: 0 }}>{description}</p>
      </div>
      {helper && (
        <div className="muted text-body" style={{ maxWidth: 320, textAlign: "right" }}>
          {helper}
        </div>
      )}
    </div>
  </div>
);

// ── Hub landing ───────────────────────────────────────────────────────────────

const GM_BASE_URL = import.meta.env.BASE_URL as string;

const GMHub: React.FC<{ onNavigate: (route: GMRoute) => void }> = ({ onNavigate }) => (
  <GMShell subtitle="GM Hub">
    <main className="hub-landing">
      <div className="hub-landing-content" style={{ width: "min(800px, 100%)", padding: "1.25rem 1rem" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
          <a
            href={GM_BASE_URL}
            style={{ color: "var(--muted)", fontSize: "0.85rem", textDecoration: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.75rem" }}
          >
            ← Switch to Player
          </a>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            marginTop: "0.6rem",
          }}
        >
          <button
            className="hub-card"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "1rem",
              background: "var(--surface)",
              minHeight: 126,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              textAlign: "center",
              cursor: "pointer",
              "--card-index": 0,
            } as React.CSSProperties}
            onClick={() => onNavigate("deck")}
          >
            <h2 style={{ margin: 0 }}>Deck Builder</h2>
            <p style={{ color: "var(--muted)", margin: "0.25rem 0" }}>
              Pure-count GM deck controls with offline storage, separate from player data.
            </p>
          </button>
          <button
            className="hub-card"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "1rem",
              background: "var(--surface)",
              minHeight: 126,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              textAlign: "center",
              cursor: "pointer",
              "--card-index": 1,
            } as React.CSSProperties}
            onClick={() => onNavigate("ops")}
          >
            <h2 style={{ margin: 0 }}>Deck Ops</h2>
            <p style={{ color: "var(--muted)", margin: "0.25rem 0" }}>
              Minimal deck operations for live sessions — draw, shuffle, and manage discard.
            </p>
          </button>
          <button
            className="hub-card"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "1rem",
              background: "var(--surface)",
              minHeight: 126,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              textAlign: "center",
              cursor: "pointer",
              "--card-index": 2,
            } as React.CSSProperties}
            onClick={() => onNavigate("combat")}
          >
            <h2 style={{ margin: 0 }}>Combat Tracker</h2>
            <p style={{ color: "var(--muted)", margin: "0.25rem 0" }}>
              Track readiness order, HP, WT, and status effects for all combatants.
            </p>
          </button>
        </div>
      </div>
    </main>
  </GMShell>
);

// ── Root component ────────────────────────────────────────────────────────────

const GM_STORAGE_KEY = "collapse.deck-builder.gm.v1";
const GM_EXPORT_PREFIX = "collapse-gm-deck";

export default function GMApp() {
  const [route, setRoute] = useState<GMRoute>(() => deriveGMRoute());

  useEffect(() => {
    const syncRoute = () => setRoute(deriveGMRoute());
    syncRoute();
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const desiredHash =
      route === "deck"   ? "#/deck"   :
      route === "ops"    ? "#/ops"    :
      route === "combat" ? "#/combat" :
      "#/hub";
    if (window.location.hash !== desiredHash) {
      window.location.hash = desiredHash;
    }
  }, [route]);

  const gmBaseCards = useMemo<Card[]>(() => [{ id: "gm-base-1", name: "Base", type: "Base" }], []);
  const gmModCards  = useMemo<Card[]>(() => [{ id: "gm-mod-1",  name: "Mod",  type: "Modifier", cost: 1 }], []);
  const gmNullCard  = useMemo<Card>(() => ({ id: "gm-null", name: "Null", type: "Null" }), []);

  if (route === "deck") {
    return (
      <GMShell onBack={() => setRoute("hub")} subtitle="Deck Builder">
        <CompanionIntro
          eyebrow="GM Companion"
          title="GM Deck & Table Tools"
          description="Pure-count GM deck controls with offline storage, separate from player data."
          helper="Use this to prep encounters, lock decks, and keep the GM pool isolated."
        />
        <DeckBuilder
          storageKey={GM_STORAGE_KEY}
          exportPrefix={GM_EXPORT_PREFIX}
          baseCardsOverride={gmBaseCards}
          modCardsOverride={gmModCards}
          nullCardOverride={gmNullCard}
          baseTarget={15}
          minNulls={5}
          modifierCapacityDefault={10}
          showCardDetails={false}
          simpleCounters={true}
          modCapacityAsCount={true}
          showOpsSections={false}
          showModifierCards={true}
          showModifierCapacity={false}
          showBaseCounters={true}
        />
      </GMShell>
    );
  }

  if (route === "ops") {
    return (
      <GMShell onBack={() => setRoute("hub")} subtitle="Deck Ops">
        <CompanionIntro
          eyebrow="GM Deck Ops"
          title="Operational View"
          description="Minimal deck operations for live sessions, keeping the GM pool locked and quick to reach."
          helper="Builder sections stay hidden; use the dock to draw, shuffle, and manage discard."
        />
        <DeckBuilder
          storageKey={GM_STORAGE_KEY}
          exportPrefix={GM_EXPORT_PREFIX}
          baseCardsOverride={gmBaseCards}
          modCardsOverride={gmModCards}
          nullCardOverride={gmNullCard}
          baseTarget={15}
          minNulls={5}
          modifierCapacityDefault={10}
          showCardDetails={false}
          simpleCounters={true}
          modCapacityAsCount={true}
          showBuilderSections={false}
          showOpsSections={true}
          lockControlsInOps={false}
        />
      </GMShell>
    );
  }

  if (route === "combat") {
    return (
      <GMShell onBack={() => setRoute("hub")} subtitle="Combat Tracker">
        <GMCombatTracker />
      </GMShell>
    );
  }

  return <GMHub onNavigate={setRoute} />;
}

