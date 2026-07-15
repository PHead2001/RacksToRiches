import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { StoreProvider } from "./app/storeContext";
import {
  WebFileTransfer,
  WebFullscreenCapability,
  WebOptionsRepository,
  WebSaveRepository,
  browserClock,
  browserScheduler,
} from "./platform";
import { GameRuntime } from "./runtime";
import { createGameStore } from "./store";
import "./styles.css";

function renderFatal(root: HTMLElement, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  root.innerHTML = `
    <main class="fatal-screen">
      <section class="panel fatal-card" role="alert">
        <p class="eyebrow">BOOT FAILURE</p>
        <h1>Racks to Riches could not start.</h1>
        <p>Your saves have not been erased. Reload the page, or copy this error for support.</p>
        <pre></pre>
        <button type="button" data-reload>Reload</button>
      </section>
    </main>`;
  const pre = root.querySelector("pre");
  if (pre !== null) pre.textContent = message;
  root.querySelector("[data-reload]")?.addEventListener("click", () => {
    window.location.reload();
  });
}

const rootElement = document.querySelector<HTMLElement>("#root");

if (rootElement === null) {
  throw new Error("Application root is missing");
}

try {
  const saves = new WebSaveRepository(window.localStorage);
  const options = new WebOptionsRepository(window.localStorage);
  const files = new WebFileTransfer();
  const fullscreen = new WebFullscreenCapability();
  const store = createGameStore({
    saves,
    options,
    files,
    fullscreen,
    clock: browserClock,
  });
  const runtime = new GameRuntime({
    clock: browserClock,
    scheduler: browserScheduler,
    getSession: () => {
      const state = store.getState();
      if (state.gameState === null || state.screen !== "game") return null;
      return {
        state: state.gameState,
        paused: state.paused || state.pauseMenuOpen,
        speed: state.speed,
        freezeExpenses: state.freezeExpenses,
        autosaveEnabled: state.options.autosaveEnabled,
        autosaveIntervalSeconds: state.options.autosaveIntervalSeconds,
      };
    },
    setState: (state) => {
      store.getState().setRuntimeState(state);
    },
    autosave: async () => {
      await store.getState().saveNow();
    },
    onError: (error) => {
      store.getState().recordError(error, "runtime");
    },
  });

  createRoot(rootElement).render(
    <StrictMode>
      <StoreProvider store={store}>
        <ErrorBoundary
          diagnosticReport={() => store.getState().diagnosticReport()}
          onError={(error) => {
            store.getState().recordError(error, "react");
          }}
          onReturnToMenu={() => {
            void store.getState().returnToMenu(true);
          }}
          onExport={() => {
            const slot = store.getState().activeSlot;
            if (slot !== null) void store.getState().exportSlot(slot);
          }}
        >
          <App runtime={runtime} />
        </ErrorBoundary>
      </StoreProvider>
    </StrictMode>,
  );
} catch (error: unknown) {
  renderFatal(rootElement, error);
}
