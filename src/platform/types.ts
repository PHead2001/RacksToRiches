import type { GameState, ReputationTierId } from "../game";

export const SAVE_SLOT_IDS = [
  "slot-1",
  "slot-2",
  "slot-3",
  "slot-4",
  "slot-5",
] as const;

export type SaveSlotId = (typeof SAVE_SLOT_IDS)[number];
type SaveHealth = "empty" | "valid" | "recoverable" | "invalid";

export interface SaveSlotSummary {
  slotId: SaveSlotId;
  companyName: string | null;
  cash: number | null;
  reputationTier: ReputationTierId | null;
  playtimeSeconds: number | null;
  lastPlayed: number | null;
  version: number | null;
  developmentModified: boolean;
  health: SaveHealth;
  backupAvailable: boolean;
  detail: string | null;
}

export interface LoadedSave {
  state: GameState;
  lastPlayed: number;
  developmentModified: boolean;
}

export interface SaveWriteOptions {
  lastPlayed: number;
  developmentModified: boolean;
}

type RepositoryErrorCode =
  | "NOT_FOUND"
  | "INVALID_DATA"
  | "UNSUPPORTED_VERSION"
  | "STORAGE_UNAVAILABLE"
  | "WRITE_FAILED"
  | "READ_FAILED";

export interface RepositoryError {
  code: RepositoryErrorCode;
  message: string;
  cause: string | null;
}

export type RepositoryResult<T> =
  { ok: true; value: T } | { ok: false; error: RepositoryError };

export interface SaveRepository {
  list(): Promise<RepositoryResult<readonly SaveSlotSummary[]>>;
  recoverTemporaryWrites(): Promise<RepositoryResult<void>>;
  save(
    slotId: SaveSlotId,
    state: GameState,
    options: SaveWriteOptions,
  ): Promise<RepositoryResult<void>>;
  load(slotId: SaveSlotId): Promise<RepositoryResult<LoadedSave>>;
  delete(slotId: SaveSlotId): Promise<RepositoryResult<void>>;
  export(slotId: SaveSlotId): Promise<RepositoryResult<string>>;
  exportDiagnostics(slotId: SaveSlotId): Promise<RepositoryResult<string>>;
  import(
    slotId: SaveSlotId,
    serialized: string,
    options: SaveWriteOptions,
  ): Promise<RepositoryResult<void>>;
  restoreBackup(slotId: SaveSlotId): Promise<RepositoryResult<void>>;
}

type UiScale = "compact" | "standard" | "large";
export type AutosaveInterval = 60 | 300 | 600 | 900 | 1800;

export interface AppOptions {
  uiScale: UiScale;
  reducedMotion: boolean;
  compactNumbers: boolean;
  autosaveEnabled: boolean;
  autosaveIntervalSeconds: AutosaveInterval;
  fullscreen: boolean;
}

export interface OptionsRepository {
  load(): Promise<RepositoryResult<AppOptions>>;
  save(options: AppOptions): Promise<RepositoryResult<void>>;
}

export interface Clock {
  now(): number;
}

export interface Scheduler {
  setInterval(callback: () => void, intervalMilliseconds: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface TextFile {
  text(): Promise<string>;
}

export interface FileTransfer {
  downloadJson(filename: string, contents: string): RepositoryResult<void>;
  readText(file: TextFile): Promise<RepositoryResult<string>>;
}

export interface FullscreenCapability {
  readonly supported: boolean;
  setEnabled(enabled: boolean): Promise<RepositoryResult<void>>;
}

export interface ApplicationCapabilities {
  readonly canQuit: boolean;
  readonly developmentTools: boolean;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
