import { z } from "zod";

import { loadGame, serializeGame } from "../game";
import type { GameState } from "../game";
import {
  SAVE_SLOT_IDS,
  type KeyValueStorage,
  type LoadedSave,
  type RepositoryError,
  type RepositoryResult,
  type SaveRepository,
  type SaveSlotId,
  type SaveSlotSummary,
  type SaveWriteOptions,
} from "./types";

const recordSchema = z
  .object({
    payload: z.string().min(1),
    lastPlayed: z.number().nonnegative(),
    developmentModified: z.boolean(),
  })
  .strict();

interface ParsedRecord extends LoadedSave {
  raw: string;
}

function repositoryError(
  code: RepositoryError["code"],
  message: string,
  cause: unknown = null,
): RepositoryError {
  return {
    code,
    message,
    cause:
      cause instanceof Error
        ? cause.message
        : typeof cause === "string"
          ? cause
          : cause === null
            ? null
            : "Unknown storage error",
  };
}

function success<T>(value: T): RepositoryResult<T> {
  return { ok: true, value };
}

function failure<T>(error: RepositoryError): RepositoryResult<T> {
  return { ok: false, error };
}

function parseRecord(raw: string): RepositoryResult<ParsedRecord> {
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch (error: unknown) {
    return failure(
      repositoryError("INVALID_DATA", "Save record is not valid JSON", error),
    );
  }
  const record = recordSchema.safeParse(input);
  if (!record.success) {
    return failure(
      repositoryError(
        "INVALID_DATA",
        record.error.issues.map(({ message }) => message).join("; "),
      ),
    );
  }
  const loaded = loadGame(record.data.payload);
  if (!loaded.ok) {
    return failure(
      repositoryError(
        loaded.error.kind === "unsupported-version"
          ? "UNSUPPORTED_VERSION"
          : "INVALID_DATA",
        loaded.error.kind === "invalid-save"
          ? loaded.error.issues.join("; ")
          : loaded.error.kind === "malformed-json"
            ? loaded.error.message
            : `Unsupported save version ${String(loaded.error.version)}`,
      ),
    );
  }
  return success({
    state: loaded.state,
    lastPlayed: record.data.lastPlayed,
    developmentModified: record.data.developmentModified,
    raw,
  });
}

export class WebSaveRepository implements SaveRepository {
  constructor(private readonly storage: KeyValueStorage) {}

  private key(
    slotId: SaveSlotId,
    record: "current" | "temporary" | "backup" | "corrupt",
  ) {
    return `racks-to-riches:${slotId}:${record}`;
  }

  private read(slotId: SaveSlotId, record: "current" | "temporary" | "backup") {
    const raw = this.storage.getItem(this.key(slotId, record));
    return raw === null
      ? failure<ParsedRecord>(
          repositoryError("NOT_FOUND", `${record} save is empty`),
        )
      : parseRecord(raw);
  }

  async list(): Promise<RepositoryResult<readonly SaveSlotSummary[]>> {
    await Promise.resolve();
    try {
      const summaries = SAVE_SLOT_IDS.map((slotId): SaveSlotSummary => {
        const currentRaw = this.storage.getItem(this.key(slotId, "current"));
        const backup = this.read(slotId, "backup");
        const temporary = this.read(slotId, "temporary");
        const current =
          currentRaw === null
            ? failure<ParsedRecord>(
                repositoryError("NOT_FOUND", "Slot is empty"),
              )
            : parseRecord(currentRaw);
        const fallback = backup.ok ? backup : temporary.ok ? temporary : null;
        const source = current.ok ? current : fallback;
        const health =
          currentRaw === null && fallback === null
            ? "empty"
            : current.ok
              ? "valid"
              : fallback === null
                ? "invalid"
                : "recoverable";
        return {
          slotId,
          companyName: source?.ok ? source.value.state.company.name : null,
          cash: source?.ok ? source.value.state.company.cash : null,
          reputationTier: source?.ok
            ? source.value.state.company.currentTier
            : null,
          playtimeSeconds: source?.ok
            ? source.value.state.statistics.totalOnlineSeconds
            : null,
          lastPlayed: source?.ok ? source.value.lastPlayed : null,
          version: source?.ok ? source.value.state.version : null,
          developmentModified: source?.ok
            ? source.value.developmentModified
            : false,
          health,
          backupAvailable: fallback !== null,
          detail: current.ok
            ? null
            : currentRaw === null
              ? null
              : current.error.message,
        };
      });
      return success(summaries);
    } catch (error: unknown) {
      return failure(
        repositoryError(
          "READ_FAILED",
          "Could not inspect browser saves",
          error,
        ),
      );
    }
  }

  async recoverTemporaryWrites(): Promise<RepositoryResult<void>> {
    await Promise.resolve();
    try {
      for (const slotId of SAVE_SLOT_IDS) {
        const temporaryRaw = this.storage.getItem(
          this.key(slotId, "temporary"),
        );
        if (temporaryRaw === null) continue;
        const temporary = parseRecord(temporaryRaw);
        const currentRaw = this.storage.getItem(this.key(slotId, "current"));
        const current = currentRaw === null ? null : parseRecord(currentRaw);
        if (current?.ok) {
          this.storage.removeItem(this.key(slotId, "temporary"));
        } else if (currentRaw === null && temporary.ok) {
          this.storage.setItem(this.key(slotId, "current"), temporaryRaw);
          this.storage.removeItem(this.key(slotId, "temporary"));
        }
      }
      return success(undefined);
    } catch (error: unknown) {
      return failure(
        repositoryError(
          "READ_FAILED",
          "Could not recover temporary saves",
          error,
        ),
      );
    }
  }

  async save(
    slotId: SaveSlotId,
    state: GameState,
    options: SaveWriteOptions,
  ): Promise<RepositoryResult<void>> {
    await Promise.resolve();
    let candidate: string;
    try {
      candidate = JSON.stringify({
        payload: serializeGame(state),
        lastPlayed: options.lastPlayed,
        developmentModified: options.developmentModified,
      });
    } catch (error: unknown) {
      return failure(
        repositoryError(
          "INVALID_DATA",
          "The game state is not safe to save",
          error,
        ),
      );
    }
    try {
      const temporaryKey = this.key(slotId, "temporary");
      this.storage.setItem(temporaryKey, candidate);
      const verified = this.storage.getItem(temporaryKey);
      if (verified === null || !parseRecord(verified).ok) {
        return failure(
          repositoryError("WRITE_FAILED", "Temporary save verification failed"),
        );
      }
      const currentKey = this.key(slotId, "current");
      const previous = this.storage.getItem(currentKey);
      if (previous !== null && parseRecord(previous).ok) {
        this.storage.setItem(this.key(slotId, "backup"), previous);
      }
      this.storage.setItem(currentKey, verified);
      const promoted = this.storage.getItem(currentKey);
      if (promoted === null || !parseRecord(promoted).ok) {
        return failure(
          repositoryError("WRITE_FAILED", "Save promotion failed"),
        );
      }
      this.storage.removeItem(temporaryKey);
      return success(undefined);
    } catch (error: unknown) {
      return failure(
        repositoryError(
          "STORAGE_UNAVAILABLE",
          "Browser storage rejected the save",
          error,
        ),
      );
    }
  }

  async load(slotId: SaveSlotId): Promise<RepositoryResult<LoadedSave>> {
    await Promise.resolve();
    try {
      const current = this.read(slotId, "current");
      return current.ok
        ? success({
            state: current.value.state,
            lastPlayed: current.value.lastPlayed,
            developmentModified: current.value.developmentModified,
          })
        : failure(current.error);
    } catch (error: unknown) {
      return failure(
        repositoryError("READ_FAILED", "Could not load the save", error),
      );
    }
  }

  async delete(slotId: SaveSlotId): Promise<RepositoryResult<void>> {
    await Promise.resolve();
    try {
      for (const record of [
        "current",
        "temporary",
        "backup",
        "corrupt",
      ] as const)
        this.storage.removeItem(this.key(slotId, record));
      return success(undefined);
    } catch (error: unknown) {
      return failure(
        repositoryError("WRITE_FAILED", "Could not delete the slot", error),
      );
    }
  }

  async export(slotId: SaveSlotId): Promise<RepositoryResult<string>> {
    const loaded = await this.load(slotId);
    return loaded.ok ? success(serializeGame(loaded.value.state)) : loaded;
  }

  async exportDiagnostics(
    slotId: SaveSlotId,
  ): Promise<RepositoryResult<string>> {
    await Promise.resolve();
    try {
      return success(
        JSON.stringify(
          {
            slotId,
            current: this.storage.getItem(this.key(slotId, "current")),
            temporary: this.storage.getItem(this.key(slotId, "temporary")),
            backup: this.storage.getItem(this.key(slotId, "backup")),
          },
          null,
          2,
        ),
      );
    } catch (error: unknown) {
      return failure(
        repositoryError("READ_FAILED", "Could not export diagnostics", error),
      );
    }
  }

  async import(
    slotId: SaveSlotId,
    serialized: string,
    options: SaveWriteOptions,
  ): Promise<RepositoryResult<void>> {
    const loaded = loadGame(serialized);
    if (!loaded.ok) {
      return failure(
        repositoryError(
          loaded.error.kind === "unsupported-version"
            ? "UNSUPPORTED_VERSION"
            : "INVALID_DATA",
          "Imported file is not a valid supported save",
        ),
      );
    }
    return this.save(slotId, loaded.state, options);
  }

  async restoreBackup(slotId: SaveSlotId): Promise<RepositoryResult<void>> {
    await Promise.resolve();
    try {
      const backup = this.read(slotId, "backup");
      const temporary = this.read(slotId, "temporary");
      const recovery = backup.ok ? backup : temporary;
      if (!recovery.ok) return failure(recovery.error);
      const current = this.storage.getItem(this.key(slotId, "current"));
      if (current !== null && !parseRecord(current).ok)
        this.storage.setItem(this.key(slotId, "corrupt"), current);
      this.storage.setItem(this.key(slotId, "current"), recovery.value.raw);
      this.storage.removeItem(this.key(slotId, "temporary"));
      return success(undefined);
    } catch (error: unknown) {
      return failure(
        repositoryError("WRITE_FAILED", "Could not restore the backup", error),
      );
    }
  }
}
