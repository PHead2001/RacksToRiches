// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  FileTransfer,
  FullscreenCapability,
  KeyValueStorage,
  RepositoryResult,
} from "../platform";
import { WebOptionsRepository, WebSaveRepository } from "../platform";
import { createGameStore } from "../store";
import { StoreProvider } from "./storeContext";
import { NotificationStack } from "./App";

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

function setup() {
  const storage = new MemoryStorage();
  const files: FileTransfer = {
    downloadJson: (): RepositoryResult<void> => ({
      ok: true,
      value: undefined,
    }),
    readText: async (file) => ({ ok: true, value: await file.text() }),
  };
  const fullscreen: FullscreenCapability = {
    supported: false,
    setEnabled: async () => Promise.resolve({ ok: true, value: undefined }),
  };
  const store = createGameStore({
    saves: new WebSaveRepository(storage),
    options: new WebOptionsRepository(storage),
    files,
    fullscreen,
    clock: { now: () => 1 },
  });
  render(
    <StoreProvider store={store}>
      <NotificationStack />
    </StoreProvider>,
  );
  return store;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("NotificationStack", () => {
  it("removes save success after five seconds", () => {
    vi.useFakeTimers();
    const store = setup();
    act(() => {
      store.getState().notify({
        key: "save-success",
        type: "success",
        message: "Game saved.",
        durationMilliseconds: 5_000,
      });
    });
    expect(screen.getByText("Game saved.")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(4_999);
    });
    expect(screen.getByText("Game saved.")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("Game saved.")).toBeNull();
  });

  it.each([
    ["success", 5_000],
    ["information", 5_000],
    ["warning", 8_000],
    ["error", 8_000],
  ] as const)(
    "expires %s notifications after %i milliseconds",
    (type, duration) => {
      vi.useFakeTimers();
      const store = setup();
      act(() => {
        store.getState().notify({
          key: type,
          type,
          message: `${type} message`,
        });
      });
      expect(screen.getByText(`${type} message`)).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(duration);
      });
      expect(screen.queryByText(`${type} message`)).toBeNull();
    },
  );

  it("keeps command errors in diagnostics after their toast expires", () => {
    vi.useFakeTimers();
    const store = setup();
    act(() => {
      store.getState().recordError(new Error("Storage gremlin"), "storage");
    });
    expect(store.getState().errors).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(8_000);
    });
    expect(screen.queryByText("Storage gremlin")).toBeNull();
    expect(store.getState().errors[0]?.message).toBe("Storage gremlin");
  });
});
