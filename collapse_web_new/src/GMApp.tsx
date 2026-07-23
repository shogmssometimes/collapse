import React, { useEffect, useMemo, useState } from "react";
import DeckBuilder from "./pages/DeckBuilder";
import GMCombatTracker from "./pages/GMCombatTracker";
import { Card } from "./domain/decks/DeckEngine";
import { parseHashRoute } from "./utils/routing";
import { DiceDock, DiceIcon, DICE_OPEN_EVENT } from "./components/DiceRoller";

// ── Types ────────────────────────────────────────────────────────────────────

type GMRoute = "hub" | "deck" | "ops" | "combat";

// ── Route helpers ────────────────────────────────────────────────────────────

const deriveGMRoute = (): GMRoute => {
  const { segment, sub } = parseHashRoute();
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
    <DiceDock />
    <header className="topbar" style={{ position: "relative" }}>
      {onBack && (
        <button className="ghost-btn ghost-btn-icon" onClick={onBack} aria-label="Back to hub">
          <span aria-hidden="true">←</span>
        </button>
      )}
      <button
        className="ghost-btn ghost-btn-icon"
        onClick={() => window.dispatchEvent(new Event(DICE_OPEN_EVENT))}
        aria-label="Open dice roller"
        style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.65)" }}
      >
        <DiceIcon size={18} />
      </button>
      <div className="topbar-title">
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
}> = ({ title }) => (
  <div className="page">
    <div className="page-header">
      <div>
        <h1 style={{ margin: 0, fontSize: '2rem' }}>{title}</h1>
      </div>
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
            <h2 style={{ margin: 0, fontSize: '1.6rem' }}>Deck Builder</h2>
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
            <h2 style={{ margin: 0, fontSize: '1.6rem' }}>Deck Ops</h2>
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
            <h2 style={{ margin: 0, fontSize: '1.6rem' }}>Combat Tracker</h2>
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
  const gmActionCards   = useMemo<Card[]>(() => [{ id: "gm-action-1",   name: "Action",   type: "Action" }], []);
  const gmReactionCards = useMemo<Card[]>(() => [{ id: "gm-reaction-1", name: "Reaction", type: "Reaction" }], []);

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
          actionCardsOverride={gmActionCards}
          reactionCardsOverride={gmReactionCards}
          showActionReactionCards={true}
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
          syncWithChud={false}
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
          actionCardsOverride={gmActionCards}
          reactionCardsOverride={gmReactionCards}
          showActionReactionCards={true}
          baseTarget={15}
          minNulls={5}
          modifierCapacityDefault={10}
          showCardDetails={false}
          simpleCounters={true}
          modCapacityAsCount={true}
          showBuilderSections={false}
          showOpsSections={true}
          lockControlsInOps={false}
          syncWithChud={false}
          independentPlay={true}
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

