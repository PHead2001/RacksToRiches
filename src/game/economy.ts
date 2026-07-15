import {
  CURRENT_GAME_VERSION,
  ELECTRICITY_COST_PER_WATT_SECOND,
} from "./constants";
import { calculateAllRackCapacities } from "./capacity";
import { calculateContractPerformance, revenueMultiplier } from "./contracts";
import { getFacilityDefinition } from "./definitions";
import { assertFiniteNonNegative } from "./errors";
import type { EconomyRate, GameState } from "./types";
import { TUTORIAL_MILESTONE_ID } from "./marketplace";

export function calculateEconomyRate(state: GameState): EconomyRate {
  if (state.version !== CURRENT_GAME_VERSION) {
    throw new Error(`Unsupported game state version: ${String(state.version)}`);
  }
  if (state.progression.terminalState !== null) {
    return {
      grossRevenuePerSecond: 0,
      electricityPerSecond: 0,
      rentPerSecond: 0,
      netIncomePerSecond: 0,
    };
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
  const tutorialComplete = state.progression.completedMilestones.includes(
    TUTORIAL_MILESTONE_ID,
  );
  const electricityPerSecond = tutorialComplete
    ? totalPowerDraw * ELECTRICITY_COST_PER_WATT_SECOND
    : 0;
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
