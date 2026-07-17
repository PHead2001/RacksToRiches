import { createStore, type StoreApi } from "zustand/vanilla";

import {
  acceptContract,
  advanceGame,
  assertGameState,
  calculateAllRackCapacities,
  calculateSlaBufferSeconds,
  createInitialState,
  evaluateBankruptcy,
  fillStarterMarketplace,
  placeEquipment,
  purchaseEquipment,
  relocateEquipment,
  rejectContractOffer,
  sellEquipment,
  setEquipmentPower,
  stampLastSaved,
  TUTORIAL_MILESTONE_ID,
} from "../game";
import type { GameCommandResult, GameState } from "../game";
import {
  DEFAULT_OPTIONS,
  type AppOptions,
  type Clock,
  type FileTransfer,
  type FullscreenCapability,
  type OptionsRepository,
  type SaveRepository,
  type SaveSlotId,
  type SaveSlotSummary,
  type TextFile,
} from "../platform";
import {
  BoundedErrorLog,
  type AppErrorRecord,
  type ErrorSource,
} from "../runtime";
import type { RuntimeSpeed } from "../runtime";

type AppScreen =
  "boot" | "menu" | "new-game" | "load" | "options" | "credits" | "game";
type GameView = "facility" | "contracts" | "store";
type SaveStatus = "idle" | "saving" | "saved" | "failed";
type NotificationType = "success" | "information" | "warning" | "error";

export interface AppNotification {
  id: string;
  key: string | null;
  type: NotificationType;
  message: string;
  durationMilliseconds: number;
}

const NOTIFICATION_DURATION_MILLISECONDS = {
  success: 5_000,
  information: 5_000,
  warning: 8_000,
  error: 8_000,
} as const satisfies Record<NotificationType, number>;

interface NotificationInput {
  key?: string;
  type: NotificationType;
  message: string;
  durationMilliseconds?: number;
}

export type DevelopmentCommand =
  | { type: "add-cash"; amount: number }
  | { type: "set-cash"; amount: number }
  | { type: "add-reputation"; amount: number }
  | { type: "add-research"; amount: number }
  | { type: "toggle-expenses" }
  | { type: "toggle-pause" }
  | { type: "set-speed"; speed: RuntimeSpeed }
  | { type: "advance"; seconds: 60 | 3600 }
  | { type: "generate-contract" }
  | { type: "complete-contract"; contractId?: string | undefined }
  | { type: "near-expiry"; contractId?: string | undefined }
  | { type: "sla-violation"; contractId?: string | undefined }
  | { type: "clear-offers" }
  | { type: "validate-state" }
  | {
      type: "scenario";
      scenario:
        | "fresh"
        | "tutorial-ready"
        | "tutorial-active"
        | "overloaded-power"
        | "insufficient-cooling"
        | "marketplace"
        | "tutorial-failed"
        | "debt-warning"
        | "bankruptcy-at"
        | "bankruptcy-below"
        | "smart-reflow"
        | "inventory-stress"
        | "service-pool-stress"
        | "regional-metrics";
    };

interface DevelopmentLogRecord {
  id: string;
  timestamp: number;
  commandType: DevelopmentCommand["type"] | "undo";
  message: string;
}

interface AppStoreDependencies {
  saves: SaveRepository;
  options: OptionsRepository;
  clock: Clock;
  files: FileTransfer;
  fullscreen: FullscreenCapability;
}

export interface AppStoreState {
  screen: AppScreen;
  gameView: GameView;
  slots: readonly SaveSlotSummary[];
  options: AppOptions;
  gameState: GameState | null;
  activeSlot: SaveSlotId | null;
  saveStatus: SaveStatus;
  notifications: readonly AppNotification[];
  previewUiScale: AppOptions["uiScale"] | null;
  pauseMenuOpen: boolean;
  dragActive: boolean;
  paused: boolean;
  speed: RuntimeSpeed;
  freezeExpenses: boolean;
  developmentModified: boolean;
  undoState: GameState | null;
  developmentLog: readonly DevelopmentLogRecord[];
  errors: readonly AppErrorRecord[];
  boot: () => Promise<void>;
  navigate: (screen: AppScreen) => void;
  setGameView: (view: GameView) => void;
  notify: (notification: NotificationInput) => void;
  dismissNotification: (notificationId: string) => void;
  setUiScalePreview: (scale: AppOptions["uiScale"] | null) => void;
  createGame: (slotId: SaveSlotId, companyName: string) => Promise<boolean>;
  continueGame: () => Promise<boolean>;
  loadSlot: (slotId: SaveSlotId) => Promise<boolean>;
  saveNow: () => Promise<boolean>;
  returnToMenu: (withoutSaving?: boolean) => Promise<boolean>;
  deleteSlot: (slotId: SaveSlotId) => Promise<boolean>;
  deleteActiveCompanyAndStartOver: () => Promise<boolean>;
  restoreBackup: (slotId: SaveSlotId) => Promise<boolean>;
  exportSlot: (slotId: SaveSlotId) => Promise<boolean>;
  importSlot: (slotId: SaveSlotId, file: TextFile) => Promise<boolean>;
  updateOptions: (options: AppOptions) => Promise<boolean>;
  togglePauseMenu: (open?: boolean) => void;
  setDragActive: (active: boolean) => void;
  installEquipment: (equipmentId: string, startUnit: number) => boolean;
  moveInstalledEquipment: (equipmentId: string, startUnit: number) => boolean;
  removeInstalledEquipment: (equipmentId: string) => boolean;
  previewEquipmentRelocation: (
    equipmentId: string,
    startUnit: number,
  ) => ReturnType<typeof relocateEquipment> | null;
  toggleEquipment: (equipmentId: string, poweredOn: boolean) => boolean;
  buyEquipment: (definitionId: string) => boolean;
  sellInventoryEquipment: (equipmentId: string) => boolean;
  acceptOffer: (contractId: string) => boolean;
  rejectOffer: (contractId: string) => boolean;
  setRuntimeState: (state: GameState) => void;
  recordError: (error: unknown, source: ErrorSource) => void;
  applyDevelopmentCommand: (command: DevelopmentCommand) => boolean;
  undoDevelopmentCommand: () => boolean;
  diagnosticReport: () => string;
}

function tutorialReady(state: GameState): GameState {
  let current = state;
  for (const [id, unit] of [
    ["equipment-refurbished-1", 0],
    ["equipment-router-1", 4],
    ["equipment-power-strip-1", 5],
    ["equipment-desk-fan-1", 6],
  ] as const) {
    const placed = placeEquipment(current, id, "rack-starter-1", unit);
    if (!placed.ok) throw new Error(placed.error.message);
    current = placed.state;
  }
  return current;
}

function scenarioState(
  scenario: Extract<DevelopmentCommand, { type: "scenario" }>["scenario"],
  current: GameState,
  now: number,
): GameState {
  const fresh = createInitialState({
    companyName: current.company.name,
    seed: current.rngSeed,
    startedAt: now,
  });
  if (scenario === "fresh") return fresh;
  if (scenario === "tutorial-ready") return tutorialReady(fresh);
  if (scenario === "tutorial-active") {
    const ready = tutorialReady(fresh);
    const accepted = acceptContract(
      ready,
      "contract-tutorial-1",
      "rack-starter-1",
    );
    if (!accepted.ok) throw new Error(accepted.error.message);
    return accepted.state;
  }
  if (scenario === "tutorial-failed") {
    const ready = tutorialReady(fresh);
    const accepted = acceptContract(
      ready,
      "contract-tutorial-1",
      "rack-starter-1",
    );
    if (!accepted.ok) throw new Error(accepted.error.message);
    const active = accepted.state.contracts.active[0];
    if (active === undefined) throw new Error("Tutorial contract is missing");
    return advanceGame(
      {
        ...accepted.state,
        facilities: accepted.state.facilities.map((facility) => ({
          ...facility,
          racks: facility.racks.map((rack) => ({
            ...rack,
            equipment: rack.equipment.map((equipment) => ({
              ...equipment,
              poweredOn: false,
            })),
          })),
        })),
        contracts: {
          ...accepted.state.contracts,
          active: [
            {
              ...active,
              violationSeconds: active.customerTolerance - 1,
            },
          ],
        },
      },
      1,
    );
  }
  if (scenario === "debt-warning") {
    return { ...fresh, company: { ...fresh.company, cash: -9_999.99 } };
  }
  if (scenario === "bankruptcy-at" || scenario === "bankruptcy-below") {
    return evaluateBankruptcy({
      ...fresh,
      company: {
        ...fresh.company,
        cash: scenario === "bankruptcy-at" ? -10_000 : -10_001,
      },
    });
  }
  if (scenario === "smart-reflow") {
    let layout = fresh;
    for (const [id, anchor] of [
      ["equipment-router-1", 6],
      ["equipment-power-strip-1", 7],
      ["equipment-desk-fan-1", 8],
      ["equipment-refurbished-1", 11],
    ] as const) {
      const result = relocateEquipment(layout, id, {
        kind: "rack",
        rackId: "rack-starter-1",
        anchorUnit: anchor,
      });
      if (!result.ok) throw new Error(result.error.message);
      layout = result.state;
    }
    return layout;
  }
  if (scenario === "overloaded-power" || scenario === "insufficient-cooling") {
    const rack = fresh.facilities[0]?.racks[0];
    if (rack === undefined) throw new Error("Starter rack is missing");
    const serverCount = scenario === "overloaded-power" ? 5 : 4;
    const powerDefinition =
      scenario === "overloaded-power" ? "power-strip" : "basic-ups";
    const powerStart = serverCount * 2;
    rack.equipment = [
      ...Array.from({ length: serverCount }, (_, index) => ({
        id: `dev-server-${String(index)}`,
        definitionId: "used-2u-compute",
        acquisitionPrice: 0,
        startUnit: index * 2,
        poweredOn: true,
      })),
      {
        id: "dev-power",
        definitionId: powerDefinition,
        acquisitionPrice: 0,
        startUnit: powerStart,
        poweredOn: true,
      },
    ];
    assertGameState(fresh);
    return fresh;
  }
  if (scenario === "inventory-stress" || scenario === "service-pool-stress") {
    const rack = fresh.facilities[0]?.racks[0];
    const template = fresh.contracts.offers[0];
    if (rack === undefined || template === undefined)
      throw new Error("Stress scenario fixture is missing");
    rack.equipment = Array.from({ length: 6 }, (_, index) => ({
      id: `stress-rack-${String(index)}`,
      definitionId: "used-2u-compute",
      acquisitionPrice: 300,
      startUnit: index * 2,
      poweredOn: true,
    }));
    if (scenario === "inventory-stress") {
      fresh.inventory = Array.from({ length: 30 }, (_, index) => ({
        id: `stress-inventory-${String(index)}`,
        definitionId: "consumer-router",
        acquisitionPrice: 45,
      }));
      assertGameState(fresh);
      return fresh;
    }
    rack.equipment = [
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `stress-rack-${String(index)}`,
        definitionId: "used-2u-compute",
        acquisitionPrice: 300,
        startUnit: index * 2,
        poweredOn: true,
      })),
      {
        id: "stress-power",
        definitionId: "power-strip",
        acquisitionPrice: 35,
        startUnit: 10,
        poweredOn: true,
      },
      {
        id: "stress-cooling",
        definitionId: "desk-fan",
        acquisitionPrice: 25,
        startUnit: 11,
        poweredOn: true,
      },
    ];
    const capacity = calculateAllRackCapacities(fresh).get("rack-starter-1");
    if (capacity === undefined)
      throw new Error("Stress rack capacity is missing");
    const duration = 300;
    const common = {
      ...template,
      totalDurationSeconds: duration,
      remainingSeconds: duration,
      customerTolerance: calculateSlaBufferSeconds(duration),
      violationSeconds: 0,
      performanceScore: 1,
    };
    fresh.progression.completedMilestones = [TUTORIAL_MILESTONE_ID];
    fresh.contracts = {
      ...fresh.contracts,
      active: [
        {
          ...common,
          id: "stress-active-a",
          status: "active",
          assignedTargetId: "rack-starter-1",
          requirements: { compute: capacity.compute * 0.4 },
        },
        {
          ...common,
          id: "stress-active-b",
          status: "active",
          assignedTargetId: "rack-starter-1",
          requirements: { compute: capacity.compute * 0.4 },
        },
      ],
      offers: [
        {
          ...common,
          id: "stress-offer",
          status: "offered",
          assignedTargetId: undefined,
          requirements: { compute: capacity.compute * 0.3 },
        },
      ],
    };
    assertGameState(fresh);
    return fresh;
  }
  const unlocked = fillStarterMarketplace({
    ...fresh,
    progression: {
      ...fresh.progression,
      completedMilestones: [TUTORIAL_MILESTONE_ID],
    },
    contracts: { ...fresh.contracts, offers: [] },
  });
  if (scenario === "marketplace") return unlocked;
  return {
    ...unlocked,
    company: {
      ...unlocked.company,
      cash: 987_654_321,
      reputation: 500,
      researchPoints: 250,
      currentTier: "regional-provider",
    },
  };
}

export function createGameStore(
  dependencies: AppStoreDependencies,
): StoreApi<AppStoreState> {
  const errorLog = new BoundedErrorLog(dependencies.clock, 30);
  let notificationSequence = 0;
  let developmentLogSequence = 0;

  return createStore<AppStoreState>()((set, get) => {
    const pushNotification = (input: NotificationInput): void => {
      notificationSequence += 1;
      const notification: AppNotification = {
        id: `notification-${String(notificationSequence)}`,
        key: input.key ?? null,
        type: input.type,
        message: input.message,
        durationMilliseconds:
          input.durationMilliseconds ??
          NOTIFICATION_DURATION_MILLISECONDS[input.type],
      };
      set((state) => ({
        notifications: [
          ...state.notifications.filter(
            (existing) =>
              notification.key === null || existing.key !== notification.key,
          ),
          notification,
        ].slice(-6),
      }));
    };
    const refreshSlots = async (): Promise<boolean> => {
      const listed = await dependencies.saves.list();
      if (!listed.ok) {
        get().recordError(listed.error, "storage");
        return false;
      }
      set({ slots: listed.value });
      return true;
    };

    const applyResult = (result: GameCommandResult): boolean => {
      if (!result.ok) {
        pushNotification({
          key: "command-error",
          type: "warning",
          message: result.error.message,
        });
        return false;
      }
      set({ gameState: result.state });
      return true;
    };

    return {
      screen: "boot",
      gameView: "facility",
      slots: [],
      options: { ...DEFAULT_OPTIONS },
      gameState: null,
      activeSlot: null,
      saveStatus: "idle",
      notifications: [],
      previewUiScale: null,
      pauseMenuOpen: false,
      dragActive: false,
      paused: false,
      speed: 1,
      freezeExpenses: false,
      developmentModified: false,
      undoState: null,
      developmentLog: [],
      errors: [],

      boot: async () => {
        const recovered = await dependencies.saves.recoverTemporaryWrites();
        if (!recovered.ok) get().recordError(recovered.error, "storage");
        const loadedOptions = await dependencies.options.load();
        if (loadedOptions.ok) set({ options: loadedOptions.value });
        else get().recordError(loadedOptions.error, "storage");
        await refreshSlots();
        set({ screen: "menu" });
      },

      navigate: (screen) => {
        set({ screen, previewUiScale: null });
      },
      setGameView: (gameView) => {
        set({ gameView });
      },
      notify: (notification) => {
        pushNotification(notification);
      },
      dismissNotification: (notificationId) => {
        set((state) => ({
          notifications: state.notifications.filter(
            ({ id }) => id !== notificationId,
          ),
        }));
      },
      setUiScalePreview: (previewUiScale) => {
        set({ previewUiScale });
      },

      createGame: async (slotId, companyName) => {
        const trimmed = companyName.trim();
        if (trimmed.length === 0 || trimmed.length > 60) {
          pushNotification({
            key: "new-game-error",
            type: "warning",
            message: "Enter a company name between 1 and 60 characters.",
          });
          return false;
        }
        const now = dependencies.clock.now();
        let state: GameState;
        try {
          state = createInitialState({
            companyName: trimmed,
            startedAt: now,
            seed: Math.floor(now) >>> 0,
          });
        } catch (error: unknown) {
          get().recordError(error, "command");
          return false;
        }
        const saved = await dependencies.saves.save(slotId, state, {
          lastPlayed: now,
          developmentModified: false,
        });
        if (!saved.ok) {
          get().recordError(saved.error, "save");
          pushNotification({
            key: "save-error",
            type: "error",
            message: `${saved.error.message}. Check browser storage and try again.`,
          });
          return false;
        }
        set({
          screen: "game",
          gameView: "facility",
          gameState: state,
          activeSlot: slotId,
          saveStatus: "saved",
          developmentModified: false,
          pauseMenuOpen: false,
        });
        pushNotification({
          key: "onboarding",
          type: "information",
          message:
            "Install the four starter items, then review Gravy's contract.",
          durationMilliseconds: 5_000,
        });
        await refreshSlots();
        return true;
      },

      continueGame: async () => {
        const candidate = [...get().slots]
          .filter(({ health }) => health === "valid")
          .sort(
            (left, right) => (right.lastPlayed ?? 0) - (left.lastPlayed ?? 0),
          )[0];
        if (candidate === undefined) {
          pushNotification({
            key: "continue-error",
            type: "information",
            message: "No valid save is available to continue.",
            durationMilliseconds: 5_000,
          });
          return false;
        }
        return get().loadSlot(candidate.slotId);
      },

      loadSlot: async (slotId) => {
        const loaded = await dependencies.saves.load(slotId);
        if (!loaded.ok) {
          get().recordError(loaded.error, "save");
          pushNotification({
            key: "load-error",
            type: "error",
            message: loaded.error.message,
          });
          return false;
        }
        set({
          screen: "game",
          gameView: "facility",
          gameState: loaded.value.state,
          activeSlot: slotId,
          developmentModified: loaded.value.developmentModified,
          saveStatus: "saved",
          pauseMenuOpen: false,
        });
        return true;
      },

      saveNow: async () => {
        const state = get().gameState;
        const slotId = get().activeSlot;
        if (state === null || slotId === null) return false;
        set({ saveStatus: "saving" });
        const now = dependencies.clock.now();
        const stamped = stampLastSaved(state, now);
        const saved = await dependencies.saves.save(slotId, stamped, {
          lastPlayed: now,
          developmentModified: get().developmentModified,
        });
        if (!saved.ok) {
          get().recordError(saved.error, "save");
          set({ saveStatus: "failed" });
          pushNotification({
            key: "save-error",
            type: "error",
            message: saved.error.message,
          });
          return false;
        }
        set({
          gameState: stamped,
          saveStatus: "saved",
        });
        pushNotification({
          key: "save-success",
          type: "success",
          message: "Game saved.",
          durationMilliseconds: 5_000,
        });
        await refreshSlots();
        return true;
      },

      returnToMenu: async (withoutSaving = false) => {
        if (!withoutSaving && !(await get().saveNow())) {
          set({ pauseMenuOpen: true });
          pushNotification({
            key: "save-error",
            type: "error",
            message: "Saving failed. Cancel, retry, or return without saving.",
          });
          return false;
        }
        set({
          screen: "menu",
          gameState: null,
          activeSlot: null,
          pauseMenuOpen: false,
          paused: false,
          speed: 1,
        });
        await refreshSlots();
        return true;
      },

      deleteSlot: async (slotId) => {
        const deleted = await dependencies.saves.delete(slotId);
        if (!deleted.ok) {
          get().recordError(deleted.error, "save");
          pushNotification({
            key: "delete-error",
            type: "error",
            message: deleted.error.message,
          });
          return false;
        }
        await refreshSlots();
        pushNotification({
          key: "slot-action",
          type: "information",
          message: `${slotId.replace("slot-", "Slot ")} deleted.`,
          durationMilliseconds: 5_000,
        });
        return true;
      },

      deleteActiveCompanyAndStartOver: async () => {
        const slotId = get().activeSlot;
        if (slotId === null) return false;
        const deleted = await dependencies.saves.delete(slotId);
        if (!deleted.ok) {
          get().recordError(deleted.error, "save");
          return false;
        }
        set({
          screen: "new-game",
          gameState: null,
          activeSlot: null,
          pauseMenuOpen: false,
          paused: false,
          speed: 1,
        });
        await refreshSlots();
        return true;
      },

      restoreBackup: async (slotId) => {
        const restored = await dependencies.saves.restoreBackup(slotId);
        if (!restored.ok) {
          get().recordError(restored.error, "save");
          pushNotification({
            key: "restore-error",
            type: "error",
            message: restored.error.message,
          });
          return false;
        }
        await refreshSlots();
        pushNotification({
          key: "slot-action",
          type: "success",
          message: "Last-known-good backup restored.",
          durationMilliseconds: 5_000,
        });
        return true;
      },

      exportSlot: async (slotId) => {
        const exported = await dependencies.saves.export(slotId);
        if (!exported.ok) {
          get().recordError(exported.error, "save");
          pushNotification({
            key: "export-error",
            type: "error",
            message: exported.error.message,
          });
          return false;
        }
        const downloaded = dependencies.files.downloadJson(
          `racks-to-riches-${slotId}.json`,
          exported.value,
        );
        if (!downloaded.ok) {
          get().recordError(downloaded.error, "save");
          return false;
        }
        pushNotification({
          key: "slot-action",
          type: "success",
          message: "Save exported.",
          durationMilliseconds: 5_000,
        });
        return true;
      },

      importSlot: async (slotId, file) => {
        const read = await dependencies.files.readText(file);
        if (!read.ok) {
          get().recordError(read.error, "import");
          pushNotification({
            key: "import-error",
            type: "error",
            message: read.error.message,
          });
          return false;
        }
        const imported = await dependencies.saves.import(slotId, read.value, {
          lastPlayed: dependencies.clock.now(),
          developmentModified: false,
        });
        if (!imported.ok) {
          get().recordError(imported.error, "import");
          pushNotification({
            key: "import-error",
            type: "error",
            message: "Import failed. The existing slot was not changed.",
          });
          return false;
        }
        await refreshSlots();
        pushNotification({
          key: "slot-action",
          type: "success",
          message: "Save imported successfully.",
          durationMilliseconds: 5_000,
        });
        return true;
      },

      updateOptions: async (options) => {
        const saved = await dependencies.options.save(options);
        if (!saved.ok) {
          get().recordError(saved.error, "storage");
          pushNotification({
            key: "options-error",
            type: "error",
            message: saved.error.message,
          });
          return false;
        }
        if (dependencies.fullscreen.supported) {
          const fullscreen = await dependencies.fullscreen.setEnabled(
            options.fullscreen,
          );
          if (!fullscreen.ok) get().recordError(fullscreen.error, "global");
        }
        set({ options, previewUiScale: null });
        pushNotification({
          key: "options-saved",
          type: "success",
          message: "Options saved.",
          durationMilliseconds: 5_000,
        });
        return true;
      },

      togglePauseMenu: (open) => {
        set((state) => ({ pauseMenuOpen: open ?? !state.pauseMenuOpen }));
      },
      setDragActive: (dragActive) => {
        set({ dragActive });
      },

      installEquipment: (equipmentId, startUnit) => {
        const state = get().gameState;
        if (state === null) return false;
        const result = relocateEquipment(state, equipmentId, {
          kind: "rack",
          rackId: "rack-starter-1",
          anchorUnit: startUnit,
        });
        if (!result.ok) {
          pushNotification({
            key: "placement",
            type: "warning",
            message: result.error.message,
          });
          return false;
        }
        set({ gameState: result.state });
        return true;
      },

      moveInstalledEquipment: (equipmentId, startUnit) => {
        const state = get().gameState;
        if (state === null) return false;
        const result = relocateEquipment(state, equipmentId, {
          kind: "rack",
          rackId: "rack-starter-1",
          anchorUnit: startUnit,
        });
        if (!result.ok) {
          pushNotification({
            key: "placement",
            type: "warning",
            message: result.error.message,
          });
          return false;
        }
        set({ gameState: result.state });
        return true;
      },
      removeInstalledEquipment: (equipmentId) => {
        const state = get().gameState;
        if (state === null) return false;
        const result = relocateEquipment(state, equipmentId, {
          kind: "inventory",
        });
        if (!result.ok) {
          pushNotification({
            key: "placement",
            type: "warning",
            message: result.error.message,
          });
          return false;
        }
        set({ gameState: result.state });
        return true;
      },
      previewEquipmentRelocation: (equipmentId, startUnit) => {
        const state = get().gameState;
        return state === null
          ? null
          : relocateEquipment(state, equipmentId, {
              kind: "rack",
              rackId: "rack-starter-1",
              anchorUnit: startUnit,
            });
      },
      toggleEquipment: (equipmentId, poweredOn) => {
        const state = get().gameState;
        return state === null
          ? false
          : applyResult(setEquipmentPower(state, equipmentId, poweredOn));
      },
      buyEquipment: (definitionId) => {
        const state = get().gameState;
        return state === null
          ? false
          : applyResult(purchaseEquipment(state, definitionId));
      },
      sellInventoryEquipment: (equipmentId) => {
        const state = get().gameState;
        return state === null
          ? false
          : applyResult(sellEquipment(state, equipmentId));
      },
      acceptOffer: (contractId) => {
        const state = get().gameState;
        return state === null
          ? false
          : applyResult(acceptContract(state, contractId, "rack-starter-1"));
      },
      rejectOffer: (contractId) => {
        const state = get().gameState;
        return state === null
          ? false
          : applyResult(rejectContractOffer(state, contractId));
      },

      setRuntimeState: (gameState) => {
        const previous = get().gameState;
        set({ gameState });
        const completedBefore =
          previous?.progression.completedMilestones.includes(
            TUTORIAL_MILESTONE_ID,
          ) ?? false;
        const completedNow = gameState.progression.completedMilestones.includes(
          TUTORIAL_MILESTONE_ID,
        );
        if (!completedBefore && completedNow) {
          pushNotification({
            key: "tutorial-complete",
            type: "success",
            message:
              "Tutorial complete · Store and starter marketplace unlocked.",
            durationMilliseconds: 5_000,
          });
        }
      },

      recordError: (error, source) => {
        const record = errorLog.add(error, source);
        set({ errors: errorLog.list() });
        pushNotification({
          key: `error-${source}`,
          type: "error",
          message: record.message,
        });
      },

      applyDevelopmentCommand: (command) => {
        const state = get().gameState;
        if (state === null) return false;
        let next = state;
        try {
          switch (command.type) {
            case "add-cash":
              next = evaluateBankruptcy({
                ...state,
                company: {
                  ...state.company,
                  cash: state.company.cash + command.amount,
                },
              });
              break;
            case "set-cash":
              next = evaluateBankruptcy({
                ...state,
                company: { ...state.company, cash: command.amount },
              });
              break;
            case "add-reputation":
              next = {
                ...state,
                company: {
                  ...state.company,
                  reputation: state.company.reputation + command.amount,
                },
              };
              break;
            case "add-research":
              next = {
                ...state,
                company: {
                  ...state.company,
                  researchPoints: state.company.researchPoints + command.amount,
                },
              };
              break;
            case "toggle-expenses":
              set({ freezeExpenses: !get().freezeExpenses });
              break;
            case "toggle-pause":
              set({ paused: !get().paused });
              break;
            case "set-speed":
              set({ speed: command.speed });
              break;
            case "advance":
              next = advanceGame(state, command.seconds);
              break;
            case "generate-contract":
              next = fillStarterMarketplace({
                ...state,
                progression: {
                  ...state.progression,
                  completedMilestones:
                    state.progression.completedMilestones.includes(
                      TUTORIAL_MILESTONE_ID,
                    )
                      ? state.progression.completedMilestones
                      : [
                          ...state.progression.completedMilestones,
                          TUTORIAL_MILESTONE_ID,
                        ],
                },
                contracts: {
                  ...state.contracts,
                  offers: state.contracts.offers.slice(0, 2),
                },
              });
              break;
            case "complete-contract": {
              const contractId =
                command.contractId ?? state.contracts.active[0]?.id;
              if (contractId === undefined)
                throw new Error("No active contract selected");
              next = {
                ...state,
                contracts: {
                  ...state.contracts,
                  active: state.contracts.active.map((contract) =>
                    contract.id === contractId
                      ? { ...contract, remainingSeconds: 0.01 }
                      : contract,
                  ),
                },
              };
              next = advanceGame(next, 0.01);
              break;
            }
            case "near-expiry": {
              const contractId =
                command.contractId ?? state.contracts.active[0]?.id;
              if (contractId === undefined)
                throw new Error("No active contract selected");
              next = {
                ...state,
                contracts: {
                  ...state.contracts,
                  active: state.contracts.active.map((contract) =>
                    contract.id === contractId
                      ? {
                          ...contract,
                          remainingSeconds: Math.min(
                            5,
                            contract.remainingSeconds,
                          ),
                        }
                      : contract,
                  ),
                },
              };
              break;
            }
            case "sla-violation": {
              const contractId =
                command.contractId ?? state.contracts.active[0]?.id;
              if (contractId === undefined)
                throw new Error("No active contract selected");
              next = {
                ...state,
                facilities: state.facilities.map((facility) => ({
                  ...facility,
                  racks: facility.racks.map((rack) => ({
                    ...rack,
                    equipment: rack.equipment.map((equipment) => ({
                      ...equipment,
                      poweredOn: false,
                    })),
                  })),
                })),
                contracts: {
                  ...state.contracts,
                  active: state.contracts.active.map((contract) =>
                    contract.id === contractId
                      ? {
                          ...contract,
                          violationSeconds: Math.max(
                            0,
                            contract.customerTolerance - 5,
                          ),
                        }
                      : contract,
                  ),
                },
              };
              break;
            }
            case "clear-offers":
              next = {
                ...state,
                contracts: {
                  ...state.contracts,
                  offers: state.contracts.offers.filter(
                    ({ id }) => id === "contract-tutorial-1",
                  ),
                },
              };
              break;
            case "validate-state":
              next = state;
              break;
            case "scenario":
              next = scenarioState(
                command.scenario,
                state,
                dependencies.clock.now(),
              );
              break;
          }
          assertGameState(next);
        } catch (error: unknown) {
          get().recordError(error, "command");
          return false;
        }
        const timestamp = dependencies.clock.now();
        developmentLogSequence += 1;
        const entry: DevelopmentLogRecord = {
          id: `development-log-${String(developmentLogSequence)}`,
          timestamp,
          commandType: command.type,
          message: `${command.type} applied at ${new Date(timestamp).toLocaleTimeString()}`,
        };
        set({
          gameState: next,
          undoState: state,
          developmentModified: true,
          developmentLog: [...get().developmentLog, entry].slice(-20),
        });
        const tutorialCompleted =
          command.type !== "scenario" &&
          !state.progression.completedMilestones.includes(
            TUTORIAL_MILESTONE_ID,
          ) &&
          next.progression.completedMilestones.includes(TUTORIAL_MILESTONE_ID);
        if (tutorialCompleted) {
          pushNotification({
            key: "tutorial-complete",
            type: "success",
            message:
              "Tutorial complete · Store and starter marketplace unlocked.",
            durationMilliseconds: 5_000,
          });
        }
        if (command.type === "scenario") {
          set({
            pauseMenuOpen: false,
            notifications: [],
          });
        }
        if (
          state.progression.terminalState === null &&
          next.progression.terminalState !== null
        ) {
          void get().saveNow();
        }
        return true;
      },

      undoDevelopmentCommand: () => {
        const undoState = get().undoState;
        if (undoState === null) return false;
        const timestamp = dependencies.clock.now();
        developmentLogSequence += 1;
        const undoEntry: DevelopmentLogRecord = {
          id: `development-log-${String(developmentLogSequence)}`,
          timestamp,
          commandType: "undo",
          message: "Latest development command undone",
        };
        set({
          gameState: undoState,
          undoState: null,
          developmentModified: true,
          developmentLog: [...get().developmentLog, undoEntry].slice(-20),
        });
        return true;
      },

      diagnosticReport: () => {
        const state = get();
        return JSON.stringify(
          {
            screen: state.screen,
            view: state.gameView,
            slot: state.activeSlot,
            saveStatus: state.saveStatus,
            speed: state.speed,
            paused: state.paused,
            freezeExpenses: state.freezeExpenses,
            rngSeed: state.gameState?.rngSeed ?? null,
            version: state.gameState?.version ?? null,
            recentErrors: state.errors.slice(-5),
          },
          null,
          2,
        );
      },
    };
  });
}
