import { describe, expect, it } from "vitest";

import type {
  AppOptions,
  FileTransfer,
  FullscreenCapability,
  KeyValueStorage,
  RepositoryResult,
  TextFile,
} from "../platform";
import {
  DEFAULT_OPTIONS,
  WebOptionsRepository,
  WebSaveRepository,
} from "../platform";
import { createGameStore } from "./gameStore";

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const fileTransfer: FileTransfer = {
  downloadJson: (): RepositoryResult<void> => ({ ok: true, value: undefined }),
  readText: async (file: TextFile) => ({ ok: true, value: await file.text() }),
};
const fullscreen: FullscreenCapability = {
  supported: true,
  setEnabled: async () => Promise.resolve({ ok: true, value: undefined }),
};

function setup() {
  const storage = new MemoryStorage();
  let now = 100;
  const store = createGameStore({
    saves: new WebSaveRepository(storage),
    options: new WebOptionsRepository(storage),
    files: fileTransfer,
    fullscreen,
    clock: { now: () => now },
  });
  return {
    store,
    advanceClock: () => {
      now += 1_000;
    },
  };
}

describe("game store", () => {
  it("boots, creates a slot, returns to menu, and continues the newest save", async () => {
    const { store, advanceClock } = setup();
    await store.getState().boot();
    expect(store.getState().screen).toBe("menu");
    expect(
      await store.getState().createGame("slot-1", "  Vulpecula Hosting "),
    ).toBe(true);
    expect(store.getState().gameState?.company.name).toBe("Vulpecula Hosting");
    advanceClock();
    expect(await store.getState().returnToMenu()).toBe(true);
    expect(store.getState().screen).toBe("menu");
    expect(await store.getState().continueGame()).toBe(true);
    expect(store.getState().activeSlot).toBe("slot-1");
  });

  it("persists options, handles game commands, and supports one-step development undo", async () => {
    const { store } = setup();
    await store.getState().boot();
    await store.getState().createGame("slot-1", "QA Rack");
    const options: AppOptions = {
      ...DEFAULT_OPTIONS,
      reducedMotion: true,
      autosaveIntervalSeconds: 30,
    };
    expect(await store.getState().updateOptions(options)).toBe(true);
    expect(store.getState().options).toEqual(options);
    expect(
      store.getState().installEquipment("equipment-refurbished-1", 0),
    ).toBe(true);
    const beforeCash = store.getState().gameState?.company.cash;
    expect(
      store
        .getState()
        .applyDevelopmentCommand({ type: "add-cash", amount: 500 }),
    ).toBe(true);
    expect(store.getState().gameState?.company.cash).toBe(
      (beforeCash ?? 0) + 500,
    );
    expect(store.getState().undoDevelopmentCommand()).toBe(true);
    expect(store.getState().gameState?.company.cash).toBe(beforeCash);
    expect(store.getState().developmentModified).toBe(true);
  });

  it("rejects invalid creation and invalid development output", async () => {
    const { store } = setup();
    await store.getState().boot();
    expect(await store.getState().createGame("slot-1", "   ")).toBe(false);
    await store.getState().createGame("slot-1", "Valid");
    expect(
      store
        .getState()
        .applyDevelopmentCommand({ type: "set-cash", amount: Number.NaN }),
    ).toBe(false);
    expect(store.getState().errors).toHaveLength(1);
  });
});
