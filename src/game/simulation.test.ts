import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { advanceGame } from "./advanceGame";
import { BANKRUPTCY_THRESHOLD } from "./constants";
import { calculateEconomyRate } from "./economy";
import { DomainInvariantError } from "./errors";
import { createInitialState } from "./initialState";
import { placeEquipment } from "./placement";
import { evaluateBankruptcy, isTerminal } from "./terminal";
import type { ContractInstance, GameState } from "./types";

function place(state: GameState, equipmentId: string, unit: number): GameState {
  const result = placeEquipment(state, equipmentId, "rack-starter-1", unit);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function equippedState(): GameState {
  let state = createInitialState();
  state = place(state, "equipment-refurbished-1", 0);
  state = place(state, "equipment-router-1", 4);
  state = place(state, "equipment-power-strip-1", 5);
  return place(state, "equipment-desk-fan-1", 6);
}

function activeTutorial(state = equippedState()): GameState {
  const offer = state.contracts.offers[0];
  if (offer === undefined) throw new Error("tutorial offer missing");
  const active: ContractInstance = {
    ...offer,
    status: "active",
    assignedTargetId: "rack-starter-1",
  };
  return {
    ...state,
    contracts: { ...state.contracts, offers: [], active: [active] },
  };
}

function expectAllNumbersFinite(value: unknown): void {
  if (typeof value === "number") {
    expect(Number.isFinite(value)).toBe(true);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) expectAllNumbersFinite(item);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) expectAllNumbersFinite(item);
  }
}

describe("economy rates", () => {
  it("reports profitable and unprofitable ticks", () => {
    expect(
      calculateEconomyRate(activeTutorial()).netIncomePerSecond,
    ).toBeGreaterThan(0);
    const poweredWithoutContracts = equippedState();
    poweredWithoutContracts.progression.completedMilestones.push(
      "tutorial-completed",
    );
    expect(
      calculateEconomyRate(poweredWithoutContracts).netIncomePerSecond,
    ).toBeLessThan(0);
  });

  it("rejects unsupported state versions", () => {
    const state = createInitialState();
    state.version = 4;
    expect(() => calculateEconomyRate(state)).toThrow(
      "Unsupported game state version",
    );
  });

  it("recognizes terminal state and keeps an identical bankruptcy result stable", () => {
    const healthy = createInitialState();
    expect(isTerminal(healthy)).toBe(false);
    expect(evaluateBankruptcy(healthy)).toBe(healthy);
    const broke = {
      ...healthy,
      company: { ...healthy.company, cash: BANKRUPTCY_THRESHOLD },
    };
    const terminal = evaluateBankruptcy(broke);
    expect(isTerminal(terminal)).toBe(true);
    expect(evaluateBankruptcy(terminal)).toBe(terminal);
    expect(evaluateBankruptcy(terminal, true)).toMatchObject({
      progression: {
        terminalState: { kind: "bankrupt", tutorialFailed: true },
      },
    });
    expect(calculateEconomyRate(terminal)).toEqual({
      grossRevenuePerSecond: 0,
      electricityPerSecond: 0,
      rentPerSecond: 0,
      netIncomePerSecond: 0,
    });
  });
});

describe("advanceGame", () => {
  it("rejects invalid deltas and treats zero as a no-op", () => {
    const state = createInitialState();
    expect(advanceGame(state, 0)).toBe(state);
    for (const delta of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => advanceGame(state, delta)).toThrow(DomainInvariantError);
    }
  });

  it("advances a positive sub-nanosecond delta without ending the contract", () => {
    const state = activeTutorial();
    const result = advanceGame(state, 1e-12);
    expect(result.clockSeconds).toBe(1e-12);
    expect(result.contracts.active).toHaveLength(1);
    expect(result.contracts.active[0]?.remainingSeconds).toBeLessThan(30);
  });

  it("expires a contract inside a large delta without overpaying", () => {
    const state = activeTutorial();
    const result = advanceGame(state, 1_000);
    expect(result.contracts.active).toEqual([]);
    expect(result.contracts.completedCount).toBe(1);
    expect(result.statistics.contractsCompleted).toBe(1);
    expect(result.statistics.totalOnlineSeconds).toBe(1_000);
    expect(result.company.lifetimeRevenue).toBeCloseTo(60);
    expect(result.company.lifetimeExpenses).toBeGreaterThan(0);
    expect(result.company.cash).toBeGreaterThan(55);
    expect(result.company.reputation).toBe(10);
    expect(result.progression.completedMilestones).toContain(
      "tutorial-completed",
    );
    expect(result.contracts.offers).toHaveLength(3);
  });

  it("breaches a non-performing contract at its tolerance boundary", () => {
    const state = activeTutorial(createInitialState());
    const result = advanceGame(state, 100);
    expect(result.contracts.active).toEqual([]);
    expect(result.statistics.contractsBreached).toBe(1);
    expect(result.company.lifetimeRevenue).toBe(0);
    expect(result.progression.terminalState).toMatchObject({
      kind: "tutorial-failed",
    });
  });

  it("waives tutorial electricity and enables expenses after completion", () => {
    const tutorial = activeTutorial();
    expect(calculateEconomyRate(tutorial).electricityPerSecond).toBe(0);
    const completed = advanceGame(tutorial, 30);
    expect(completed.progression.completedMilestones).toContain(
      "tutorial-completed",
    );
    expect(
      calculateEconomyRate(completed).electricityPerSecond,
    ).toBeGreaterThan(0);
    expect(completed.company.cash).toBeGreaterThanOrEqual(60);
  });

  it("allows debt above the centralized threshold and persists exact bankruptcy cash", () => {
    for (const cash of [0, -1, -9_999.99]) {
      const state = createInitialState();
      state.company.cash = cash;
      const result = advanceGame(state, 1);
      expect(result.progression.terminalState).toBeNull();
    }
    for (const cash of [BANKRUPTCY_THRESHOLD, -10_001]) {
      const state = createInitialState();
      state.company.cash = cash;
      const result = advanceGame(state, 1);
      expect(result.company.cash).toBe(cash);
      expect(result.progression.terminalState).toMatchObject({
        kind: "bankrupt",
      });
      expect(advanceGame(result, 100)).toBe(result);
    }
  });

  it("detects crossing bankruptcy during a large economy step", () => {
    const state = equippedState();
    state.progression.completedMilestones.push("tutorial-completed");
    state.company.cash = -9_999;
    const result = advanceGame(state, 1_000);
    expect(result.company.cash).toBeLessThan(BANKRUPTCY_THRESHOLD);
    expect(result.progression.terminalState).toMatchObject({
      kind: "bankrupt",
      tutorialFailed: false,
    });
  });

  it("lets a tutorial breach win a simultaneous completion boundary", () => {
    const state = activeTutorial();
    const contract = state.contracts.active[0];
    if (contract === undefined) throw new Error("fixture");
    contract.remainingSeconds = 1;
    contract.violationSeconds = contract.customerTolerance - 1;
    const rack = state.facilities[0]?.racks[0];
    if (rack === undefined) throw new Error("fixture");
    rack.equipment = [];
    const result = advanceGame(state, 1);
    expect(result.statistics.contractsBreached).toBe(1);
    expect(result.statistics.contractsCompleted).toBe(0);
    expect(result.progression.terminalState).toMatchObject({
      kind: "tutorial-failed",
    });
  });

  it("recovers violation time when fulfillment returns to 100 percent", () => {
    const state = activeTutorial();
    const first = state.contracts.active[0];
    if (first === undefined) throw new Error("fixture");
    first.violationSeconds = 4;
    const result = advanceGame(state, 4);
    expect(result.contracts.active[0]?.violationSeconds).toBe(2);
  });

  it("is immutable and deterministic for identical inputs", () => {
    const state = activeTutorial();
    const snapshot = structuredClone(state);
    const first = advanceGame(state, 10);
    const second = advanceGame(state, 10);
    expect(state).toEqual(snapshot);
    expect(first).toEqual(second);
    expect(first).not.toBe(state);
  });

  it("is equivalent when chunked without crossing a boundary event", () => {
    const state = activeTutorial();
    const single = advanceGame(state, 10);
    const chunked = advanceGame(advanceGame(state, 4), 6);
    expect(chunked.company.cash).toBeCloseTo(single.company.cash, 10);
    expect(chunked.company.lifetimeRevenue).toBeCloseTo(
      single.company.lifetimeRevenue,
      10,
    );
    expect(chunked.contracts.active).toEqual(single.contracts.active);
    expect(chunked.statistics).toEqual(single.statistics);
  });

  it("never creates NaN or Infinity across generated valid deltas", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 180 }), (delta) => {
        expectAllNumbersFinite(advanceGame(activeTutorial(), delta));
      }),
    );
  });
});
