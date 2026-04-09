import React from "react";
import { createRoot } from "react-dom/client";
import Chud from "./Chud";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Chud />
  </React.StrictMode>
);
