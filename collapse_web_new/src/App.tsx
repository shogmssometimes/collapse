import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckBuilder from "./pages/DeckBuilder";
import GearPage from "./pages/Gear";
import CombatPage from "./pages/Combat";
import NotesPage from "./pages/Notes";
import CharMgmt, { CHAR_SWITCH_EVENT } from "./pages/CharMgmt";
import ProfilePage from "./pages/Profile";
import { deckBuilderKey, gearSlotsKey, wardrobeKey, chudStateKey, notesKey, profileKey } from "./utils/slotKeys";

const CHAR_ACTIVE_KEY = 'collapse.char.active';
function readActiveCharSlot(): number {
  if (typeof window === 'undefined') return 1;
  const raw = window.localStorage.getItem(CHAR_ACTIVE_KEY);
  const n = raw ? parseInt(raw, 10) : 1;
  return isNaN(n) || n < 1 || n > 3 ? 1 : n;
}

type Route = "hub" | "player" | "player-ops" | "chud" | "csmatrix" | "gear" | "combat" | "notes" | "char-mgmt" | "profile";
type HubCard = {
  id: Route;
  title: string;
  description: string;
};

const buildPath = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const deriveRoute = (): Route => {
  if (typeof window === "undefined") return "hub";
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [segment, sub] = hash.split(/[\/?]/);
  if (segment === "player") {
    if (sub === "ops") return "player-ops";
    return "player";
  }
  if (segment === "chud") return "chud";
  if (segment === "csmatrix") return "csmatrix";
  if (segment === "gear") return "gear";
  if (segment === "combat") return "combat";
  if (segment === "notes") return "notes";
  if (segment === "char-mgmt") return "char-mgmt";
  if (segment === "profile") return "profile";
  return "hub";
};

const SubAppFrame: React.FC<{ title: string; src: string; onBack: () => void; actions?: React.ReactNode; actionsClassName?: string; frameRef?: React.Ref<HTMLIFrameElement>; onFrameLoad?: () => void }> = ({
  title,
  src,
  onBack,
  actions,
  actionsClassName,
  frameRef,
  onFrameLoad,
}) => (
  <main className="route-view" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
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

const ChudDock: React.FC<{ basePath: string; charSlot?: number }> = ({ basePath, charSlot = 1 }) => {
  const [open, setOpen] = React.useState(false);
  const vibrate = (pattern: number = 10) => {
    if (typeof navigator !== "undefined" && typeof (navigator as any).vibrate === "function") {
      (navigator as any).vibrate(pattern);
    }
  };
  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("chud-open", handler as EventListener);
    return () => window.removeEventListener("chud-open", handler as EventListener);
  }, []);
  React.useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [open]);
  return (
    <>
      <button className="chud-fab" onClick={() => setOpen(true)} aria-label="Open cHUD overlay">
        cHUD
      </button>
      {open && (
        <div
          className="chud-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="cHUD overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              vibrate();
              setOpen(false);
            }
          }}
        >
          <div className="chud-sheet">
            <div className="chud-sheet-header">
              <span>cHUD</span>
              <button
                className="chud-close"
                onClick={() => {
                  vibrate();
                  setOpen(false);
                }}
                aria-label="Close cHUD"
              >
                ✕
              </button>
            </div>
            <div className="chud-sheet-body">
              <iframe
                title="cHUD"
                src={`${basePath}chud/index.html?slot=${charSlot}`}
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
  onNavigate: (route: Route) => void;
}> = ({ onNavigate }) => {
  const cards = useMemo<HubCard[]>(() => [
    {
      id: "player",
      title: "Deck Builder",
      description: "Player-facing tools with deck builder and ops.",
    },
    {
      id: "player-ops",
      title: "Deck Ops",
      description: "Standalone deck operations for the player deck.",
    },
    {
      id: "csmatrix",
      title: "CS Matrix",
      description: "Campaign Support Matrix with draggable nodes.",
    },
    {
      id: "gear",
      title: "Wardrobe & Gear",
      description: "Browse equipment and items.",
    },
    {
      id: "combat",
      title: "Combat",
      description: "Combat tools and tracking.",
    },
    {
      id: "notes",
      title: "Notes",
      description: "Campaign notes and reminders.",
    },
    {
      id: "chud",
      title: "cHUD",
      description: "Compact HUD for derived stats.",
    },
    {
      id: "char-mgmt",
      title: "Character Management",
      description: "Manage up to 3 characters. Hot swap decks and export or import saves.",
    },
    {
      id: "profile",
      title: "Profile",
      description: "Character profile and background.",
    },
  ], []);

  return (
    <main className="hub-landing">
      <div className="hub-landing-content" style={{ width: "min(1100px, 100%)", padding: "1.25rem 1rem" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
          <a
            href={`${import.meta.env.BASE_URL}gm.html`}
            style={{ color: "var(--muted)", fontSize: "0.85rem", textDecoration: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.75rem" }}
          >
            Switch to GM →
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
          {cards.map((card, index) => (
            <button
              key={card.id}
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
              '--card-index': index,
              } as React.CSSProperties}
              onClick={() => onNavigate(card.id)}
            >
              <h2 style={{ margin: 0 }}>{card.title}</h2>
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
  const [charSlot, setCharSlot] = useState<number>(() => readActiveCharSlot());
  const matrixFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [matrixState, setMatrixState] = useState({ controlsOpen: false, nodesOpen: false });

  const chudDock = route !== "chud" ? <ChudDock basePath={buildPath("")} charSlot={charSlot} /> : null;
  const deckStorageKey = deckBuilderKey(charSlot);

  useEffect(() => {
    const handler = (e: Event) => {
      const slot = (e as CustomEvent<number>).detail;
      if (typeof slot === 'number') setCharSlot(slot);
    };
    window.addEventListener(CHAR_SWITCH_EVENT, handler);
    return () => window.removeEventListener(CHAR_SWITCH_EVENT, handler);
  }, []);

  useEffect(() => {
    const syncRoute = () => setRoute(deriveRoute());
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
    const expectedOrigin = window.location.origin && window.location.origin !== "null" ? window.location.origin : "*";
    const handleMessage = (event: MessageEvent) => {
      if (expectedOrigin !== "*" && event.origin !== expectedOrigin) return;
      const data = event.data;
      if (!data) return;
      if (data.type === "collapse-csmatrix-state") {
        setMatrixState({
          controlsOpen: Boolean(data.controlsOpen),
          nodesOpen: Boolean(data.nodesOpen),
        });
      }
      if (data.type === "collapse-navigate" && typeof data.route === "string") {
        setRoute(data.route as Route);
      }
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
        case "player":    return "#/player";
        case "player-ops": return "#/player/ops";
        case "chud":      return "#/chud";
        case "csmatrix":  return "#/csmatrix";
        case "gear":      return "#/gear";
        case "combat":    return "#/combat";
        case "char-mgmt": return "#/char-mgmt";
        case "profile":   return "#/profile";
        default:          return "#/hub";
      }
    })();
    if (window.location.hash !== desiredHash) {
      window.location.hash = desiredHash;
    }
  }, [route]);

  if (route === "player") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock}>
        <DeckBuilder
          key={`player-${charSlot}`}
          storageKey={deckStorageKey}
          chudStateStorageKey={chudStateKey(charSlot)}
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
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock}>
        <DeckBuilder
          key={`player-ops-${charSlot}`}
          storageKey={deckStorageKey}
          chudStateStorageKey={chudStateKey(charSlot)}
          showBuilderSections={false}
          showOpsSections={true}
          lockControlsInOps={false}
        />
      </PlayerShell>
    );
  }

  if (route === "chud") {
    return (
      <SubAppFrame
        key={route}
        title="cHUD — Compact HUD"
        src={`${buildPath("")}chud/index.html?slot=${charSlot}`}
        onBack={() => setRoute("hub")}
      />
    );
  }

  if (route === "csmatrix") {
    return (
      <SubAppFrame
        key={route}
        title="CS Matrix"
        src={buildPath("csmatrix/index.html")}
        onBack={() => setRoute("hub")}
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
          </>
        }
        frameRef={matrixFrameRef}
        onFrameLoad={requestMatrixState}
      />
    );
  }

  if (route === "notes") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock}>
        <NotesPage key={`notes-${charSlot}`} storageKey={notesKey(charSlot)} />
      </PlayerShell>
    );
  }

  if (route === "gear") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock}>
        <GearPage
          key={`gear-${charSlot}`}
          gearSlotsStorageKey={gearSlotsKey(charSlot)}
          wardrobeStorageKey={wardrobeKey(charSlot)}
          chudStateStorageKey={chudStateKey(charSlot)}
        />
      </PlayerShell>
    );
  }

  if (route === "combat") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock}>
        <CombatPage />
      </PlayerShell>
    );
  }

  if (route === "char-mgmt") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock}>
        <CharMgmt />
      </PlayerShell>
    );
  }

  if (route === "profile") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock}>
        <ProfilePage key={`profile-${charSlot}`} storageKey={profileKey(charSlot)} charSlot={charSlot} />
      </PlayerShell>
    );
  }

  return (
    <>
      {chudDock}
      <HubLanding onNavigate={(next) => setRoute(next)} />
    </>
  );
}
