// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("keeps actionable warnings and allows explicit dismissal", async () => {
    const user = userEvent.setup();
    const store = setup();
    act(() => {
      store.getState().notify({
        key: "warning",
        type: "warning",
        message: "Placement needs attention.",
      });
    });
    expect(screen.getByRole("alert")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Dismiss notification" }),
    );
    expect(screen.queryByText("Placement needs attention.")).toBeNull();
  });
});
