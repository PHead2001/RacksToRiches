import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import {
  calculateResaleProceeds,
  calculateContractReadiness,
  calculateServicePoolProjection,
  calculateSlaBuffer,
  getEquipmentDefinition,
  getUnlockedBedroomEquipment,
  STARTER_EQUIPMENT_INSTANCE_IDS,
  TUTORIAL_MILESTONE_ID,
  VIOLATION_RECOVERY_RATE,
} from "../game";
import type {
  CONSUMABLE_RESOURCE_KEYS,
  ContractInstance,
  EquipmentPlacement,
  GameState,
} from "../game";
import { SAVE_SLOT_IDS, webCapabilities } from "../platform";
import type { AppOptions, SaveSlotId, SaveSlotSummary } from "../platform";
import type { GameRuntime } from "../runtime";
import type { AppNotification } from "../store";
import {
  contractActualRevenue,
  contractCustomerName,
  equipmentLabel,
  formatDuration,
  formatMoney,
  formatRequirement,
  selectGameMetrics,
  selectResourceFulfillment,
} from "./selectors";
import { useAppStore } from "./storeContext";

const DevelopmentPanel = __DEV_TOOLS__
  ? lazy(() => import("../dev/DevelopmentPanel"))
  : null;
let suppressPauseForDragCancellation = false;

export function App({ runtime }: { runtime: GameRuntime }) {
  const screen = useAppStore((state) => state.screen);
  const options = useAppStore((state) => state.options);
  const previewUiScale = useAppStore((state) => state.previewUiScale);
  const gameState = useAppStore((state) => state.gameState);
  const boot = useAppStore((state) => state.boot);
  const saveNow = useAppStore((state) => state.saveNow);
  const togglePauseMenu = useAppStore((state) => state.togglePauseMenu);
  const recordError = useAppStore((state) => state.recordError);
  const [developmentOpen, setDevelopmentOpen] = useState(false);
  const dragGestureActive = useRef(false);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    runtime.start();
    return () => {
      runtime.stop();
    };
  }, [runtime]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".drag-handle, .rack-equipment-face") !== null
      ) {
        dragGestureActive.current = true;
      }
    };
    const onPointerUp = () => {
      dragGestureActive.current = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        (suppressPauseForDragCancellation ||
          dragGestureActive.current ||
          document.querySelector(".drag-overlay") !== null)
      ) {
        dragGestureActive.current = false;
        event.preventDefault();
        return;
      }
      if (
        event.key === "Escape" &&
        screen === "game" &&
        !event.defaultPrevented &&
        gameState?.progression.terminalState === null
      )
        togglePauseMenu();
      if (__DEV_TOOLS__ && event.key === "F10") {
        event.preventDefault();
        setDevelopmentOpen((open) => !open);
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [gameState, screen, togglePauseMenu]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      recordError(event.error, "global");
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      recordError(event.reason, "global");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [recordError]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && gameState !== null)
        void saveNow();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [gameState, saveNow]);

  if (
    __DEV_TOOLS__ &&
    new URLSearchParams(window.location.search).has("error-boundary-test")
  ) {
    throw new Error("QA-requested error boundary inspection");
  }

  return (
    <div
      className="app-root"
      data-reduced-motion={String(options.reducedMotion)}
      data-ui-scale={previewUiScale ?? options.uiScale}
    >
      {screen === "boot" && <BootScreen />}
      {screen === "menu" && <MainMenu />}
      {screen === "new-game" && <NewGameScreen />}
      {screen === "load" && <SaveManager />}
      {screen === "options" && <OptionsScreen />}
      {screen === "credits" && <CreditsScreen />}
      {screen === "game" && gameState !== null && (
        <GameShell state={gameState} />
      )}
      {DevelopmentPanel !== null && developmentOpen && screen === "game" && (
        <Suspense
          fallback={<div className="dev-loading">Loading QA tools…</div>}
        >
          <DevelopmentPanel
            onClose={() => {
              setDevelopmentOpen(false);
            }}
          />
        </Suspense>
      )}
      <NotificationStack />
    </div>
  );
}

function Brand() {
  return (
    <div className="brand-lockup" aria-label="Racks to Riches">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="9" y="5" width="46" height="54" rx="5" />
        {[15, 26, 37, 48].map((y) => (
          <g key={y}>
            <rect x="16" y={y} width="32" height="7" rx="2" />
            <circle cx="42" cy={y + 3.5} r="1.5" />
          </g>
        ))}
      </svg>
      <div>
        <span className="eyebrow">INFRASTRUCTURE IDLE SIM</span>
        <strong>RACKS TO RICHES</strong>
      </div>
    </div>
  );
}

function BootScreen() {
  return (
    <main className="menu-stage" aria-busy="true">
      <Brand />
      <div className="boot-loader" aria-label="Loading saves and options">
        <span /> Inspecting save bays…
      </div>
    </main>
  );
}

function MainMenu() {
  const slots = useAppStore((state) => state.slots);
  const navigate = useAppStore((state) => state.navigate);
  const continueGame = useAppStore((state) => state.continueGame);
  const validSave = slots.some(({ health }) => health === "valid");

  return (
    <main className="menu-stage">
      <div className="menu-grid">
        <section className="menu-hero">
          <Brand />
          <h1>
            Build the rack.
            <br />
            Host the workload.
            <br />
            <em>Make it scale.</em>
          </h1>
          <p>
            Start with a bedroom server and turn blinking boxes into a hosting
            empire—one contract at a time.
          </p>
          <div className="signal-strip" aria-label="System status">
            <span>
              <i /> STATIC WEB BUILD
            </span>
            <span>
              <i /> LOCAL SAVES
            </span>
            <span>
              <i /> DETERMINISTIC SIM
            </span>
          </div>
        </section>
        <section className="panel menu-panel" aria-label="Main menu">
          <p className="panel-kicker">CONTROL TERMINAL // 01</p>
          <button
            className="primary large"
            disabled={!validSave}
            onClick={() => void continueGame()}
          >
            <span>Continue</span>
            <small>{validSave ? "Most recent company" : "No valid save"}</small>
          </button>
          <button
            className="large"
            onClick={() => {
              navigate("new-game");
            }}
          >
            <span>New game</span>
            <small>Claim a save bay</small>
          </button>
          <button
            className="large"
            onClick={() => {
              navigate("load");
            }}
          >
            <span>Load game</span>
            <small>Manage five save bays</small>
          </button>
          <div className="split-buttons">
            <button
              onClick={() => {
                navigate("options");
              }}
            >
              Options
            </button>
            <button
              onClick={() => {
                navigate("credits");
              }}
            >
              Credits
            </button>
          </div>
          {!webCapabilities.canQuit && (
            <p className="menu-footnote">
              Close the browser tab when you are finished.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function ScreenHeader({
  title,
  subtitle,
  backTo = "menu",
  backLabel = "Main menu",
}: {
  title: string;
  subtitle: string;
  backTo?: "menu" | "game";
  backLabel?: string;
}) {
  const navigate = useAppStore((state) => state.navigate);
  return (
    <header className="screen-header">
      <Brand />
      <div>
        <p className="eyebrow">LOCAL CONTROL PLANE</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <button
        onClick={() => {
          navigate(backTo);
        }}
      >
        ← {backLabel}
      </button>
    </header>
  );
}

function NewGameScreen() {
  const slots = useAppStore((state) => state.slots);
  const createGame = useAppStore((state) => state.createGame);
  const [slotId, setSlotId] = useState<SaveSlotId>("slot-1");
  const [name, setName] = useState("Foxglove Hosting");
  const selected = slots.find((slot) => slot.slotId === slotId);

  const submit = async () => {
    if (
      selected !== undefined &&
      selected.health !== "empty" &&
      !window.confirm(
        `Overwrite ${slotId.replace("slot-", "Slot ")} (${selected.companyName ?? "unreadable save"})?`,
      )
    ) {
      return;
    }
    await createGame(slotId, name);
  };

  return (
    <main className="screen-shell narrow-shell">
      <ScreenHeader
        title="New company"
        subtitle="Name the operation and choose one of five local save bays."
      />
      <section className="panel setup-panel">
        <label>
          Company name
          <input
            value={name}
            maxLength={60}
            onChange={(event) => {
              setName(event.target.value);
            }}
            autoComplete="organization"
          />
        </label>
        <fieldset>
          <legend>Save bay</legend>
          <div className="slot-picker">
            {SAVE_SLOT_IDS.map((id) => {
              const slot = slots.find(
                ({ slotId: candidate }) => candidate === id,
              );
              return (
                <label
                  className="slot-radio"
                  key={id}
                  data-health={slot?.health ?? "empty"}
                >
                  <input
                    type="radio"
                    name="save-slot"
                    checked={slotId === id}
                    onChange={() => {
                      setSlotId(id);
                    }}
                  />
                  <strong>{id.replace("slot-", "Slot ")}</strong>
                  <span>{slot?.companyName ?? "Empty"}</span>
                  <small>{slot?.health ?? "empty"}</small>
                </label>
              );
            })}
          </div>
        </fieldset>
        <button className="primary" onClick={() => void submit()}>
          Initialize company
        </button>
      </section>
    </main>
  );
}

function SaveManager() {
  const slots = useAppStore((state) => state.slots);
  const loadSlot = useAppStore((state) => state.loadSlot);
  const deleteSlot = useAppStore((state) => state.deleteSlot);
  const exportSlot = useAppStore((state) => state.exportSlot);
  const importSlot = useAppStore((state) => state.importSlot);
  const restoreBackup = useAppStore((state) => state.restoreBackup);

  const importFile = async (
    slot: SaveSlotSummary,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    if (
      slot.health !== "empty" &&
      !window.confirm(
        `Import into ${slot.slotId.replace("slot-", "Slot ")} and replace ${slot.companyName ?? "the current data"}?`,
      )
    ) {
      return;
    }
    await importSlot(slot.slotId, file);
  };

  return (
    <main className="screen-shell">
      <ScreenHeader
        title="Save manager"
        subtitle="Current, temporary, and last-known-good records stay isolated per bay."
      />
      <section className="save-grid" aria-label="Five save slots">
        {slots.map((slot) => (
          <article
            className="panel save-card"
            key={slot.slotId}
            data-health={slot.health}
          >
            <header>
              <span className="slot-number">
                {slot.slotId.replace("slot-", "SLOT 0")}
              </span>
              <span className="health-badge">{slot.health}</span>
            </header>
            <h2>{slot.companyName ?? "Empty save bay"}</h2>
            {slot.health !== "empty" && (
              <dl>
                <div>
                  <dt>Cash</dt>
                  <dd>
                    {slot.cash === null ? "—" : formatMoney(slot.cash, true)}
                  </dd>
                </div>
                <div>
                  <dt>Tier</dt>
                  <dd>{slot.reputationTier ?? "—"}</dd>
                </div>
                <div>
                  <dt>Playtime</dt>
                  <dd>
                    {slot.playtimeSeconds === null
                      ? "—"
                      : formatDuration(slot.playtimeSeconds)}
                  </dd>
                </div>
                <div>
                  <dt>Last played</dt>
                  <dd>
                    {slot.lastPlayed === null
                      ? "—"
                      : new Date(slot.lastPlayed).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>{slot.version ?? "—"}</dd>
                </div>
                <div>
                  <dt>Modified</dt>
                  <dd>{slot.developmentModified ? "QA tools" : "No"}</dd>
                </div>
              </dl>
            )}
            {slot.detail !== null && (
              <p className="warning-text">{slot.detail}</p>
            )}
            <div className="card-actions">
              <button
                disabled={slot.health !== "valid"}
                onClick={() => void loadSlot(slot.slotId)}
              >
                Load
              </button>
              <button
                disabled={slot.health !== "valid"}
                onClick={() => void exportSlot(slot.slotId)}
              >
                Export
              </button>
              <label className="button-label">
                Import
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => void importFile(slot, event)}
                />
              </label>
              {slot.backupAvailable && (
                <button onClick={() => void restoreBackup(slot.slotId)}>
                  Restore backup
                </button>
              )}
              <button
                className="danger"
                disabled={slot.health === "empty"}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete only ${slot.slotId.replace("slot-", "Slot ")} (${slot.companyName ?? "unreadable data"})?`,
                    )
                  ) {
                    void deleteSlot(slot.slotId);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function OptionsScreen() {
  const stored = useAppStore((state) => state.options);
  const updateOptions = useAppStore((state) => state.updateOptions);
  const setUiScalePreview = useAppStore((state) => state.setUiScalePreview);
  const gameState = useAppStore((state) => state.gameState);
  const [draft, setDraft] = useState(stored);

  useEffect(
    () => () => {
      setUiScalePreview(null);
    },
    [setUiScalePreview],
  );

  const update = <K extends keyof AppOptions>(key: K, value: AppOptions[K]) => {
    setDraft((options) => ({ ...options, [key]: value }));
  };
  const updateUiScale = (value: string) => {
    if (value === "compact" || value === "standard" || value === "large") {
      update("uiScale", value);
      setUiScalePreview(value);
    }
  };
  const updateAutosaveInterval = (value: string) => {
    const seconds = Number(value);
    if (
      seconds === 60 ||
      seconds === 300 ||
      seconds === 600 ||
      seconds === 900 ||
      seconds === 1800
    ) {
      update("autosaveIntervalSeconds", seconds);
    }
  };

  return (
    <main className="screen-shell narrow-shell">
      <ScreenHeader
        title="Options"
        subtitle="These settings persist globally and do not belong to any save slot."
        backTo={gameState === null ? "menu" : "game"}
        backLabel={gameState === null ? "Main menu" : "Back to game"}
      />
      <section className="panel options-panel">
        <label>
          Interface scale
          <select
            value={draft.uiScale}
            onChange={(event) => {
              updateUiScale(event.target.value);
            }}
          >
            <option value="compact">Compact · 90%</option>
            <option value="standard">Standard · 100%</option>
            <option value="large">Large · 110%</option>
          </select>
        </label>
        <Toggle
          label="Reduced motion"
          checked={draft.reducedMotion}
          onChange={(value) => {
            update("reducedMotion", value);
          }}
        />
        <Toggle
          label="Compact number formatting"
          checked={draft.compactNumbers}
          onChange={(value) => {
            update("compactNumbers", value);
          }}
        />
        <Toggle
          label="Autosave"
          checked={draft.autosaveEnabled}
          onChange={(value) => {
            update("autosaveEnabled", value);
          }}
        />
        <label>
          Autosave interval
          <select
            value={draft.autosaveIntervalSeconds}
            disabled={!draft.autosaveEnabled}
            onChange={(event) => {
              updateAutosaveInterval(event.target.value);
            }}
          >
            <option value={60}>1 minute</option>
            <option value={300}>5 minutes</option>
            <option value={600}>10 minutes</option>
            <option value={900}>15 minutes</option>
            <option value={1800}>30 minutes</option>
          </select>
        </label>
        {document.fullscreenEnabled && (
          <Toggle
            label="Fullscreen"
            checked={draft.fullscreen}
            onChange={(value) => {
              update("fullscreen", value);
            }}
          />
        )}
        <button className="primary" onClick={() => void updateOptions(draft)}>
          Save options
        </button>
      </section>
    </main>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
    </label>
  );
}

function CreditsScreen() {
  return (
    <main className="screen-shell narrow-shell">
      <ScreenHeader
        title="Credits"
        subtitle="A tiny infrastructure empire with no cloud bill attached."
      />
      <section className="panel credits-panel">
        <Brand />
        <p>Design and direction by PHead2001.</p>
        <p>
          Phase 2 engineering foundation built with React, TypeScript, Vite,
          Zustand, and a deterministic simulation core.
        </p>
        <p className="muted">
          No real hardware brands were harmed in the making of these rack units.
        </p>
      </section>
    </main>
  );
}

function GameShell({ state }: { state: GameState }) {
  const view = useAppStore((store) => store.gameView);
  const setView = useAppStore((store) => store.setGameView);
  const options = useAppStore((store) => store.options);
  const saveStatus = useAppStore((store) => store.saveStatus);
  const pauseOpen = useAppStore((store) => store.pauseMenuOpen);
  const togglePause = useAppStore((store) => store.togglePauseMenu);
  const metrics = useMemo(() => selectGameMetrics(state), [state]);
  const warning =
    state.company.cash < 0
      ? "Company operating in debt"
      : metrics.capacity.powerEfficiency < 1
        ? "Power throttling active"
        : metrics.capacity.thermalEfficiency < 1
          ? "Cooling throttling active"
          : null;

  return (
    <main className="game-shell">
      <header className="hud">
        <Brand />
        <div className="hud-metrics">
          <HudValue
            label="Cash"
            value={formatMoney(state.company.cash, options.compactNumbers)}
            accent
          />
          <HudValue
            label="Gross / sec"
            value={formatMoney(
              metrics.grossRevenuePerSecond,
              options.compactNumbers,
            )}
          />
          <HudValue
            label="Net / sec"
            value={formatMoney(
              metrics.netIncomePerSecond,
              options.compactNumbers,
            )}
            warning={metrics.netIncomePerSecond < 0}
          />
          <HudValue
            label="Reputation"
            value={`${String(state.company.reputation)} · ${state.company.currentTier.replaceAll("-", " ")}`}
          />
          <HudValue
            label="Research"
            value={String(state.company.researchPoints)}
          />
          <HudValue
            label="Contracts"
            value={String(state.contracts.active.length)}
          />
        </div>
        <div className="hud-actions">
          <span className={`save-indicator ${saveStatus}`}>{saveStatus}</span>
          <button
            aria-label="Open pause menu"
            onClick={() => {
              togglePause(true);
            }}
          >
            Ⅱ
          </button>
        </div>
      </header>
      <div className="game-body">
        <nav className="game-nav" aria-label="Game screens">
          <button
            className={view === "facility" ? "active" : ""}
            onClick={() => {
              setView("facility");
            }}
          >
            Facility
          </button>
          <button
            className={view === "contracts" ? "active" : ""}
            aria-label={`Contracts, ${String(state.contracts.offers.length)} ${state.contracts.offers.length === 1 ? "offer" : "offers"} available`}
            onClick={() => {
              setView("contracts");
            }}
          >
            <span className="nav-label">Contracts</span>
            <span className="nav-count" aria-hidden="true">
              {state.contracts.offers.length}
            </span>
          </button>
          <button
            className={view === "store" ? "active" : ""}
            onClick={() => {
              setView("store");
            }}
          >
            Hardware store
          </button>
          <div className="nav-status">
            <p>BEDROOM // NODE 01</p>
            <span>{warning ?? "Systems nominal"}</span>
          </div>
        </nav>
        <section className="game-content">
          <h1 className="game-company">{state.company.name}</h1>
          {state.company.cash < 0 &&
            state.progression.terminalState === null && (
              <div className="debt-warning" role="status">
                Debt warning · Bankruptcy occurs at −$10,000. This company is
                still playable.
              </div>
            )}
          {state.progression.terminalState === null ? (
            <>
              {view === "facility" && <FacilityView state={state} />}
              {view === "contracts" && <ContractsView state={state} />}
              {view === "store" && <StoreView state={state} />}
            </>
          ) : (
            <GameOver state={state} />
          )}
        </section>
      </div>
      {pauseOpen && <PauseMenu />}
    </main>
  );
}

function HudValue({
  label,
  value,
  accent = false,
  warning = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`hud-value ${accent ? "accent" : ""} ${warning ? "warning" : ""}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FacilityView({ state }: { state: GameState }) {
  const install = useAppStore((store) => store.installEquipment);
  const move = useAppStore((store) => store.moveInstalledEquipment);
  const remove = useAppStore((store) => store.removeInstalledEquipment);
  const sell = useAppStore((store) => store.sellInventoryEquipment);
  const toggle = useAppStore((store) => store.toggleEquipment);
  const previewRelocation = useAppStore(
    (store) => store.previewEquipmentRelocation,
  );
  const notify = useAppStore((store) => store.notify);
  const setDragActive = useAppStore((store) => store.setDragActive);
  const [selectedUnit, setSelectedUnit] = useState(0);
  const [draggedEquipmentId, setDraggedEquipmentId] = useState<string | null>(
    null,
  );
  const [previewUnits, setPreviewUnits] = useState<readonly number[]>([]);
  const [dragFeedback, setDragFeedback] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );
  const { setNodeRef: setInventoryDropRef, isOver: inventoryIsOver } =
    useDroppable({ id: "inventory-drop" });
  useEffect(
    () => () => {
      setDragActive(false);
    },
    [setDragActive],
  );
  const metrics = useMemo(() => selectGameMetrics(state), [state]);
  const tutorialComplete = state.progression.completedMilestones.includes(
    TUTORIAL_MILESTONE_ID,
  );
  const rack = state.facilities[0]?.racks[0];
  if (rack === undefined) throw new Error("Starter rack is missing");

  const occupying = (unit: number) =>
    rack.equipment.find((equipment) => {
      const definition = getEquipmentDefinition(equipment.definitionId);
      return (
        unit >= equipment.startUnit &&
        unit < equipment.startUnit + definition.rackUnits
      );
    });

  const equipmentIdFromDrag = (id: string | number): string | null => {
    const value = String(id);
    return value.startsWith("equipment:") ? value.slice(10) : null;
  };
  const anchorFromDrop = (id: string | number): number | null => {
    const value = String(id);
    if (!value.startsWith("rack-unit:")) return null;
    const unit = Number(value.slice(10));
    return Number.isInteger(unit) ? unit : null;
  };
  const clearDrag = () => {
    setDragActive(false);
    setDraggedEquipmentId(null);
    setPreviewUnits([]);
    setDragFeedback(null);
  };
  const cancelDrag = () => {
    suppressPauseForDragCancellation = true;
    setDraggedEquipmentId(null);
    setPreviewUnits([]);
    setDragFeedback(null);
    // dnd-kit's Escape cancellation fires before the app-level key handler.
    // Keep this flag set through the current keyboard event so Escape cancels
    // the drag without also opening the pause menu.
    window.setTimeout(() => {
      suppressPauseForDragCancellation = false;
      setDragActive(false);
    }, 0);
  };
  const onDragStart = (event: DragStartEvent) => {
    setDragActive(true);
    setDraggedEquipmentId(equipmentIdFromDrag(event.active.id));
  };
  const onDragOver = (event: DragOverEvent) => {
    const equipmentId = equipmentIdFromDrag(event.active.id);
    const anchor = event.over === null ? null : anchorFromDrop(event.over.id);
    if (equipmentId === null || anchor === null) {
      setPreviewUnits([]);
      setDragFeedback(
        event.over?.id === "inventory-drop"
          ? "Drop here to return installed equipment to inventory."
          : null,
      );
      return;
    }
    const preview = previewRelocation(equipmentId, anchor);
    if (preview === null) return;
    if (!preview.ok || preview.placement === null) {
      setPreviewUnits([]);
      setDragFeedback(
        preview.ok ? "No rack placement available." : preview.error.message,
      );
      return;
    }
    const definition = getEquipmentDefinition(preview.placement.definitionId);
    const previewStart = preview.placement.startUnit;
    setPreviewUnits(
      Array.from(
        { length: definition.rackUnits },
        (_, offset) => previewStart + offset,
      ),
    );
    setDragFeedback(
      preview.reflowed
        ? `Valid ${String(definition.rackUnits)}U placement; nearby equipment will reflow.`
        : `Valid ${String(definition.rackUnits)}U placement.`,
    );
  };
  const onDragEnd = (event: DragEndEvent) => {
    const equipmentId = equipmentIdFromDrag(event.active.id);
    const overId = event.over?.id;
    if (equipmentId === null) {
      clearDrag();
      return;
    }
    const pointerOrigin = (() => {
      if (event.activatorEvent instanceof MouseEvent) {
        return {
          x: event.activatorEvent.clientX,
          y: event.activatorEvent.clientY,
        };
      }
      if (event.activatorEvent instanceof TouchEvent) {
        const touch =
          event.activatorEvent.touches[0] ??
          event.activatorEvent.changedTouches[0];
        return touch === undefined
          ? null
          : { x: touch.clientX, y: touch.clientY };
      }
      return null;
    })();
    const pointerTargets =
      pointerOrigin === null
        ? []
        : document.elementsFromPoint(
            pointerOrigin.x + event.delta.x,
            pointerOrigin.y + event.delta.y,
          );
    const droppedOnInventory =
      overId === "inventory-drop" ||
      pointerTargets.some(
        (element) => element.closest(".inventory-drop-zone") !== null,
      );
    const anchor = overId === undefined ? null : anchorFromDrop(overId);
    if (anchor !== null) move(equipmentId, anchor);
    else if (droppedOnInventory) {
      const installed = rack.equipment.some(({ id }) => id === equipmentId);
      if (installed) remove(equipmentId);
    } else {
      notify({
        key: "drag-invalid",
        type: "warning",
        message: "Drop equipment on a rack unit or the inventory panel.",
      });
    }
    clearDrag();
  };
  const draggedDefinition =
    draggedEquipmentId === null
      ? null
      : getEquipmentDefinition(
          [...state.inventory, ...rack.equipment].find(
            ({ id }) => id === draggedEquipmentId,
          )?.definitionId ?? "refurbished-desktop",
        );

  return (
    <DndContext
      autoScroll={false}
      sensors={sensors}
      collisionDetection={(arguments_) => {
        const pointerCollisions = pointerWithin(arguments_);
        return pointerCollisions.length > 0
          ? pointerCollisions
          : rectIntersection(arguments_);
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={cancelDrag}
    >
      <div className="facility-layout">
        <section className="panel room-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">FACILITY 01</p>
              <h2>Bedroom</h2>
            </div>
            <span className="status-chip">RESIDENTIAL</span>
          </div>
          <div className="bedroom-illustration" aria-hidden="true">
            <div className="window-glow" />
            <div className="desk" />
            <div className="cable cable-one" />
            <div className="cable cable-two" />
            <span>100 Mbps consumer uplink</span>
          </div>
          <p className="muted">
            One rack slot, questionable cable management, zero rent. Every
            empire starts somewhere.
          </p>
        </section>
        <section className="panel rack-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">RACK A-01</p>
              <h2>Starter 12U</h2>
            </div>
            <span>{String(metrics.capacity.usedRackUnits)} / 12U</span>
          </div>
          <p className="rack-help">
            Select a rack unit, then install or move equipment. Controls remain
            fully keyboard accessible.
          </p>
          <div
            className={`rack-grid ${draggedEquipmentId !== null && previewUnits.length === 0 && dragFeedback !== null ? "invalid-preview" : ""}`}
            aria-label="Starter 12U rack"
          >
            {Array.from({ length: 12 }, (_, index) => 11 - index).map(
              (unit) => {
                const equipment = occupying(unit);
                return (
                  <RackUnitButton
                    key={unit}
                    unit={unit}
                    className={`rack-unit ${selectedUnit === unit ? "selected" : ""} ${previewUnits.includes(unit) ? "drop-preview" : ""} ${equipment === undefined ? "empty" : "occupied"}`}
                    onClick={() => {
                      setSelectedUnit(unit);
                    }}
                    aria-label={`Rack unit ${String(unit + 1)}${equipment === undefined ? ", empty" : `, ${equipmentLabel(equipment.definitionId)}`}`}
                  >
                    <span className="unit-number">{String(unit + 1)}U</span>
                    {equipment === undefined ? (
                      <em>AVAILABLE</em>
                    ) : (
                      <em>RESERVED</em>
                    )}
                  </RackUnitButton>
                );
              },
            )}
            {rack.equipment.map((equipment) => (
              <RackEquipmentFace key={equipment.id} equipment={equipment} />
            ))}
          </div>
        </section>
        <aside className="facility-side">
          <section
            className={`panel inventory-panel ${inventoryIsOver ? "drop-active" : ""}`}
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">UNRACKED</p>
                <h2>Inventory</h2>
              </div>
              <span>{String(state.inventory.length)} items</span>
            </div>
            {state.inventory.length === 0 && (
              <p className="empty-state">
                Nothing waiting on the floor. Miraculous.
              </p>
            )}
            <div
              className="inventory-list bounded-list"
              role="region"
              aria-label="Inventory equipment"
            >
              {state.inventory.map((item) => {
                const definition = getEquipmentDefinition(item.definitionId);
                const resale = calculateResaleProceeds(item.acquisitionPrice);
                const tutorialLocked =
                  !tutorialComplete &&
                  STARTER_EQUIPMENT_INSTANCE_IDS.some((id) => id === item.id);
                return (
                  <article key={item.id}>
                    <div>
                      <strong>{definition.name}</strong>
                      <small>
                        {definition.category} · {String(definition.rackUnits)}U
                      </small>
                      <small>Resale {formatMoney(resale, false)}</small>
                    </div>
                    <EquipmentDragHandle
                      equipmentId={item.id}
                      label={`Drag ${definition.name}`}
                    />
                    <button onClick={() => install(item.id, selectedUnit)}>
                      Install at {String(selectedUnit + 1)}U
                    </button>
                    <button
                      disabled={tutorialLocked || resale === 0}
                      title={
                        tutorialLocked
                          ? "Required for the first contract"
                          : resale === 0
                            ? "No resale value"
                            : undefined
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            `Sell ${definition.name} for ${formatMoney(resale, false)}?`,
                          )
                        ) {
                          sell(item.id);
                        }
                      }}
                    >
                      {tutorialLocked
                        ? "Required for tutorial"
                        : resale === 0
                          ? "No resale value"
                          : `Sell for ${formatMoney(resale, false)}`}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="panel capacity-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">LIVE TELEMETRY</p>
                <h2>Rack output</h2>
              </div>
            </div>
            <dl className="telemetry-grid">
              <Metric
                label="Compute"
                value={metrics.capacity.compute.toFixed(1)}
              />
              <Metric
                label="Storage"
                value={metrics.capacity.storage.toFixed(1)}
              />
              <Metric
                label="Bandwidth"
                value={`${metrics.capacity.bandwidth.toFixed(0)} Mbps`}
              />
              <Metric
                label="Reliability"
                value={`${(metrics.capacity.reliability * 100).toFixed(1)}%`}
              />
              <Metric
                label="Power draw"
                value={`${metrics.capacity.powerDraw.toFixed(0)} W`}
                warning={metrics.capacity.powerEfficiency < 1}
              />
              <Metric
                label="Available power"
                value={`${metrics.capacity.availablePower.toFixed(0)} W`}
              />
              <Metric
                label="Heat"
                value={metrics.capacity.heatOutput.toFixed(0)}
              />
              <Metric
                label="Cooling"
                value={metrics.capacity.availableCooling.toFixed(0)}
                warning={metrics.capacity.thermalEfficiency < 1}
              />
            </dl>
            {metrics.capacity.powerEfficiency < 1 && (
              <p className="warning-box">
                Power shortage: effective output is multiplied by{" "}
                {(metrics.capacity.powerEfficiency * 100).toFixed(0)}%.
              </p>
            )}
            {metrics.capacity.thermalEfficiency < 1 && (
              <p className="warning-box">
                Cooling shortage: thermal throttling reduces effective capacity.
              </p>
            )}
          </section>
          <section className="panel installed-panel">
            <div className="section-heading">
              <h2>Installed controls</h2>
            </div>
            <div
              ref={setInventoryDropRef}
              className={`inventory-drop-zone ${inventoryIsOver || draggedEquipmentId !== null ? "drop-ready" : ""}`}
              aria-label="Equipment inventory drop zone"
              onPointerUp={() => {
                if (
                  draggedEquipmentId !== null &&
                  rack.equipment.some(({ id }) => id === draggedEquipmentId)
                ) {
                  remove(draggedEquipmentId);
                }
              }}
            >
              Drop installed equipment here to return it to inventory.
            </div>
            <div
              className="installed-list bounded-list"
              role="region"
              aria-label="Installed equipment controls"
            >
              {rack.equipment.map((equipment) => (
                <article key={equipment.id}>
                  <strong>{equipmentLabel(equipment.definitionId)}</strong>
                  <small>
                    {String(equipment.startUnit + 1)}U ·{" "}
                    {equipment.poweredOn ? "Powered" : "Offline"}
                  </small>
                  <div className="button-row compact-row">
                    <button
                      onClick={() => toggle(equipment.id, !equipment.poweredOn)}
                    >
                      {equipment.poweredOn ? "Power off" : "Power on"}
                    </button>
                    <button onClick={() => remove(equipment.id)}>Remove</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <p className="drag-feedback" aria-live="polite">
            {dragFeedback}
          </p>
        </aside>
      </div>
      <DragOverlay>
        {draggedDefinition === null ? null : (
          <div className="drag-overlay">
            <strong>{draggedDefinition.name}</strong>
            <span>{String(draggedDefinition.rackUnits)}U preview</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function RackUnitButton({
  unit,
  className,
  children,
  onClick,
  "aria-label": ariaLabel,
}: {
  unit: number;
  className: string;
  children: ReactNode;
  onClick: () => void;
  "aria-label": string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `rack-unit:${String(unit)}`,
  });
  return (
    <button
      ref={setNodeRef}
      className={`${className} ${isOver ? "drop-anchor" : ""}`}
      style={{ gridColumn: 1, gridRow: String(12 - unit) }}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

function RackEquipmentFace({ equipment }: { equipment: EquipmentPlacement }) {
  const definition = getEquipmentDefinition(equipment.definitionId);
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `equipment:${equipment.id}`,
  });
  const style: CSSProperties = {
    gridColumn: 1,
    gridRow: `${String(12 - (equipment.startUnit + definition.rackUnits - 1))} / span ${String(definition.rackUnits)}`,
  };
  return (
    <button
      ref={setNodeRef}
      className={`rack-equipment-face ${isDragging ? "dragging" : ""}`}
      style={style}
      type="button"
      aria-label={`Move ${definition.name}, ${String(definition.rackUnits)} rack units, ${equipment.poweredOn ? "powered" : "offline"}`}
      {...listeners}
      {...attributes}
    >
      <span className="rack-grip" aria-hidden="true">
        GRIP
      </span>
      <strong>{definition.name}</strong>
      <small>{String(definition.rackUnits)}U</small>
      <i className={equipment.poweredOn ? "led on" : "led"} />
    </button>
  );
}

function EquipmentDragHandle({
  equipmentId,
  label,
}: {
  equipmentId: string;
  label: string;
}) {
  const { setNodeRef, listeners, attributes } = useDraggable({
    id: `equipment:${equipmentId}`,
  });
  return (
    <button
      ref={setNodeRef}
      className="drag-handle"
      type="button"
      aria-label={label}
      {...listeners}
      {...attributes}
    >
      Drag
    </button>
  );
}

function Metric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className={warning ? "warning" : ""}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function resourceLabel(key: (typeof CONSUMABLE_RESOURCE_KEYS)[number]): string {
  if (key === "gpuCompute") return "GPU compute";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function formatCapacity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function ContractsView({ state }: { state: GameState }) {
  const accept = useAppStore((store) => store.acceptOffer);
  const reject = useAppStore((store) => store.rejectOffer);
  const metrics = useMemo(() => selectGameMetrics(state), [state]);
  const tutorialComplete = state.progression.completedMilestones.includes(
    TUTORIAL_MILESTONE_ID,
  );
  const servicePool = calculateServicePoolProjection(
    metrics.capacity,
    state.contracts.active,
    "rack-starter-1",
  );

  return (
    <div className="contracts-layout">
      <section
        className="panel service-pool-summary"
        aria-labelledby="service-pool-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">SHARED SERVICE POOL</p>
            <h2 id="service-pool-title">Capacity after active reservations</h2>
          </div>
        </div>
        <dl>
          {servicePool.resources.map((resource) => (
            <div key={resource.key}>
              <dt>{resourceLabel(resource.key)}</dt>
              <dd>
                {formatCapacity(resource.used)} used /{" "}
                {formatCapacity(resource.total)} total /{" "}
                {formatCapacity(resource.remaining)} remaining
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <div className="page-title">
          <div>
            <p className="eyebrow">DEMAND QUEUE</p>
            <h2>
              {tutorialComplete ? "Starter marketplace" : "Tutorial contract"}
            </h2>
          </div>
          <span>{String(state.contracts.offers.length)} / 3 slots</span>
        </div>
        <div className="contract-grid">
          {state.contracts.offers.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              capacity={metrics.capacity}
              activeContracts={state.contracts.active}
              performance={null}
              onAccept={() => accept(contract.id)}
              onReject={() => reject(contract.id)}
            />
          ))}
          {state.contracts.offers.length === 0 && (
            <div className="panel empty-state">
              No pending offers. Active contracts may still be running.
            </div>
          )}
        </div>
      </section>
      <section>
        <div className="page-title">
          <div>
            <p className="eyebrow">SERVICE POOL</p>
            <h2>Active contracts</h2>
          </div>
          <span>{String(state.contracts.active.length)} running</span>
        </div>
        <div className="contract-grid">
          {state.contracts.active.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              capacity={metrics.capacity}
              activeContracts={state.contracts.active}
              performance={metrics.performance.get(contract.id) ?? 0}
            />
          ))}
          {state.contracts.active.length === 0 && (
            <div className="panel empty-state">
              {tutorialComplete
                ? "No active contracts. Accept a marketplace offer to put the rack to work."
                : "Install the starter hardware, then accept Gravy's contract."}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ContractCard({
  contract,
  capacity,
  activeContracts,
  performance,
  onAccept,
  onReject,
}: {
  contract: ContractInstance;
  capacity: ReturnType<typeof selectGameMetrics>["capacity"];
  activeContracts: readonly ContractInstance[];
  performance: number | null;
  onAccept?: (() => void) | undefined;
  onReject?: (() => void) | undefined;
}) {
  const resources = selectResourceFulfillment(capacity, contract);
  const readiness = calculateContractReadiness(
    contract,
    capacity,
    activeContracts,
    "rack-starter-1",
  );
  const sla = calculateSlaBuffer({
    ...contract,
    performanceScore: performance ?? readiness.fulfillment,
  });
  return (
    <article className="panel contract-card">
      <header>
        <div>
          <p className="eyebrow">TIER {String(contract.tier)}</p>
          <h3>{contractCustomerName(contract)}</h3>
        </div>
        <span
          className={`status-chip ${readiness.kind === "ready" || readiness.kind === "active" ? "good" : "warn"}`}
        >
          {readiness.label}
        </span>
      </header>
      <p className="service-name">
        {contract.serviceType.replaceAll("-", " ")}
      </p>
      <div className="requirements">
        {resources.map((resource) => (
          <div key={resource.key}>
            <span>{formatRequirement(resource.key, resource.required)}</span>
            <strong>{(resource.ratio * 100).toFixed(0)}%</strong>
            <progress max={1.25} value={Math.min(1.25, resource.ratio)} />
          </div>
        ))}
      </div>
      {performance === null && (
        <div
          className="offer-projection"
          aria-label="Projected service-pool capacity"
        >
          {readiness.projection.resources
            .filter((resource) => resource.candidateRequired > 0)
            .map((resource) => (
              <div key={resource.key}>
                <strong>{resourceLabel(resource.key)}</strong>
                <span>
                  {formatCapacity(resource.candidateRequired)} required
                </span>
                <span>
                  {formatCapacity(resource.remaining)} remaining before
                  acceptance
                </span>
                {resource.shortfall > 0 ? (
                  <span className="shortfall">
                    {formatCapacity(resource.shortfall)} short
                  </span>
                ) : (
                  <span>
                    {formatCapacity(resource.projectedRemaining)} remaining
                    after acceptance
                  </span>
                )}
              </div>
            ))}
          <p>
            Projected aggregate fulfillment:{" "}
            {(readiness.fulfillment * 100).toFixed(1)}%
          </p>
        </div>
      )}
      <dl className="contract-economics">
        <div>
          <dt>Base revenue</dt>
          <dd>{formatMoney(contract.baseRevenuePerSecond, false)}/s</dd>
        </div>
        <div>
          <dt>Time remaining</dt>
          <dd>{formatDuration(contract.remainingSeconds)}</dd>
        </div>
        <div>
          <dt>SLA buffer</dt>
          <dd>
            {formatDuration(sla.remainingSeconds)} /{" "}
            {formatDuration(sla.totalSeconds)}
          </dd>
        </div>
        {performance !== null && (
          <>
            <div>
              <dt>Fulfillment</dt>
              <dd>{(performance * 100).toFixed(1)}%</dd>
            </div>
            <div>
              <dt>Actual revenue</dt>
              <dd>
                {formatMoney(
                  contractActualRevenue(contract, performance),
                  false,
                )}
                /s
              </dd>
            </div>
            <div>
              <dt>SLA state</dt>
              <dd>{sla.state}</dd>
            </div>
          </>
        )}
      </dl>
      <p className="sla-explanation">
        This buffer is based on contract duration. Time below 100% fulfillment
        consumes it. Healthy service recovers it at{" "}
        {String(VIOLATION_RECOVERY_RATE)} seconds per second; exhausting it
        breaches the contract.
      </p>
      {performance !== null && activeContracts.length > 1 && (
        <p className="pool-note">
          Fulfillment is shared across this rack's active service pool.
        </p>
      )}
      <p className="readiness-explanation">{readiness.explanation}</p>
      {onAccept !== undefined && (
        <div className="button-row">
          <button
            className="primary"
            disabled={!readiness.canAccept}
            onClick={onAccept}
          >
            Accept & assign to Rack A-01
          </button>
          {onReject !== undefined && <button onClick={onReject}>Reject</button>}
        </div>
      )}
    </article>
  );
}

function StoreView({ state }: { state: GameState }) {
  const buy = useAppStore((store) => store.buyEquipment);
  const unlocked = state.progression.completedMilestones.includes(
    TUTORIAL_MILESTONE_ID,
  );
  const equipment = getUnlockedBedroomEquipment();
  return (
    <section>
      <div className="page-title">
        <div>
          <p className="eyebrow">USED HARDWARE EXCHANGE</p>
          <h2>Bedroom hardware store</h2>
        </div>
        <span>
          {unlocked ? `${String(equipment.length)} listings` : "LOCKED"}
        </span>
      </div>
      {!unlocked ? (
        <div className="panel locked-panel">
          <span>⌁</span>
          <h3>Finish Gravy's Garden Blog</h3>
          <p>
            Complete the tutorial contract to unlock used hardware listings.
          </p>
        </div>
      ) : (
        <div className="store-grid">
          {equipment.map((definition) => (
            <article className="panel store-card" key={definition.id}>
              <header>
                <span className={`category-icon ${definition.category}`}>
                  {definition.category.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <p className="eyebrow">GEN {String(definition.generation)}</p>
                  <h3>{definition.name}</h3>
                </div>
              </header>
              <dl>
                <div>
                  <dt>Rack size</dt>
                  <dd>{String(definition.rackUnits)}U</dd>
                </div>
                <div>
                  <dt>Compute</dt>
                  <dd>{definition.compute ?? 0}</dd>
                </div>
                <div>
                  <dt>Storage</dt>
                  <dd>{definition.storage ?? 0}</dd>
                </div>
                <div>
                  <dt>Bandwidth</dt>
                  <dd>{definition.bandwidth ?? 0}</dd>
                </div>
                <div>
                  <dt>Power / Heat</dt>
                  <dd>
                    {String(definition.powerDraw)} /{" "}
                    {String(definition.heatOutput)}
                  </dd>
                </div>
                <div>
                  <dt>Reliability</dt>
                  <dd>{(definition.reliability * 100).toFixed(0)}%</dd>
                </div>
              </dl>
              <button
                className="primary"
                disabled={state.company.cash < definition.purchaseCost}
                onClick={() => buy(definition.id)}
              >
                Buy · {formatMoney(definition.purchaseCost, false)}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function GameOver({ state }: { state: GameState }) {
  const terminal = state.progression.terminalState;
  const activeSlot = useAppStore((store) => store.activeSlot);
  const returnToMenu = useAppStore((store) => store.returnToMenu);
  const exportSlot = useAppStore((store) => store.exportSlot);
  const deleteAndRestart = useAppStore(
    (store) => store.deleteActiveCompanyAndStartOver,
  );
  if (terminal === null) return null;
  const slotLabel = activeSlot?.replace("slot-", "Slot ") ?? "unknown slot";
  const bankruptcy = terminal.kind === "bankrupt";
  const tutorialFailed =
    terminal.kind === "tutorial-failed" || terminal.tutorialFailed;
  return (
    <section
      className="panel game-over"
      role="alert"
      aria-labelledby="game-over-title"
    >
      <p className="eyebrow">COMPANY TERMINAL STATE</p>
      <h2 id="game-over-title">
        {bankruptcy
          ? "The company is bankrupt."
          : "The first customer was lost."}
      </h2>
      {tutorialFailed && (
        <p>
          Gravy's Garden Blog exhausted its SLA buffer before the tutorial
          completed. This save cannot continue normal play.
        </p>
      )}
      {bankruptcy && (
        <p>
          Cash reached the −$10,000 bankruptcy threshold. The exact balance is{" "}
          {formatMoney(state.company.cash, false)} for diagnostics.
        </p>
      )}
      <p>
        Affected save: <strong>{slotLabel}</strong> · {state.company.name}
      </p>
      <div className="button-row game-over-actions">
        <button className="primary" onClick={() => void returnToMenu()}>
          Return to main menu
        </button>
        <button
          disabled={activeSlot === null}
          onClick={() => {
            if (activeSlot !== null) void exportSlot(activeSlot);
          }}
        >
          Export diagnostic save
        </button>
        <button
          className="danger"
          onClick={() => {
            if (
              window.confirm(
                `Delete ${slotLabel} (${state.company.name}) and start a new company? This cannot be undone.`,
              )
            ) {
              void deleteAndRestart();
            }
          }}
        >
          Delete this company and start a new game
        </button>
      </div>
    </section>
  );
}

function PauseMenu() {
  const toggle = useAppStore((state) => state.togglePauseMenu);
  const saveNow = useAppStore((state) => state.saveNow);
  const returnToMenu = useAppStore((state) => state.returnToMenu);
  const navigate = useAppStore((state) => state.navigate);
  const saveStatus = useAppStore((state) => state.saveStatus);
  return (
    <div className="modal-backdrop">
      <section
        className="panel pause-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
      >
        <p className="eyebrow">SESSION PAUSED</p>
        <h2 id="pause-title">Pause menu</h2>
        <button
          className="primary"
          onClick={() => {
            toggle(false);
          }}
        >
          Resume
        </button>
        <button onClick={() => void saveNow()}>
          Save now <small>{saveStatus}</small>
        </button>
        <button
          onClick={() => {
            toggle(false);
            navigate("options");
          }}
        >
          Options
        </button>
        <button onClick={() => void returnToMenu()}>
          Save & return to main menu
        </button>
        {saveStatus === "failed" && (
          <button className="danger" onClick={() => void returnToMenu(true)}>
            Return without saving
          </button>
        )}
      </section>
    </div>
  );
}

export function NotificationStack() {
  const notifications = useAppStore((state) => state.notifications);
  return (
    <aside className="notification-stack" aria-label="Notifications">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </aside>
  );
}

function NotificationItem({ notification }: { notification: AppNotification }) {
  const dismiss = useAppStore((state) => state.dismissNotification);
  useEffect(() => {
    const handle = window.setTimeout(() => {
      dismiss(notification.id);
    }, notification.durationMilliseconds);
    return () => {
      window.clearTimeout(handle);
    };
  }, [dismiss, notification.durationMilliseconds, notification.id]);
  return (
    <div
      className={`notification ${notification.type}`}
      role={
        notification.type === "error" || notification.type === "warning"
          ? "alert"
          : "status"
      }
    >
      <span>{notification.message}</span>
      <button
        aria-label="Dismiss notification"
        onClick={() => {
          dismiss(notification.id);
        }}
      >
        ×
      </button>
    </div>
  );
}
