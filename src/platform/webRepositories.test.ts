import { describe, expect, it } from "vitest";

import { createInitialState, serializeGame } from "../game";
import type { KeyValueStorage } from "./types";
import { DEFAULT_OPTIONS, WebOptionsRepository } from "./webOptionsRepository";
import { WebSaveRepository } from "./webSaveRepository";

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error("quota exceeded");
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("WebSaveRepository", () => {
  it("lists exactly five slots and round-trips validated saves", async () => {
    const storage = new MemoryStorage();
    const repository = new WebSaveRepository(storage);
    const empty = await repository.list();
    expect(empty.ok && empty.value).toHaveLength(5);
    expect(
      await repository.save(
        "slot-1",
        createInitialState({ companyName: "Slot One" }),
        { lastPlayed: 100, developmentModified: true },
      ),
    ).toMatchObject({ ok: true });
    const loaded = await repository.load("slot-1");
    expect(loaded.ok && loaded.value.state.company.name).toBe("Slot One");
    const listed = await repository.list();
    expect(listed.ok && listed.value[0]).toMatchObject({
      health: "valid",
      companyName: "Slot One",
      developmentModified: true,
    });
  });

  it("keeps a last-known-good backup and restores corrupt current data", async () => {
    const storage = new MemoryStorage();
    const repository = new WebSaveRepository(storage);
    await repository.save(
      "slot-1",
      createInitialState({ companyName: "Backup" }),
      { lastPlayed: 1, developmentModified: false },
    );
    await repository.save(
      "slot-1",
      createInitialState({ companyName: "Current" }),
      { lastPlayed: 2, developmentModified: false },
    );
    storage.values.set("racks-to-riches:slot-1:current", "broken");
    const listed = await repository.list();
    expect(listed.ok && listed.value[0]?.health).toBe("recoverable");
    expect(await repository.restoreBackup("slot-1")).toMatchObject({
      ok: true,
    });
    const loaded = await repository.load("slot-1");
    expect(loaded.ok && loaded.value.state.company.name).toBe("Backup");
    expect(storage.values.get("racks-to-riches:slot-1:corrupt")).toBe("broken");
  });

  it("recovers a valid interrupted temporary write only when current is empty", async () => {
    const storage = new MemoryStorage();
    const repository = new WebSaveRepository(storage);
    await repository.save("slot-1", createInitialState(), {
      lastPlayed: 1,
      developmentModified: false,
    });
    const current = storage.values.get("racks-to-riches:slot-1:current");
    expect(current).toBeDefined();
    if (current === undefined) return;
    storage.values.delete("racks-to-riches:slot-1:current");
    storage.values.set("racks-to-riches:slot-1:temporary", current);
    await repository.recoverTemporaryWrites();
    expect(await repository.load("slot-1")).toMatchObject({ ok: true });
    expect(storage.values.has("racks-to-riches:slot-1:temporary")).toBe(false);
  });

  it("offers explicit restoration when a valid temporary record accompanies corrupt current data", async () => {
    const storage = new MemoryStorage();
    const repository = new WebSaveRepository(storage);
    await repository.save(
      "slot-1",
      createInitialState({ companyName: "Interrupted" }),
      {
        lastPlayed: 1,
        developmentModified: false,
      },
    );
    const candidate = storage.values.get("racks-to-riches:slot-1:current");
    expect(candidate).toBeDefined();
    if (candidate === undefined) return;
    storage.values.set("racks-to-riches:slot-1:temporary", candidate);
    storage.values.set("racks-to-riches:slot-1:current", "corrupt current");
    const listed = await repository.list();
    expect(listed.ok && listed.value[0]).toMatchObject({
      health: "recoverable",
      backupAvailable: true,
    });
    expect(await repository.restoreBackup("slot-1")).toMatchObject({
      ok: true,
    });
    expect(await repository.load("slot-1")).toMatchObject({ ok: true });
    expect(storage.values.get("racks-to-riches:slot-1:corrupt")).toBe(
      "corrupt current",
    );
  });

  it("rejects malformed imports without replacing the existing slot", async () => {
    const storage = new MemoryStorage();
    const repository = new WebSaveRepository(storage);
    await repository.save(
      "slot-1",
      createInitialState({ companyName: "Keep Me" }),
      { lastPlayed: 1, developmentModified: false },
    );
    expect(
      await repository.import("slot-1", "{bad", {
        lastPlayed: 2,
        developmentModified: false,
      }),
    ).toMatchObject({ ok: false });
    const loaded = await repository.load("slot-1");
    expect(loaded.ok && loaded.value.state.company.name).toBe("Keep Me");
    expect(
      await repository.import(
        "slot-2",
        serializeGame(createInitialState({ companyName: "Imported" })),
        { lastPlayed: 3, developmentModified: false },
      ),
    ).toMatchObject({ ok: true });
  });

  it("reports storage failures and deletes only the selected slot", async () => {
    const storage = new MemoryStorage();
    const repository = new WebSaveRepository(storage);
    await repository.save("slot-1", createInitialState(), {
      lastPlayed: 1,
      developmentModified: false,
    });
    await repository.save("slot-2", createInitialState(), {
      lastPlayed: 1,
      developmentModified: false,
    });
    await repository.delete("slot-1");
    expect(await repository.load("slot-1")).toMatchObject({ ok: false });
    expect(await repository.load("slot-2")).toMatchObject({ ok: true });
    storage.failWrites = true;
    expect(
      await repository.save("slot-3", createInitialState(), {
        lastPlayed: 1,
        developmentModified: false,
      }),
    ).toMatchObject({ ok: false, error: { code: "STORAGE_UNAVAILABLE" } });
  });
});

describe("WebOptionsRepository", () => {
  it("loads defaults and persists validated options separately", async () => {
    const storage = new MemoryStorage();
    const repository = new WebOptionsRepository(storage);
    expect(await repository.load()).toEqual({
      ok: true,
      value: DEFAULT_OPTIONS,
    });
    const options = {
      ...DEFAULT_OPTIONS,
      reducedMotion: true,
      autosaveIntervalSeconds: 300 as const,
    };
    expect(await repository.save(options)).toMatchObject({ ok: true });
    expect(await repository.load()).toEqual({ ok: true, value: options });
  });

  it("uses a five-minute default and migrates legacy short intervals", async () => {
    const storage = new MemoryStorage();
    const repository = new WebOptionsRepository(storage);
    expect(DEFAULT_OPTIONS.autosaveIntervalSeconds).toBe(300);
    for (const [legacy, expected] of [
      [10, 60],
      [30, 60],
      [60, 60],
    ] as const) {
      storage.values.set(
        "racks-to-riches:options",
        JSON.stringify({ ...DEFAULT_OPTIONS, autosaveIntervalSeconds: legacy }),
      );
      const loaded = await repository.load();
      expect(loaded.ok && loaded.value.autosaveIntervalSeconds).toBe(expected);
    }
  });
});
