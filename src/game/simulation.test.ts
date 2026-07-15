import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { advanceGame } from "./advanceGame";
import { calculateEconomyRate } from "./economy";
import { DomainInvariantError } from "./errors";
import { createInitialState } from "./initialState";
import { placeEquipment } from "./placement";
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
    expect(
      calculateEconomyRate(poweredWithoutContracts).netIncomePerSecond,
    ).toBeLessThan(0);
  });

  it("rejects unsupported state versions", () => {
    const state = createInitialState();
    state.version = 2;
    expect(() => calculateEconomyRate(state)).toThrow(
      "Unsupported game state version",
    );
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
    expect(result.contracts.active[0]?.remainingSeconds).toBeLessThan(180);
  });

  it("expires a contract inside a large delta without overpaying", () => {
    const state = activeTutorial();
    const result = advanceGame(state, 1_000);
    expect(result.contracts.active).toEqual([]);
    expect(result.contracts.completedCount).toBe(1);
    expect(result.statistics.contractsCompleted).toBe(1);
    expect(result.statistics.totalOnlineSeconds).toBe(1_000);
    expect(result.company.lifetimeRevenue).toBeCloseTo(360);
    expect(result.company.lifetimeExpenses).toBeCloseTo(2.27);
    expect(result.company.cash).toBeCloseTo(857.73);
    expect(result.company.reputation).toBe(1);
  });

  it("breaches a non-performing contract at its tolerance boundary", () => {
    const state = activeTutorial(createInitialState());
    const result = advanceGame(state, 100);
    expect(result.contracts.active).toEqual([]);
    expect(result.statistics.contractsBreached).toBe(1);
    expect(result.company.lifetimeRevenue).toBe(0);
  });

  it("recovers violation time when fulfillment returns to 100 percent", () => {
    const state = activeTutorial();
    const first = state.contracts.active[0];
    if (first === undefined) throw new Error("fixture");
    first.violationSeconds = 10;
    const result = advanceGame(state, 10);
    expect(result.contracts.active[0]?.violationSeconds).toBe(5);
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
