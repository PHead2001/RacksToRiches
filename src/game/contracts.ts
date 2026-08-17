import { assertFiniteNonNegative, DomainInvariantError } from "./errors";
import {
  FULFILLMENT_EPSILON,
  MAXIMUM_SLA_BUFFER_SECONDS,
  MINIMUM_SLA_BUFFER_SECONDS,
  SLA_BUFFER_RATIO,
} from "./constants";
import type {
  ContractInstance,
  ContractRequirements,
  RackCapacity,
  ResourceKey,
  RequirementKey,
} from "./types";

export const CONSUMABLE_RESOURCE_KEYS = [
  "compute",
  "gpuCompute",
  "storage",
  "bandwidth",
] as const satisfies readonly ResourceKey[];

export const CAPABILITY_REQUIREMENT_KEYS = [
  "reliability",
  "security",
] as const satisfies readonly RequirementKey[];

const REQUIREMENT_KEYS: readonly RequirementKey[] = [
  ...CONSUMABLE_RESOURCE_KEYS,
  ...CAPABILITY_REQUIREMENT_KEYS,
];

export interface ServicePoolResourceProjection {
  key: ResourceKey;
  total: number;
  used: number;
  remaining: number;
  candidateRequired: number;
  projectedRemaining: number;
  shortfall: number;
}

export interface ServicePoolCapabilityProjection {
  key: "reliability" | "security";
  available: number;
  required: number;
  shortfall: number;
}

export interface ServicePoolProjection {
  resources: readonly ServicePoolResourceProjection[];
  capabilities: readonly ServicePoolCapabilityProjection[];
  projectedDemand: ContractRequirements;
  projectedFulfillment: number;
  limitingResources: readonly {
    key: RequirementKey;
    shortfall: number;
  }[];
  safe: boolean;
}

export function calculateSlaBufferSeconds(
  totalDurationSeconds: number,
): number {
  if (!Number.isFinite(totalDurationSeconds) || totalDurationSeconds <= 0) {
    throw new DomainInvariantError(
      "INVALID_CONTRACT",
      "Contract duration must be finite and positive",
    );
  }
  return Math.min(
    MAXIMUM_SLA_BUFFER_SECONDS,
    Math.max(
      MINIMUM_SLA_BUFFER_SECONDS,
      Math.round(totalDurationSeconds * SLA_BUFFER_RATIO),
    ),
  );
}

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
    for (const key of CONSUMABLE_RESOURCE_KEYS) {
      const value = contract.requirements[key];
      if (value === undefined || value === 0) continue;
      demand[key] = (demand[key] ?? 0) + value;
    }
    for (const key of CAPABILITY_REQUIREMENT_KEYS) {
      const value = contract.requirements[key];
      if (value === undefined || value === 0) continue;
      demand[key] = Math.max(demand[key] ?? 0, value);
    }
  }
  return demand;
}

export function calculateServicePoolProjection(
  capacity: RackCapacity,
  activeContracts: readonly ContractInstance[],
  targetId: string,
  candidate?: ContractInstance,
): ServicePoolProjection {
  const activeDemand = aggregateContractDemand(activeContracts, targetId);
  const projectedDemand: ContractRequirements = { ...activeDemand };
  if (candidate !== undefined) {
    validateContractRequirements(candidate.requirements);
    for (const key of CONSUMABLE_RESOURCE_KEYS) {
      const required = candidate.requirements[key] ?? 0;
      if (required > 0) {
        projectedDemand[key] = (projectedDemand[key] ?? 0) + required;
      }
    }
    for (const key of CAPABILITY_REQUIREMENT_KEYS) {
      const required = candidate.requirements[key] ?? 0;
      if (required > 0) {
        projectedDemand[key] = Math.max(projectedDemand[key] ?? 0, required);
      }
    }
  }

  const resources = CONSUMABLE_RESOURCE_KEYS.map((key) => {
    const total = capacity[key];
    const used = activeDemand[key] ?? 0;
    const candidateRequired = candidate?.requirements[key] ?? 0;
    const rawRemaining = total - used;
    const rawProjectedRemaining = rawRemaining - candidateRequired;
    return {
      key,
      total,
      used,
      remaining: Math.max(0, rawRemaining),
      candidateRequired,
      projectedRemaining: Math.max(0, rawProjectedRemaining),
      shortfall: Math.max(0, -rawProjectedRemaining),
    };
  });
  const capabilities = CAPABILITY_REQUIREMENT_KEYS.map((key) => {
    const required = projectedDemand[key] ?? 0;
    return {
      key,
      available: capacity[key],
      required,
      shortfall: Math.max(0, required - capacity[key]),
    };
  });
  const hasDemand = REQUIREMENT_KEYS.some(
    (key) => (projectedDemand[key] ?? 0) > 0,
  );
  const projectedFulfillment = hasDemand
    ? calculateFulfillment(capacity, projectedDemand)
    : 1;
  const limitingResources = [
    ...resources.map(({ key, shortfall }) => ({ key, shortfall })),
    ...capabilities.map(({ key, shortfall }) => ({ key, shortfall })),
  ].filter(({ shortfall }) => shortfall > FULFILLMENT_EPSILON);
  return {
    resources,
    capabilities,
    projectedDemand,
    projectedFulfillment,
    limitingResources,
    safe:
      projectedFulfillment >= 1 - FULFILLMENT_EPSILON &&
      limitingResources.length === 0,
  };
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
