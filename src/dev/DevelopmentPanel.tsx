import { useEffect, useRef, useState, type PointerEvent } from "react";

import type { DevelopmentCommand } from "../store";
import { useAppStore } from "../app/storeContext";

interface Position {
  x: number;
  y: number;
}

const DEFAULT_POSITION: Position = { x: 24, y: 72 };

function CommandButton({
  command,
  children,
}: {
  command: DevelopmentCommand;
  children: string;
}) {
  const apply = useAppStore((state) => state.applyDevelopmentCommand);
  return <button onClick={() => apply(command)}>{children}</button>;
}

export default function DevelopmentPanel({ onClose }: { onClose: () => void }) {
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [minimized, setMinimized] = useState(false);
  const [cashAmount, setCashAmount] = useState("10000");
  const panel = useRef<HTMLElement>(null);
  const dragOffset = useRef<Position | null>(null);
  const gameState = useAppStore((state) => state.gameState);
  const activeSlot = useAppStore((state) => state.activeSlot);
  const screen = useAppStore((state) => state.screen);
  const saveStatus = useAppStore((state) => state.saveStatus);
  const speed = useAppStore((state) => state.speed);
  const paused = useAppStore((state) => state.paused);
  const freezeExpenses = useAppStore((state) => state.freezeExpenses);
  const developmentModified = useAppStore((state) => state.developmentModified);
  const developmentLog = useAppStore((state) => state.developmentLog);
  const errors = useAppStore((state) => state.errors);
  const undo = useAppStore((state) => state.undoDevelopmentCommand);
  const diagnosticReport = useAppStore((state) => state.diagnosticReport);
  const exportSlot = useAppStore((state) => state.exportSlot);
  const apply = useAppStore((state) => state.applyDevelopmentCommand);

  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      const offset = dragOffset.current;
      if (offset === null) return;
      const width = panel.current?.offsetWidth ?? 380;
      const height = panel.current?.offsetHeight ?? 180;
      setPosition({
        x: Math.max(
          0,
          Math.min(window.innerWidth - width, event.clientX - offset.x),
        ),
        y: Math.max(
          0,
          Math.min(window.innerHeight - height, event.clientY - offset.y),
        ),
      });
    };
    const stop = () => {
      dragOffset.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
  }, []);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    dragOffset.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
  };
  const parsedCash = Number(cashAmount);
  const cashValid = Number.isFinite(parsedCash) && parsedCash >= 0;
  const copyDiagnostics = async () =>
    navigator.clipboard.writeText(diagnosticReport());

  return (
    <aside
      ref={panel}
      className={`development-panel${minimized ? " minimized" : ""}`}
      style={{ left: position.x, top: position.y }}
      aria-label="Development and QA tools"
    >
      <div className="development-handle" onPointerDown={startDrag}>
        <strong>QA CONTROL DECK</strong>
        <span>drag handle</span>
        <div className="dev-window-actions">
          <button
            onClick={() => {
              setPosition(DEFAULT_POSITION);
            }}
          >
            Reset
          </button>
          <button
            onClick={() => {
              setMinimized((value) => !value);
            }}
          >
            {minimized ? "Expand" : "Minimize"}
          </button>
          <button onClick={onClose} aria-label="Close development panel">
            ×
          </button>
        </div>
      </div>
      {!minimized && (
        <div className="development-content">
          <section>
            <h2>Economy</h2>
            <label>
              Cash amount
              <input
                value={cashAmount}
                onChange={(event) => {
                  setCashAmount(event.target.value);
                }}
                inputMode="decimal"
              />
            </label>
            <div className="button-row">
              <button
                disabled={!cashValid}
                onClick={() => apply({ type: "add-cash", amount: parsedCash })}
              >
                Add cash
              </button>
              <button
                disabled={!cashValid}
                onClick={() => apply({ type: "set-cash", amount: parsedCash })}
              >
                Set cash
              </button>
              <CommandButton command={{ type: "add-reputation", amount: 25 }}>
                +25 reputation
              </CommandButton>
              <CommandButton command={{ type: "add-research", amount: 25 }}>
                +25 research
              </CommandButton>
              <CommandButton command={{ type: "toggle-expenses" }}>
                {freezeExpenses ? "Restore expenses" : "Freeze expenses"}
              </CommandButton>
            </div>
          </section>
          <section>
            <h2>Time</h2>
            <div className="button-row">
              <CommandButton command={{ type: "toggle-pause" }}>
                {paused ? "Resume" : "Pause"}
              </CommandButton>
              {([1, 5, 25, 100] as const).map((value) => (
                <CommandButton
                  key={value}
                  command={{ type: "set-speed", speed: value }}
                >{`${String(value)}×`}</CommandButton>
              ))}
              <CommandButton command={{ type: "advance", seconds: 60 }}>
                Advance 1 minute
              </CommandButton>
              <CommandButton command={{ type: "advance", seconds: 3600 }}>
                Advance 1 hour
              </CommandButton>
            </div>
          </section>
          <section>
            <h2>Contracts</h2>
            <div className="button-row">
              <CommandButton command={{ type: "generate-contract" }}>
                Generate starter offer
              </CommandButton>
              <CommandButton command={{ type: "complete-contract" }}>
                Complete active
              </CommandButton>
              <CommandButton command={{ type: "near-expiry" }}>
                Near expiry
              </CommandButton>
              <CommandButton command={{ type: "sla-violation" }}>
                Force SLA warning
              </CommandButton>
              <CommandButton command={{ type: "clear-offers" }}>
                Clear non-tutorial offers
              </CommandButton>
            </div>
          </section>
          <section>
            <h2>Scenarios</h2>
            <div className="button-row">
              <CommandButton command={{ type: "scenario", scenario: "fresh" }}>
                Fresh game
              </CommandButton>
              <CommandButton
                command={{ type: "scenario", scenario: "tutorial-ready" }}
              >
                Tutorial ready
              </CommandButton>
              <CommandButton
                command={{ type: "scenario", scenario: "tutorial-active" }}
              >
                Tutorial profitable
              </CommandButton>
              <CommandButton
                command={{ type: "scenario", scenario: "overloaded-power" }}
              >
                Overloaded power
              </CommandButton>
              <CommandButton
                command={{ type: "scenario", scenario: "insufficient-cooling" }}
              >
                Insufficient cooling
              </CommandButton>
              <CommandButton
                command={{ type: "scenario", scenario: "marketplace" }}
              >
                Marketplace unlocked
              </CommandButton>
              <CommandButton
                command={{ type: "scenario", scenario: "regional-metrics" }}
              >
                Regional UI stress
              </CommandButton>
            </div>
          </section>
          <section>
            <h2>Diagnostics</h2>
            <dl className="diagnostic-grid">
              <div>
                <dt>RNG seed</dt>
                <dd>{gameState?.rngSeed ?? "none"}</dd>
              </div>
              <div>
                <dt>Screen</dt>
                <dd>{screen}</dd>
              </div>
              <div>
                <dt>Slot</dt>
                <dd>{activeSlot ?? "none"}</dd>
              </div>
              <div>
                <dt>Save</dt>
                <dd>{saveStatus}</dd>
              </div>
              <div>
                <dt>Speed</dt>
                <dd>{speed}×</dd>
              </div>
              <div>
                <dt>Modified</dt>
                <dd>{developmentModified ? "yes" : "no"}</dd>
              </div>
            </dl>
            <div className="button-row">
              <CommandButton command={{ type: "validate-state" }}>
                Validate state
              </CommandButton>
              <button onClick={() => void copyDiagnostics()}>
                Copy diagnostic report
              </button>
              <button
                disabled={activeSlot === null}
                onClick={() =>
                  activeSlot !== null && void exportSlot(activeSlot)
                }
              >
                Export active save
              </button>
              <button disabled={gameState === null} onClick={undo}>
                Undo latest command
              </button>
            </div>
            <h3>Recent errors</h3>
            <ol className="dev-log">
              {errors.slice(-5).map((error) => (
                <li key={error.id}>{error.message}</li>
              ))}
              {errors.length === 0 && <li>None. Suspiciously civilized.</li>}
            </ol>
            <h3>Development log</h3>
            <ol className="dev-log">
              {developmentLog.slice(-8).map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </aside>
  );
}
