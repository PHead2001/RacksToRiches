import { assertFiniteNonNegative, DomainInvariantError } from "./errors";
import type {
  ContractInstance,
  ContractRequirements,
  RackCapacity,
  RequirementKey,
} from "./types";

const REQUIREMENT_KEYS: readonly RequirementKey[] = [
  "compute",
  "gpuCompute",
  "storage",
  "bandwidth",
  "reliability",
  "security",
];

export function validateContractRequirements(
  requirements: ContractRequirements,
): void {
  let hasPositiveRequirement = false;
  for (const key of REQUIREMENT_KEYS) {
    const value = requirements[key];
    if (value === undefined) continue;
    assertFiniteNonNegative(value, `contract requirement ${key}`);
    if (value > 0) hasPositiveRequirement = true;
  }
  if (!hasPositiveRequirement) {
    throw new DomainInvariantError(
      "INVALID_CONTRACT",
      "A contract must contain at least one positive requirement",
    );
  }
}

export function calculateFulfillment(
  capacity: RackCapacity,
  requirements: ContractRequirements,
): number {
  validateContractRequirements(requirements);
  const ratios: number[] = [];
  for (const key of REQUIREMENT_KEYS) {
    const required = requirements[key];
    if (required === undefined || required === 0) continue;
    const available = capacity[key];
    assertFiniteNonNegative(available, `available ${key}`);
    ratios.push(available / required);
  }
  const fulfillment = Math.min(...ratios);
  assertFiniteNonNegative(fulfillment, "contract fulfillment");
  if (Math.abs(fulfillment - 1) <= Number.EPSILON * 8) return 1;
  return fulfillment;
}

export function revenueMultiplier(fulfillment: number): number {
  assertFiniteNonNegative(fulfillment, "fulfillment");
  if (fulfillment < 0.5) return 0;
  if (fulfillment < 1) return fulfillment * fulfillment;
  if (fulfillment < 1.25) return 1 + (fulfillment - 1) * 0.8;
  return 1.2;
}

export function aggregateContractDemand(
  contracts: readonly ContractInstance[],
  targetId: string,
): ContractRequirements {
  const demand: ContractRequirements = {};
  for (const contract of contracts) {
    if (
      contract.status !== "active" ||
      contract.remainingSeconds <= 0 ||
      contract.assignedTargetId !== targetId
    ) {
      continue;
    }
    validateContractRequirements(contract.requirements);
    for (const key of REQUIREMENT_KEYS) {
      const value = contract.requirements[key];
      if (value === undefined || value === 0) continue;
      demand[key] = (demand[key] ?? 0) + value;
    }
  }
  return demand;
}

export function calculateContractPerformance(
  contracts: readonly ContractInstance[],
  capacities: ReadonlyMap<string, RackCapacity>,
): ReadonlyMap<string, number> {
  const performance = new Map<string, number>();
  const targetIds = new Set(
    contracts
      .filter((contract) => contract.status === "active")
      .map((contract) => contract.assignedTargetId)
      .filter((targetId) => targetId !== undefined),
  );
  for (const targetId of targetIds) {
    const capacity = capacities.get(targetId);
    if (capacity === undefined) {
      throw new DomainInvariantError(
        "INVALID_STATE",
        `Contract target does not exist: ${targetId}`,
      );
    }
    const demand = aggregateContractDemand(contracts, targetId);
    const score = calculateFulfillment(capacity, demand);
    for (const contract of contracts) {
      if (
        contract.status === "active" &&
        contract.assignedTargetId === targetId
      ) {
        performance.set(contract.id, score);
      }
    }
  }
  return performance;
}
