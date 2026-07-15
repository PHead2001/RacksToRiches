import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#root");

if (root === null) {
  throw new Error("Application root is missing");
}

createRoot(root).render(
  <StrictMode>
    <main>
      <h1>Racks to Riches</h1>
      <p>Phase 1 simulation foundation</p>
    </main>
  </StrictMode>,
);
