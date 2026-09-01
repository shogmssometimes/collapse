import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckBuilder from "./pages/DeckBuilder";
import GearPage from "./pages/Gear";
import CombatPage from "./pages/Combat";
import NotesPage from "./pages/Notes";
import CharMgmt, { CHAR_SWITCH_EVENT } from "./pages/CharMgmt";
import ProfilePage from "./pages/Profile";
import AagPage from "./pages/Aag";
import MgrPage from "./pages/Mgr";
import { deckBuilderKey, gearSlotsKey, wardrobeKey, chudStateKey, notesKey, profileKey, CHAR_ACTIVE_KEY } from "./utils/slotKeys";
import { parseHashRoute } from "./utils/routing";
import { DiceDock, DiceIcon, DICE_OPEN_EVENT } from "./components/DiceRoller";

function readActiveCharSlot(): number {
  if (typeof window === 'undefined') return 1;
  const raw = window.localStorage.getItem(CHAR_ACTIVE_KEY);
  const n = raw ? parseInt(raw, 10) : 1;
  return isNaN(n) || n < 1 || n > 3 ? 1 : n;
}

type Route = "hub" | "player" | "player-ops" | "chud" | "csmatrix" | "gear" | "combat" | "notes" | "char-mgmt" | "profile" | "aag" | "mgr";
type HubCard = {
  id: Route;
  title: string;
  description: string;
};

const buildPath = (path: string) => `${import.meta.env.BASE_URL}${path}`;

const BACK_LONG_PRESS_MS = 600;

// Back button: a quick tap fires onBack (go to the previous page in the
// current flow); a long-press fires onGoHome (jump straight to the hub).
const BackButton: React.FC<{ onBack: () => void; onGoHome: () => void }> = ({ onBack, onGoHome }) => {
  const timerRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    firedRef.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      firedRef.current = true;
      onGoHome();
    }, BACK_LONG_PRESS_MS);
  };

  const handlePointerUp = () => {
    clearTimer();
  };

  const handleClick = () => {
    if (firedRef.current) {
      firedRef.current = false;
      return;
    }
    onBack();
  };

  return (
    <button
      className="ghost-btn ghost-btn-icon"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-label="Back (hold for main menu)"
    >
      <span aria-hidden="true">←</span>
    </button>
  );
};

const deriveRoute = (): Route => {
  const { segment, sub } = parseHashRoute();
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
  if (segment === "aag") return "aag";
  if (segment === "mgr") return "mgr";
  return "hub";
};

const SubAppFrame: React.FC<{ title: string; src: string; onBack: () => void; onGoHome?: () => void; actions?: React.ReactNode; actionsClassName?: string; frameRef?: React.Ref<HTMLIFrameElement>; onFrameLoad?: () => void }> = ({
  title,
  src,
  onBack,
  onGoHome,
  actions,
  actionsClassName,
  frameRef,
  onFrameLoad,
}) => (
  <>
  <DiceDock />
  <main className="route-view" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
    <header className="topbar" style={{ position: 'relative' }}>
      <BackButton onBack={onBack} onGoHome={onGoHome ?? onBack} />
      <button className="ghost-btn ghost-btn-icon" onClick={() => window.dispatchEvent(new Event(DICE_OPEN_EVENT))} aria-label="Open dice roller" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.65)' }}>
        <DiceIcon size={18} />
      </button>
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
  </>
);

const PlayerShell: React.FC<{ onBack: () => void; onGoHome?: () => void; children: React.ReactNode; chudDock?: React.ReactNode; actions?: React.ReactNode; hideHud?: boolean; onOpenHud?: () => void }> = ({ onBack, onGoHome, children, chudDock, actions, hideHud, onOpenHud }) => {
  const openChud = () => {
    if (onOpenHud) {
      onOpenHud();
      return;
    }
    if (typeof window !== "undefined") window.dispatchEvent(new Event("chud-open"));
  };
  return (
  <div className="player-shell" style={{ minHeight: "100vh", background: "var(--bg-dark)" }}>
    <DiceDock />
    <header className="topbar" style={{ position: 'relative' }}>
      <BackButton onBack={onBack} onGoHome={onGoHome ?? onBack} />
      <button className="ghost-btn ghost-btn-icon" onClick={() => window.dispatchEvent(new Event(DICE_OPEN_EVENT))} aria-label="Open dice roller" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.65)' }}>
        <DiceIcon size={18} />
      </button>
      <div className="topbar-actions">
        {!hideHud && (
          <button className="chud-top-btn" onClick={openChud} aria-label="Open HUD overlay">HUD</button>
        )}
        {actions}
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
      <button className="chud-fab" onClick={() => setOpen(true)} aria-label="Open HUD overlay">
        HUD
      </button>
      {open && (
        <div
          className="chud-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="HUD overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              vibrate();
              setOpen(false);
            }
          }}
        >
          <div className="chud-sheet">
            <div className="chud-sheet-header">
              <span>HUD</span>
              <button
                className="chud-close"
                onClick={() => {
                  vibrate();
                  setOpen(false);
                }}
                aria-label="Close HUD"
              >
                ✕
              </button>
            </div>
            <div className="chud-sheet-body">
              <iframe
                title="HUD"
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

const HUB_CARD_DEFS: HubCard[] = [
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
    title: "HUD",
    description: "Compact HUD for derived stats.",
  },
  {
    id: "char-mgmt",
    title: "Character Management",
    description: "Manage up to 3 characters. Hot swap decks and export or import saves.",
  },
  {
    id: "profile",
    title: "Bio Card",
    description: "Character profile and background.",
  },
];

type HubOrderMode = "build" | "play" | "custom";
const HUB_MODE_KEY = "hub.order.mode.v1";
const HUB_CUSTOM_ORDER_KEY = "hub.order.custom.v1";

const HUB_BUILD_ORDER: Route[] = ["csmatrix", "gear", "chud", "combat", "player", "profile", "char-mgmt", "player-ops", "notes"];
const HUB_PLAY_ORDER: Route[] = ["chud", "player-ops", "csmatrix", "gear", "combat", "player", "notes", "profile", "char-mgmt"];

function orderCards(order: Route[]): HubCard[] {
  const byId = new Map(HUB_CARD_DEFS.map(c => [c.id, c]));
  const ordered = order.map(id => byId.get(id)).filter((c): c is HubCard => !!c);
  // Include any cards missing from the order list (safety net for future additions)
  const seen = new Set(ordered.map(c => c.id));
  for (const c of HUB_CARD_DEFS) if (!seen.has(c.id)) ordered.push(c);
  return ordered;
}

function loadHubMode(): HubOrderMode {
  try {
    const raw = localStorage.getItem(HUB_MODE_KEY);
    if (raw === "build" || raw === "play" || raw === "custom") return raw;
  } catch {}
  return "build";
}

function loadCustomOrder(): Route[] {
  try {
    const raw = localStorage.getItem(HUB_CUSTOM_ORDER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Route[];
    }
  } catch {}
  return HUB_CARD_DEFS.map(c => c.id);
}

const HubLanding: React.FC<{
  onNavigate: (route: Route) => void;
}> = ({ onNavigate }) => {
  const [mode, setMode] = useState<HubOrderMode>(() => loadHubMode());
  const [customOrder, setCustomOrder] = useState<Route[]>(() => loadCustomOrder());
  const [dragId, setDragId] = useState<Route | null>(null);
  const [dragOverId, setDragOverId] = useState<Route | null>(null);
  const cardRefs = useRef<Map<Route, HTMLButtonElement>>(new Map());
  const dragMovedRef = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(HUB_MODE_KEY, mode); } catch {}
  }, [mode]);

  useEffect(() => {
    try { localStorage.setItem(HUB_CUSTOM_ORDER_KEY, JSON.stringify(customOrder)); } catch {}
  }, [customOrder]);

  const cards = useMemo<HubCard[]>(() => {
    if (mode === "build") return orderCards(HUB_BUILD_ORDER);
    if (mode === "play") return orderCards(HUB_PLAY_ORDER);
    return orderCards(customOrder);
  }, [mode, customOrder]);

  const reorderCustom = useCallback((fromId: Route, toId: Route) => {
    if (fromId === toId) return;
    setCustomOrder(prev => {
      const next = [...prev];
      const fromIdx = next.indexOf(fromId);
      const toIdx = next.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromId);
      return next;
    });
  }, []);

  // Pointer-based drag reordering (works on touch and mouse, unlike HTML5 drag-and-drop
  // which iOS Safari does not support).
  const findCardIdAtPoint = useCallback((x: number, y: number): Route | null => {
    for (const [id, el] of cardRefs.current) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return id;
    }
    return null;
  }, []);

  const handlePointerDown = useCallback((cardId: Route) => (e: React.PointerEvent) => {
    dragMovedRef.current = false;
    if (mode !== "custom") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragId(cardId);
  }, [mode]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (mode !== "custom" || !dragId) return;
    dragMovedRef.current = true;
    const overId = findCardIdAtPoint(e.clientX, e.clientY);
    setDragOverId(overId);
  }, [mode, dragId, findCardIdAtPoint]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (mode !== "custom" || !dragId) return;
    const overId = findCardIdAtPoint(e.clientX, e.clientY);
    if (overId) reorderCustom(dragId, overId);
    setDragId(null);
    setDragOverId(null);
  }, [mode, dragId, findCardIdAtPoint, reorderCustom]);

  return (
    <>
    <main className="hub-landing">
      <div className="hub-landing-content" style={{ width: "min(1100px, 100%)", padding: "1.25rem 1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <button
            className="ghost-btn ghost-btn-icon"
            onClick={() => window.dispatchEvent(new Event(DICE_OPEN_EVENT))}
            aria-label="Open dice roller"
            style={{ color: "var(--muted)" }}
          >
            <DiceIcon size={18} />
          </button>
          <a
            href={`${import.meta.env.BASE_URL}gm.html`}
            style={{ color: "var(--muted)", fontSize: "0.85rem", textDecoration: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.75rem" }}
          >
            Switch to GM →
          </a>
        </div>
        <div
          role="group"
          aria-label="Hub link order"
          style={{
            display: "inline-flex",
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            marginBottom: "0.75rem",
          }}
        >
          {(["build", "play", "custom"] as HubOrderMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "0.4rem 1rem",
                fontSize: "0.8rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontFamily: "var(--font-display)",
                border: "none",
                cursor: "pointer",
                background: mode === m ? "var(--accent)" : "transparent",
                color: mode === m ? "#000" : "var(--muted)",
              }}
            >
              {m}
            </button>
          ))}
        </div>
        {mode === "custom" && (
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0 0 0.5rem" }}>
            Tap and drag a card to reorder.
          </p>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            marginTop: "0.6rem",
          }}
        >
          {cards.map((card, index) => {
            const isCustom = mode === "custom";
            const isDragging = dragId === card.id;
            const isDragOver = isCustom && dragOverId === card.id && dragId !== card.id;
            return (
              <button
                key={card.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(card.id, el);
                  else cardRefs.current.delete(card.id);
                }}
                className="hub-card"
                onPointerDown={handlePointerDown(card.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => { setDragId(null); setDragOverId(null); }}
                style={{
                  border: `1px solid ${isDragOver ? "var(--accent)" : "var(--border)"}`,
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
                  cursor: isCustom ? "grab" : "pointer",
                  opacity: isDragging ? 0.5 : 1,
                  touchAction: isCustom ? "none" : "auto",
                  transition: "opacity 0.15s, border-color 0.15s",
                '--card-index': index,
                } as React.CSSProperties}
                onClick={() => { if (!isCustom && !dragMovedRef.current) onNavigate(card.id); }}
              >
                <h2 style={{ margin: 0, fontSize: '1.6rem' }}>{card.title}</h2>
              </button>
            );
          })}
        </div>
      </div>
    </main>
    </>
  );
};

export default function App() {
  const [route, setRoute] = useState<Route>(() => deriveRoute());
  const [hudReturnRoute, setHudReturnRoute] = useState<Route>("hub");
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
        case "aag":       return "#/aag";
        case "mgr":       return "#/mgr";
        default:          return "#/hub";
      }
    })();
    if (window.location.hash !== desiredHash) {
      window.location.hash = desiredHash;
    }
  }, [route]);

  if (route === "player") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock} onOpenHud={() => { setHudReturnRoute(route); setRoute("chud"); }}>
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
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock} onOpenHud={() => { setHudReturnRoute(route); setRoute("chud"); }}>
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
        title="HUD"
        src={`${buildPath("")}chud/index.html?slot=${charSlot}`}
        onBack={() => setRoute(hudReturnRoute)}
        onGoHome={() => setRoute("hub")}
        actions={
          <button className="topbar-square-btn" onClick={() => setRoute("aag")}>
            AAG
          </button>
        }
      />
    );
  }

  if (route === "aag") {
    return (
      <PlayerShell
        key={route}
        onBack={() => setRoute("chud")}
        onGoHome={() => setRoute("hub")}
        chudDock={chudDock}
        hideHud
        actions={
          <button className="topbar-square-btn" onClick={() => setRoute("chud")} aria-label="Close AAG">
            XAAG
          </button>
        }
      >
        <AagPage
          key={`aag-${charSlot}`}
          chudStateStorageKey={chudStateKey(charSlot)}
          gearSlotsStorageKey={gearSlotsKey(charSlot)}
          onOpenMgr={() => setRoute("mgr")}
        />
      </PlayerShell>
    );
  }

  if (route === "mgr") {
    return (
      <PlayerShell
        key={route}
        onBack={() => setRoute("aag")}
        onGoHome={() => setRoute("hub")}
        chudDock={chudDock}
        hideHud
        actions={
          <button className="topbar-square-btn" onClick={() => setRoute("chud")} aria-label="Close AAG">
            XAAG
          </button>
        }
      >
        <MgrPage chudStateStorageKey={chudStateKey(charSlot)} onCloseMgr={() => setRoute("aag")} />
      </PlayerShell>
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
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock} onOpenHud={() => { setHudReturnRoute(route); setRoute("chud"); }}>
        <NotesPage key={`notes-${charSlot}`} storageKey={notesKey(charSlot)} />
      </PlayerShell>
    );
  }

  if (route === "gear") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock} onOpenHud={() => { setHudReturnRoute(route); setRoute("chud"); }}>
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
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock} onOpenHud={() => { setHudReturnRoute(route); setRoute("chud"); }}>
        <CombatPage />
      </PlayerShell>
    );
  }

  if (route === "char-mgmt") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock} onOpenHud={() => { setHudReturnRoute(route); setRoute("chud"); }}>
        <CharMgmt />
      </PlayerShell>
    );
  }

  if (route === "profile") {
    return (
      <PlayerShell key={route} onBack={() => setRoute("hub")} chudDock={chudDock} onOpenHud={() => { setHudReturnRoute(route); setRoute("chud"); }}>
        <ProfilePage key={`profile-${charSlot}`} storageKey={profileKey(charSlot)} charSlot={charSlot} />
      </PlayerShell>
    );
  }

  return (
    <>
      <DiceDock />
      {chudDock}
      <HubLanding onNavigate={(next) => { setHudReturnRoute("hub"); setRoute(next); }} />
    </>
  );
}
