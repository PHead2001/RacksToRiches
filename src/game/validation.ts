import { calculateAllRackCapacities } from "./capacity";
import { CURRENT_GAME_VERSION } from "./constants";
import { validateContractRequirements } from "./contracts";
import {
  CUSTOMER_DEFINITIONS,
  RESEARCH_DEFINITIONS,
  SERVICE_DEFINITIONS,
  getEquipmentDefinition,
  getFacilityDefinition,
  getRackDefinition,
} from "./definitions";
import {
  DomainInvariantError,
  assertFinite,
  assertFiniteNonNegative,
  assertFinitePositive,
} from "./errors";
import { validateSeed } from "./random";
import type { ContractInstance, GameState } from "./types";

function assertUnique(ids: readonly string[], label: string): void {
  if (new Set(ids).size !== ids.length) {
    throw new DomainInvariantError(
      "DUPLICATE_INSTANCE",
      `${label} IDs must be unique`,
    );
  }
}

function assertContract(contract: ContractInstance): void {
  validateContractRequirements(contract.requirements);
  if (!SERVICE_DEFINITIONS.some(({ id }) => id === contract.serviceType)) {
    throw new DomainInvariantError(
      "UNKNOWN_DEFINITION",
      `Unknown service definition: ${contract.serviceType}`,
    );
  }
  if (!Number.isInteger(contract.tier) || contract.tier <= 0) {
    throw new DomainInvariantError(
      "INVALID_CONTRACT",
      `${contract.id} has an invalid tier`,
    );
  }
  assertFiniteNonNegative(
    contract.baseRevenuePerSecond,
    `${contract.id}.baseRevenuePerSecond`,
  );
  assertFiniteNonNegative(
    contract.remainingSeconds,
    `${contract.id}.remainingSeconds`,
  );
  assertFinitePositive(
    contract.totalDurationSeconds,
    `${contract.id}.totalDurationSeconds`,
  );
  assertFinitePositive(
    contract.customerTolerance,
    `${contract.id}.customerTolerance`,
  );
  assertFiniteNonNegative(
    contract.performanceScore,
    `${contract.id}.performanceScore`,
  );
  assertFiniteNonNegative(
    contract.violationSeconds,
    `${contract.id}.violationSeconds`,
  );
  if (contract.remainingSeconds > contract.totalDurationSeconds) {
    throw new DomainInvariantError(
      "INVALID_CONTRACT",
      `${contract.id} remaining time exceeds its duration`,
    );
  }
  if (
    contract.status === "active" &&
    (contract.remainingSeconds === 0 ||
      contract.violationSeconds >= contract.customerTolerance)
  ) {
    throw new DomainInvariantError(
      "INVALID_CONTRACT",
      `${contract.id} is active beyond a terminal boundary`,
    );
  }
}

export function assertGameState(state: GameState): void {
  if (state.version !== CURRENT_GAME_VERSION) {
    throw new DomainInvariantError(
      "INVALID_STATE",
      `Unsupported game state version: ${String(state.version)}`,
    );
  }
  validateSeed(state.rngSeed);
  assertFiniteNonNegative(state.clockSeconds, "clockSeconds");
  assertFinite(state.company.cash, "company.cash");
  for (const [label, value] of [
    ["company.reputation", state.company.reputation],
    ["company.researchPoints", state.company.researchPoints],
    ["company.lifetimeRevenue", state.company.lifetimeRevenue],
    ["company.lifetimeExpenses", state.company.lifetimeExpenses],
    ["contracts.completedCount", state.contracts.completedCount],
    ["progression.prestigeCurrency", state.progression.prestigeCurrency],
    ["statistics.startedAt", state.statistics.startedAt],
    ["statistics.lastSavedAt", state.statistics.lastSavedAt],
    ["statistics.totalOnlineSeconds", state.statistics.totalOnlineSeconds],
    ["statistics.totalOfflineSeconds", state.statistics.totalOfflineSeconds],
    ["statistics.contractsCompleted", state.statistics.contractsCompleted],
    ["statistics.contractsBreached", state.statistics.contractsBreached],
    [
      "statistics.highestIncomePerSecond",
      state.statistics.highestIncomePerSecond,
    ],
  ] as const) {
    assertFiniteNonNegative(value, label);
  }

  const facilityIds = state.facilities.map(({ id }) => id);
  assertUnique(facilityIds, "Facility instance");
  if (!facilityIds.includes(state.activeFacilityId)) {
    throw new DomainInvariantError(
      "INVALID_STATE",
      `Active facility does not exist: ${state.activeFacilityId}`,
    );
  }
  const rackIds: string[] = [];
  const equipmentIds = state.inventory.map(({ id }) => id);
  for (const item of state.inventory) getEquipmentDefinition(item.definitionId);
  for (const facility of state.facilities) {
    const facilityDefinition = getFacilityDefinition(facility.definitionId);
    if (facility.racks.length > facilityDefinition.maximumRacks) {
      throw new DomainInvariantError(
        "INVALID_STATE",
        `${facility.id} exceeds its rack limit`,
      );
    }
    for (const rack of facility.racks) {
      rackIds.push(rack.id);
      const rackDefinition = getRackDefinition(rack.definitionId);
      if (!facilityDefinition.supportedRackIds.includes(rackDefinition.id)) {
        throw new DomainInvariantError(
          "INVALID_STATE",
          `${rackDefinition.id} is incompatible with ${facilityDefinition.id}`,
        );
      }
      for (const equipment of rack.equipment) equipmentIds.push(equipment.id);
    }
  }
  assertUnique(rackIds, "Rack instance");
  assertUnique(equipmentIds, "Equipment instance");

  const allContracts = [...state.contracts.offers, ...state.contracts.active];
  assertUnique(
    allContracts.map(({ id }) => id),
    "Contract instance",
  );
  for (const contract of allContracts) {
    assertContract(contract);
    if (contract.status === "active") {
      if (
        contract.assignedTargetId === undefined ||
        !rackIds.includes(contract.assignedTargetId)
      ) {
        throw new DomainInvariantError(
          "INVALID_STATE",
          `${contract.id} has an invalid assignment`,
        );
      }
    }
  }
  assertUnique(
    state.customers.map(({ id }) => id),
    "Customer state",
  );
  for (const customer of state.customers) {
    assertFiniteNonNegative(customer.loyalty, `${customer.id}.loyalty`);
    if (customer.loyalty > 1) {
      throw new DomainInvariantError(
        "INVALID_STATE",
        `${customer.id} loyalty exceeds one`,
      );
    }
    if (!Number.isInteger(customer.currentStage) || customer.currentStage < 1) {
      throw new DomainInvariantError(
        "INVALID_STATE",
        `${customer.id} has an invalid stage`,
      );
    }
    if (
      customer.definitionId !== undefined &&
      !CUSTOMER_DEFINITIONS.some(({ id }) => id === customer.definitionId)
    ) {
      throw new DomainInvariantError(
        "UNKNOWN_DEFINITION",
        `Unknown customer definition: ${customer.definitionId}`,
      );
    }
  }
  assertUnique(state.research.unlockedNodeIds, "Unlocked research");
  for (const researchId of state.research.unlockedNodeIds) {
    if (!RESEARCH_DEFINITIONS.some(({ id }) => id === researchId)) {
      throw new DomainInvariantError(
        "UNKNOWN_DEFINITION",
        `Unknown research definition: ${researchId}`,
      );
    }
  }
  calculateAllRackCapacities(state);
}
