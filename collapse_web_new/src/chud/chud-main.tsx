import React from "react";
import { createRoot } from "react-dom/client";
import Chud from "./Chud";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Chud />
  </React.StrictMode>
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // CHUD is served from /chud/, while sw.js lives one level up.
    const swPath = new URL("../sw.js", window.location.href).pathname;
    navigator.serviceWorker.register(swPath).catch((error) => {
      console.error("Service worker registration failed", error);
    });
  });
}
