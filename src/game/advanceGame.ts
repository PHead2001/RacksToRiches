import { calculateAllRackCapacities } from "./capacity";
import { VIOLATION_RECOVERY_RATE } from "./constants";
import { calculateContractPerformance } from "./contracts";
import { calculateEconomyRate } from "./economy";
import { DomainInvariantError, assertFiniteNonNegative } from "./errors";
import type { ContractInstance, GameState } from "./types";
import { assertGameState } from "./validation";

function cloneActiveContract(contract: ContractInstance): ContractInstance {
  return { ...contract, requirements: { ...contract.requirements } };
}

export function advanceGame(state: GameState, deltaSeconds: number): GameState {
  assertGameState(state);
  assertFiniteNonNegative(deltaSeconds, "deltaSeconds");
  if (deltaSeconds === 0) return state;

  let current: GameState = {
    ...state,
    company: { ...state.company },
    contracts: {
      ...state.contracts,
      active: state.contracts.active.map(cloneActiveContract),
    },
    statistics: { ...state.statistics },
  };
  let secondsLeft = deltaSeconds;

  while (secondsLeft > 0) {
    const capacities = calculateAllRackCapacities(current);
    const performance = calculateContractPerformance(
      current.contracts.active,
      capacities,
    );
    let stepSeconds = secondsLeft;
    for (const contract of current.contracts.active) {
      stepSeconds = Math.min(stepSeconds, contract.remainingSeconds);
      const score = performance.get(contract.id);
      if (score === undefined) {
        throw new DomainInvariantError(
          "INVALID_STATE",
          `Missing performance for active contract: ${contract.id}`,
        );
      }
      if (score < 1) {
        stepSeconds = Math.min(
          stepSeconds,
          contract.customerTolerance - contract.violationSeconds,
        );
      }
    }
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) {
      throw new DomainInvariantError(
        "INVALID_STATE",
        "Simulation could not find a positive boundary step",
      );
    }

    const rate = calculateEconomyRate(current);
    const grossRevenue = rate.grossRevenuePerSecond * stepSeconds;
    const expenses =
      (rate.electricityPerSecond + rate.rentPerSecond) * stepSeconds;
    const netIncome = rate.netIncomePerSecond * stepSeconds;
    const nextActive: ContractInstance[] = [];
    let completedThisStep = 0;
    let breachedThisStep = 0;
    let reputationEarned = 0;

    for (const contract of current.contracts.active) {
      const score = performance.get(contract.id);
      if (score === undefined) {
        throw new DomainInvariantError(
          "INVALID_STATE",
          `Missing performance for active contract: ${contract.id}`,
        );
      }
      const remainingSeconds = Math.max(
        0,
        contract.remainingSeconds - stepSeconds,
      );
      const violationSeconds =
        score < 1
          ? contract.violationSeconds + stepSeconds
          : Math.max(
              0,
              contract.violationSeconds - stepSeconds * VIOLATION_RECOVERY_RATE,
            );
      const completes = stepSeconds >= contract.remainingSeconds;
      const breaches =
        score < 1 &&
        stepSeconds >= contract.customerTolerance - contract.violationSeconds;
      if (completes) {
        completedThisStep += 1;
        reputationEarned += contract.tier;
      } else if (breaches) {
        breachedThisStep += 1;
      } else {
        nextActive.push({
          ...contract,
          remainingSeconds,
          violationSeconds,
          performanceScore: score,
        });
      }
    }

    current = {
      ...current,
      clockSeconds: current.clockSeconds + stepSeconds,
      company: {
        ...current.company,
        cash: current.company.cash + netIncome,
        reputation: current.company.reputation + reputationEarned,
        lifetimeRevenue: current.company.lifetimeRevenue + grossRevenue,
        lifetimeExpenses: current.company.lifetimeExpenses + expenses,
      },
      contracts: {
        ...current.contracts,
        active: nextActive,
        completedCount: current.contracts.completedCount + completedThisStep,
      },
      statistics: {
        ...current.statistics,
        totalOnlineSeconds: current.statistics.totalOnlineSeconds + stepSeconds,
        contractsCompleted:
          current.statistics.contractsCompleted + completedThisStep,
        contractsBreached:
          current.statistics.contractsBreached + breachedThisStep,
        highestIncomePerSecond: Math.max(
          current.statistics.highestIncomePerSecond,
          rate.netIncomePerSecond,
        ),
      },
    };
    secondsLeft = Math.max(0, secondsLeft - stepSeconds);
  }

  assertGameState(current);
  return current;
}
