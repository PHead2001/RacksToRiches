import {
  CURRENT_GAME_VERSION,
  ELECTRICITY_COST_PER_WATT_SECOND,
} from "./constants";
import { calculateAllRackCapacities } from "./capacity";
import { calculateContractPerformance, revenueMultiplier } from "./contracts";
import { getFacilityDefinition } from "./definitions";
import { assertFiniteNonNegative } from "./errors";
import type { EconomyRate, GameState } from "./types";

export function calculateEconomyRate(state: GameState): EconomyRate {
  if (state.version !== CURRENT_GAME_VERSION) {
    throw new Error(`Unsupported game state version: ${String(state.version)}`);
  }
  const capacities = calculateAllRackCapacities(state);
  const performance = calculateContractPerformance(
    state.contracts.active,
    capacities,
  );
  let grossRevenuePerSecond = 0;
  for (const contract of state.contracts.active) {
    if (contract.status !== "active" || contract.remainingSeconds <= 0)
      continue;
    const score = performance.get(contract.id);
    if (score === undefined) {
      throw new Error(`Missing performance for contract: ${contract.id}`);
    }
    grossRevenuePerSecond +=
      contract.baseRevenuePerSecond * revenueMultiplier(score);
  }
  const totalPowerDraw = [...capacities.values()].reduce(
    (sum, capacity) => sum + capacity.powerDraw,
    0,
  );
  const electricityPerSecond =
    totalPowerDraw * ELECTRICITY_COST_PER_WATT_SECOND;
  const rentPerSecond = state.facilities.reduce(
    (sum, facility) =>
      sum + getFacilityDefinition(facility.definitionId).rentPerSecond,
    0,
  );
  for (const [label, value] of [
    ["gross revenue", grossRevenuePerSecond],
    ["electricity", electricityPerSecond],
    ["rent", rentPerSecond],
  ] as const) {
    assertFiniteNonNegative(value, label);
  }
  return {
    grossRevenuePerSecond,
    electricityPerSecond,
    rentPerSecond,
    netIncomePerSecond:
      grossRevenuePerSecond - electricityPerSecond - rentPerSecond,
  };
}
