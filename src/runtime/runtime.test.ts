import { describe, expect, it, vi } from "vitest";

import { createInitialState } from "../game";
import type { Clock, Scheduler } from "../platform";
import { BoundedErrorLog, normalizeError } from "./errorLog";
import { GameRuntime, type RuntimeSession } from "./gameRuntime";

class FakeClock implements Clock {
  value = 1_000;
  now(): number {
    return this.value;
  }
}

class FakeScheduler implements Scheduler {
  callback: (() => void) | null = null;
  starts = 0;
  stops = 0;
  setInterval(callback: () => void): unknown {
    this.callback = callback;
    this.starts += 1;
    return 7;
  }
  clearInterval(): void {
    this.stops += 1;
  }
}

describe("GameRuntime", () => {
  it("owns exactly one interval and advances a loaded session", async () => {
    const clock = new FakeClock();
    const scheduler = new FakeScheduler();
    let state = createInitialState();
    const session = (): RuntimeSession => ({
      state,
      paused: false,
      speed: 5,
      freezeExpenses: false,
      autosaveEnabled: false,
      autosaveIntervalSeconds: 60,
    });
    const runtime = new GameRuntime({
      clock,
      scheduler,
      getSession: session,
      setState: (next) => {
        state = next;
      },
      autosave: vi.fn(),
      onError: vi.fn(),
    });
    runtime.start();
    runtime.start();
    expect(scheduler.starts).toBe(1);
    clock.value += 1_000;
    await runtime.tick();
    expect(state.clockSeconds).toBe(5);
    runtime.stop();
    expect(scheduler.stops).toBe(1);
  });

  it("autosaves only after confirmation interval and records failures", async () => {
    const clock = new FakeClock();
    const scheduler = new FakeScheduler();
    const autosave = vi.fn(async () => Promise.resolve());
    const errors: unknown[] = [];
    const state = createInitialState();
    const runtime = new GameRuntime({
      clock,
      scheduler,
      getSession: () => ({
        state,
        paused: true,
        speed: 1,
        freezeExpenses: false,
        autosaveEnabled: true,
        autosaveIntervalSeconds: 60,
      }),
      setState: vi.fn(),
      autosave,
      onError: (error) => {
        errors.push(error);
      },
    });
    runtime.start();
    clock.value += 60_000;
    await runtime.tick();
    expect(autosave).toHaveBeenCalledOnce();
    const failing = new GameRuntime({
      clock,
      scheduler: new FakeScheduler(),
      getSession: () => ({
        state,
        paused: true,
        speed: 1,
        freezeExpenses: false,
        autosaveEnabled: true,
        autosaveIntervalSeconds: 60,
      }),
      setState: vi.fn(),
      autosave: () => Promise.reject(new Error("disk full")),
      onError: (error) => {
        errors.push(error);
      },
    });
    failing.start();
    clock.value += 60_000;
    await failing.tick();
    expect(errors[0]).toBeInstanceOf(Error);
  });

  it("autosaves immediately when a simulation step enters a terminal state", async () => {
    const clock = new FakeClock();
    const scheduler = new FakeScheduler();
    const autosave = vi.fn(async () => Promise.resolve());
    let state = createInitialState();
    state.company.cash = -10_000;
    const runtime = new GameRuntime({
      clock,
      scheduler,
      getSession: () => ({
        state,
        paused: false,
        speed: 1,
        freezeExpenses: false,
        autosaveEnabled: true,
        autosaveIntervalSeconds: 300,
      }),
      setState: (next) => {
        state = next;
      },
      autosave,
      onError: vi.fn(),
    });
    runtime.start();
    clock.value += 1_000;
    await runtime.tick();
    expect(state.progression.terminalState).toMatchObject({
      kind: "bankrupt",
    });
    expect(autosave).toHaveBeenCalledOnce();
  });
});

describe("error normalization", () => {
  it("normalizes unknown values and bounds history", () => {
    const clock = new FakeClock();
    expect(normalizeError("oops", "global", clock)).toMatchObject({
      message: "oops",
      source: "global",
    });
    const log = new BoundedErrorLog(clock, 2);
    log.add(new Error("one"), "runtime");
    log.add({ strange: true }, "command");
    log.add("three", "save");
    expect(log.list()).toHaveLength(2);
    expect(log.list()[1]?.message).toBe("three");
  });
});
