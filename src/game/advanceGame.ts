import { calculateAllRackCapacities } from "./capacity";
import { FULFILLMENT_EPSILON, VIOLATION_RECOVERY_RATE } from "./constants";
import { calculateContractPerformance } from "./contracts";
import { calculateEconomyRate } from "./economy";
import { DomainInvariantError, assertFiniteNonNegative } from "./errors";
import {
  TUTORIAL_CONTRACT_ID,
  TUTORIAL_MILESTONE_ID,
  TUTORIAL_REPUTATION_REWARD,
  fillStarterMarketplace,
} from "./marketplace";
import type { ContractInstance, GameState } from "./types";
import { evaluateBankruptcy } from "./terminal";
import { assertGameState } from "./validation";

function cloneActiveContract(contract: ContractInstance): ContractInstance {
  return { ...contract, requirements: { ...contract.requirements } };
}

export function advanceGame(state: GameState, deltaSeconds: number): GameState {
  assertGameState(state);
  assertFiniteNonNegative(deltaSeconds, "deltaSeconds");
  if (deltaSeconds === 0) return state;
  if (state.progression.terminalState !== null) return state;

  const bankruptcyChecked = evaluateBankruptcy(state);
  if (bankruptcyChecked !== state) {
    assertGameState(bankruptcyChecked);
    return bankruptcyChecked;
  }

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
      if (score + FULFILLMENT_EPSILON < 1) {
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
    const completedIds: string[] = [];
    let tutorialFailed = false;

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
      if (breaches) {
        breachedThisStep += 1;
        tutorialFailed ||= contract.id === TUTORIAL_CONTRACT_ID;
      } else if (completes) {
        completedThisStep += 1;
        completedIds.push(contract.id);
        reputationEarned +=
          contract.id === TUTORIAL_CONTRACT_ID
            ? TUTORIAL_REPUTATION_REWARD
            : contract.tier;
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
    if (
      completedIds.includes(TUTORIAL_CONTRACT_ID) &&
      !current.progression.completedMilestones.includes(TUTORIAL_MILESTONE_ID)
    ) {
      current = {
        ...current,
        progression: {
          ...current.progression,
          completedMilestones: [
            ...current.progression.completedMilestones,
            TUTORIAL_MILESTONE_ID,
          ],
        },
      };
    }
    if (
      completedThisStep > 0 &&
      current.progression.completedMilestones.includes(TUTORIAL_MILESTONE_ID)
    ) {
      current = fillStarterMarketplace(current);
    }
    if (tutorialFailed) {
      current = {
        ...current,
        progression: {
          ...current.progression,
          terminalState: {
            kind: "tutorial-failed",
            occurredAtSeconds: current.clockSeconds,
          },
        },
      };
    }
    current = evaluateBankruptcy(current, tutorialFailed);
    secondsLeft = Math.max(0, secondsLeft - stepSeconds);
    if (current.progression.terminalState !== null) break;
  }

  assertGameState(current);
  return current;
}
