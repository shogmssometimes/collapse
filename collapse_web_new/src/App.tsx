import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckBuilder from "./pages/DeckBuilder";
import { Card } from "./domain/decks/DeckEngine";

type Mode = "player" | "gm";
type Route = "hub" | "player" | "player-ops" | "gm" | "gm-ops" | "chud" | "csmatrix";
type HubCard = {
  id: Route;
  title: string;
  description: string;
  audience: Mode;
  subtitle?: string;
};

const MODE_KEY = "collapse.mode";
const buildPath = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const deriveRoute = (): Route => {
  if (typeof window === "undefined") return "hub";
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [segment, sub] = hash.split(/[\/?]/);
  if (segment === "player") {
    if (sub === "ops") return "player-ops";
    return "player";
  }
  if (segment === "gm") {
    if (sub === "ops") return "gm-ops";
    return "gm";
  }
  if (segment === "chud") return "chud";
  if (segment === "csmatrix") return "csmatrix";
  return "hub";
};

const deriveMode = (): Mode => {
  if (typeof window === "undefined") return "player";
  const saved = window.localStorage.getItem(MODE_KEY) as Mode | null;
  const route = deriveRoute();
  if (route === "gm" || route === "gm-ops") return "gm";
  if (route === "player" || route === "player-ops" || route === "chud" || route === "csmatrix") return "player";
  return saved ?? "player";
};

const SubAppFrame: React.FC<{ title: string; src: string; onBack: () => void; note?: string; actions?: React.ReactNode; actionsClassName?: string; frameRef?: React.Ref<HTMLIFrameElement>; onFrameLoad?: () => void }> = ({
  title,
  src,
  onBack,
  note,
  actions,
  actionsClassName,
  frameRef,
  onFrameLoad,
}) => (
  <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
    <header className="topbar">
      <button className="ghost-btn ghost-btn-icon" onClick={onBack} aria-label="Back to hub">
        <span aria-hidden="true">←</span>
      </button>
      <div className="topbar-title">
        <div className="muted" style={{ fontSize: "0.85rem" }}>Collapse Full Build</div>
        <strong>{title}</strong>
      </div>
      {actions ? <div className={actionsClassName || "topbar-actions"}>{actions}</div> : null}
    </header>
    <div className="subapp-frame">
      <iframe
        title={title}
        src={src}
        ref={frameRef}
        onLoad={onFrameLoad}
        style={{ border: "none" }}
        allow="fullscreen"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-pointer-lock"
      />
    </div>
  </main>
);

const PlayerShell: React.FC<{ onBack: () => void; children: React.ReactNode; chudDock?: React.ReactNode }> = ({ onBack, children, chudDock }) => {
  const openChud = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("chud-open"));
  };
  return (
  <div className="player-shell" style={{ minHeight: "100vh", background: "var(--bg-dark)" }}>
    <header className="topbar">
      <button className="ghost-btn ghost-btn-icon" onClick={onBack} aria-label="Back to hub">
        <span aria-hidden="true">←</span>
      </button>
      <div className="topbar-title">
        <div className="muted" style={{ fontSize: "0.85rem" }}>Collapse Full Build</div>
        <strong>Collapse Companion</strong>
      </div>
      <div className="topbar-actions">
        <button className="chud-top-btn" onClick={openChud} aria-label="Open cHUD overlay">cHUD</button>
      </div>
    </header>
    {chudDock}
    {children}
  </div>
  );
};

const GMShell: React.FC<{ onBack: () => void; children: React.ReactNode; chudDock?: React.ReactNode; style?: React.CSSProperties }> = ({ onBack, children, chudDock, style }) => {
  const openChud = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("chud-open"));
  };
  return (
  <div className="gm-shell" style={{ minHeight: "100vh", background: "var(--bg-dark)", ...style }}>
    <header className="topbar">
      <button className="ghost-btn ghost-btn-icon" onClick={onBack} aria-label="Back to hub">
        <span aria-hidden="true">←</span>
      </button>
      <div className="topbar-title">
        <div className="muted" style={{ fontSize: "0.85rem" }}>Collapse GM Companion</div>
        <strong>GM Tools</strong>
      </div>
      <div className="topbar-actions">
        <button className="chud-top-btn" onClick={openChud} aria-label="Open cHUD overlay">cHUD</button>
      </div>
    </header>
    {chudDock}
    {children}
  </div>
  );
};

const CompanionIntro: React.FC<{ eyebrow: string; title: string; description: string; helper?: string }> = ({
  eyebrow,
  title,
  description,
  helper,
}) => (
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

const ChudDock: React.FC<{ basePath: string }> = ({ basePath }) => {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("chud-open", handler as EventListener);
    return () => window.removeEventListener("chud-open", handler as EventListener);
  }, []);
  return (
    <>
      <button className="chud-fab" onClick={() => setOpen(true)} aria-label="Open cHUD overlay">
        cHUD
      </button>
      {open && (
        <div className="chud-overlay" role="dialog" aria-modal="true" aria-label="cHUD overlay">
          <div className="chud-sheet">
            <div className="chud-sheet-header">
              <span>cHUD</span>
              <button className="chud-close" onClick={() => setOpen(false)} aria-label="Close cHUD">✕</button>
            </div>
            <div className="chud-sheet-body">
              <iframe
                title="cHUD"
                src={`${basePath}chud/index.html`}
                allow="fullscreen"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-pointer-lock"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const HubLanding: React.FC<{
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onNavigate: (route: Route) => void;
}> = ({ mode, onModeChange, onNavigate }) => {
  const cards = useMemo<HubCard[]>(() => {
    const base: HubCard[] = [
      {
        id: "player",
        title: "Deck Builder",
        description: "Player-facing tools with deck builder and ops.",
        audience: "player",
      },
      {
        id: "player-ops",
        title: "Deck Ops",
        description: "Standalone deck operations for the player deck.",
        audience: "player",
      },
      {
        id: "gm",
        title: "Companion — GM",
        description: "GM-only deck tools with pure counts.",
        audience: "gm",
        subtitle: "GM",
      },
      {
        id: "gm-ops",
        title: "Deck Ops — GM",
        description: "Standalone deck operations for the GM deck.",
        audience: "gm",
        subtitle: "GM",
      },
      {
        id: "csmatrix",
        title: "CS Matrix",
        description: "Campaign Support Matrix with draggable nodes.",
        audience: "player",
      },
      {
        id: "chud",
        title: "cHUD",
        description: "Compact HUD for derived stats.",
        audience: "player",
      },
    ];
    return base.filter((c) => c.audience === mode);
  }, [mode]);

  return (
    <main className="hub-landing">
      <div className="hub-landing-content" style={{ width: "min(1100px, 100%)", padding: "1.25rem 1rem" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`mode-toggle ${mode === "player" ? "active" : ""}`}
              onClick={() => onModeChange("player")}
              aria-pressed={mode === "player"}
            >
              Player
            </button>
            <button
              className={`mode-toggle ${mode === "gm" ? "active" : ""}`}
              onClick={() => onModeChange("gm")}
              aria-pressed={mode === "gm"}
            >
              GM
            </button>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            marginTop: "1.1rem",
          }}
        >
          {cards.map((card) => (
            <button
              key={card.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 16,
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
              }}
              onClick={() => onNavigate(card.id)}
            >
              <h2 style={{ margin: 0 }}>{card.title}</h2>
              {card.subtitle ? (
                <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{card.subtitle}</span>
              ) : null}
              <p style={{ color: "var(--muted)", margin: "0.25rem 0" }}>{card.description}</p>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
};

export default function App() {
  const [route, setRoute] = useState<Route>(() => deriveRoute());
  const [mode, setMode] = useState<Mode>(() => deriveMode());
  const matrixFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [matrixState, setMatrixState] = useState({ controlsOpen: false, nodesOpen: false });

  const chudDock = route !== "chud" ? <ChudDock basePath={buildPath("")} /> : null;

  useEffect(() => {
    const syncRoute = () => {
      const nextRoute = deriveRoute();
      setRoute(nextRoute);
      if (nextRoute === "gm" || nextRoute === "gm-ops") {
        setMode("gm");
      } else if (nextRoute === "player" || nextRoute === "player-ops") {
        setMode("player");
      } else {
        const stored = (typeof window !== "undefined"
          ? (window.localStorage.getItem(MODE_KEY) as Mode | null)
          : null);
        if (stored) setMode(stored);
      }
    };
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
    window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const expectedOrigin = window.location.origin && window.location.origin !== "null" ? window.location.origin : "*";
    const handleMessage = (event: MessageEvent) => {
      if (expectedOrigin !== "*" && event.origin !== expectedOrigin) return;
      const data = event.data;
      if (!data || data.type !== "collapse-csmatrix-state") return;
      setMatrixState({
        controlsOpen: Boolean(data.controlsOpen),
        nodesOpen: Boolean(data.nodesOpen),
      });
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const postToMatrix = useCallback((action: "toggle-controls" | "toggle-nodes" | "request-state") => {
    if (typeof window === "undefined") return;
    const frameWin = matrixFrameRef.current?.contentWindow;
    if (!frameWin) return;
    const targetOrigin = window.location.origin && window.location.origin !== "null" ? window.location.origin : "*";
    frameWin.postMessage({ target: "csmatrix", action }, targetOrigin);
  }, []);

  const requestMatrixState = useCallback(() => {
    postToMatrix("request-state");
  }, [postToMatrix]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const desiredHash = (() => {
      switch (route) {
        case "player":
          return "#/player";
        case "player-ops":
          return "#/player/ops";
        case "gm":
          return "#/gm";
        case "gm-ops":
          return "#/gm/ops";
        case "chud":
          return "#/chud";
        case "csmatrix":
          return "#/csmatrix";
        default:
          return "#/hub";
      }
    })();
    if (window.location.hash !== desiredHash) {
      window.location.hash = desiredHash;
    }
  }, [route]);

  // GM deck overrides (simple counts)
  const gmBaseCards = useMemo<Card[]>(() => [{ id: "gm-base-1", name: "Base", type: "Base" }], []);
  const gmModCards = useMemo<Card[]>(() => [{ id: "gm-mod-1", name: "Mod", type: "Modifier", cost: 1 }], []);
  const gmNullCard = useMemo<Card>(() => ({ id: "gm-null", name: "Null", type: "Null" }), []);

  if (route === "player") {
    return (
      <PlayerShell onBack={() => setRoute("hub")} chudDock={chudDock}>
        <DeckBuilder
          showOpsSections={false}
          showModifierCards={true}
          showModifierCardCounter={false}
          showModifierCapacity={true}
          showBaseCounters={true}
          showBaseAdjusters={false}
        />
      </PlayerShell>
    );
  }

  if (route === "player-ops") {
    return (
      <PlayerShell onBack={() => setRoute("hub")} chudDock={chudDock}>
        <DeckBuilder
          storageKey="collapse.deck-builder.v2"
          showBuilderSections={false}
          showOpsSections={true}
          lockControlsInOps={false}
        />
      </PlayerShell>
    );
  }

  if (route === "gm") {
    return (
      <GMShell onBack={() => setRoute("hub")} chudDock={chudDock}>
        <CompanionIntro
          eyebrow="GM Companion"
          title="GM Deck & Table Tools"
          description="Pure-count GM deck controls with offline storage, separate from player data."
          helper="Use this to prep encounters, lock decks, and keep the GM pool isolated."
        />
        <DeckBuilder
          storageKey="collapse.deck-builder.gm.v1"
          exportPrefix="collapse-gm-deck"
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
        />
      </GMShell>
    );
  }

  if (route === "gm-ops") {
    return (
      <GMShell onBack={() => setRoute("hub")} chudDock={chudDock}>
        <CompanionIntro
          eyebrow="GM Deck Ops"
          title="Operational View"
          description="Minimal deck operations for live sessions, keeping the GM pool locked and quick to reach."
          helper="Builder sections stay hidden; use the dock to draw, shuffle, and manage discard."
        />
        <DeckBuilder
          storageKey="collapse.deck-builder.gm.v1"
          exportPrefix="collapse-gm-deck"
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

  if (route === "chud") {
    return (
      <SubAppFrame
        title="cHUD — Compact HUD"
        src={`${buildPath("")}chud/index.html`}
        onBack={() => setRoute("hub")}
        note="Loaded inside the fullbuild shell."
      />
    );
  }

  if (route === "csmatrix") {
    return (
      <SubAppFrame
        title="CS Matrix"
        src={buildPath("csmatrix/index.html")}
        onBack={() => setRoute("hub")}
        note="Campaign Support Matrix (in-app iframe)."
        actionsClassName="topbar-actions topbar-actions-stack"
        actions={
          <>
            <button
              className="topbar-pill"
              onClick={() => postToMatrix("toggle-controls")}
              aria-pressed={matrixState.controlsOpen}
            >
              {matrixState.controlsOpen ? "Hide Controls" : "Show Controls"}
            </button>
            <button
              className="topbar-pill"
              onClick={() => postToMatrix("toggle-nodes")}
              aria-pressed={matrixState.nodesOpen}
            >
              {matrixState.nodesOpen ? "Hide Nodes" : "Show Nodes"}
            </button>
          </>
        }
        frameRef={matrixFrameRef}
        onFrameLoad={requestMatrixState}
      />
    );
  }

  return (
    <>
      {chudDock}
      <HubLanding
        mode={mode}
        onModeChange={(next) => {
          setMode(next);
          setRoute("hub");
        }}
        onNavigate={(next) => {
          setRoute(next);
          setMode(next === "gm" || next === "gm-ops" ? "gm" : "player");
        }}
      />
    </>
  );
}
