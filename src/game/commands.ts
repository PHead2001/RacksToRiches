import {
  EQUIPMENT_DEFINITIONS,
  getEquipmentDefinition,
  getRackDefinition,
} from "./definitions";
import { assertFiniteNonNegative } from "./errors";
import { calculateAllRackCapacities } from "./capacity";
import { calculateContractReadiness } from "./contractStatus";
import { TUTORIAL_CONTRACT_ID, fillStarterMarketplace } from "./marketplace";
import { relocateEquipment } from "./placement";
import { nextRandom } from "./random";
import type { GameState } from "./types";
import { assertGameState } from "./validation";

export type GameCommandErrorCode =
  | "NOT_FOUND"
  | "INVALID_NAME"
  | "INVALID_TARGET"
  | "INVALID_PLACEMENT"
  | "INSUFFICIENT_CASH"
  | "LOCKED"
  | "TUTORIAL_REQUIRED"
  | "REQUIREMENTS_NOT_MET"
  | "DUPLICATE_INSTANCE";

export type GameCommandResult =
  | { ok: true; state: GameState }
  | {
      ok: false;
      error: { code: GameCommandErrorCode; message: string };
    };

function failure(
  code: GameCommandErrorCode,
  message: string,
): GameCommandResult {
  return { ok: false, error: { code, message } };
}

function success(state: GameState): GameCommandResult {
  assertGameState(state);
  return { ok: true, state };
}

function allEquipmentIds(state: GameState): string[] {
  return [
    ...state.inventory.map(({ id }) => id),
    ...state.facilities.flatMap(({ racks }) =>
      racks.flatMap(({ equipment }) => equipment.map(({ id }) => id)),
    ),
  ];
}

export function removeEquipment(
  state: GameState,
  equipmentId: string,
): GameCommandResult {
  const relocated = relocateEquipment(state, equipmentId, {
    kind: "inventory",
  });
  return relocated.ok
    ? success(relocated.state)
    : failure(
        relocated.error.code === "UNKNOWN_EQUIPMENT_INSTANCE"
          ? "NOT_FOUND"
          : "INVALID_PLACEMENT",
        relocated.error.message,
      );
}

export function moveEquipment(
  state: GameState,
  equipmentId: string,
  rackId: string,
  startUnit: number,
): GameCommandResult {
  const relocated = relocateEquipment(state, equipmentId, {
    kind: "rack",
    rackId,
    anchorUnit: startUnit,
  });
  return relocated.ok
    ? success(relocated.state)
    : failure(
        relocated.error.code === "UNKNOWN_EQUIPMENT_INSTANCE"
          ? "NOT_FOUND"
          : "INVALID_PLACEMENT",
        relocated.error.message,
      );
}

export function setEquipmentPower(
  state: GameState,
  equipmentId: string,
  poweredOn: boolean,
): GameCommandResult {
  const found = state.facilities.some((facility) =>
    facility.racks.some((rack) =>
      rack.equipment.some((equipment) => equipment.id === equipmentId),
    ),
  );
  if (!found)
    return failure(
      "NOT_FOUND",
      `Installed equipment not found: ${equipmentId}`,
    );
  const facilities = state.facilities.map((facility) => ({
    ...facility,
    racks: facility.racks.map((rack) => ({
      ...rack,
      equipment: rack.equipment.map((equipment) => {
        if (equipment.id !== equipmentId) return equipment;
        return { ...equipment, poweredOn };
      }),
    })),
  }));
  return success({ ...state, facilities });
}

export function purchaseEquipment(
  state: GameState,
  definitionId: string,
): GameCommandResult {
  const definition = EQUIPMENT_DEFINITIONS.find(
    ({ id }) => id === definitionId,
  );
  if (definition === undefined)
    return failure("NOT_FOUND", `Unknown equipment: ${definitionId}`);
  if (
    definition.requiredResearch !== undefined ||
    definition.requiredReputationTier !== undefined
  ) {
    return failure("LOCKED", `${definition.name} is not unlocked yet`);
  }
  const starterRack = getRackDefinition("starter-12u");
  if (
    !starterRack.supportedCategories.includes(definition.category) ||
    !definition.tags.some((tag) =>
      starterRack.supportedEquipmentTags.includes(tag),
    )
  ) {
    return failure("LOCKED", `${definition.name} is not bedroom-compatible`);
  }
  if (state.company.cash < definition.purchaseCost) {
    return failure("INSUFFICIENT_CASH", "Not enough cash for this equipment");
  }
  const random = nextRandom(state.rngSeed);
  const id = `equipment-${definition.id}-${random.seed.toString(16)}`;
  if (allEquipmentIds(state).includes(id))
    return failure(
      "DUPLICATE_INSTANCE",
      "Generated equipment ID already exists",
    );
  return success({
    ...state,
    rngSeed: random.seed,
    company: {
      ...state.company,
      cash: state.company.cash - definition.purchaseCost,
    },
    inventory: [...state.inventory, { id, definitionId: definition.id }],
  });
}

export function acceptContract(
  state: GameState,
  contractId: string,
  rackId: string,
): GameCommandResult {
  const offer = state.contracts.offers.find(({ id }) => id === contractId);
  if (offer === undefined)
    return failure("NOT_FOUND", `Contract offer not found: ${contractId}`);
  const rackExists = state.facilities.some(({ racks }) =>
    racks.some(({ id }) => id === rackId),
  );
  if (!rackExists)
    return failure("INVALID_TARGET", `Rack not found: ${rackId}`);
  if (offer.id === TUTORIAL_CONTRACT_ID) {
    const capacity = calculateAllRackCapacities(state).get(rackId);
    if (capacity === undefined) {
      return failure("INVALID_TARGET", `Rack not found: ${rackId}`);
    }
    const readiness = calculateContractReadiness(offer, capacity);
    if (!readiness.canAccept) {
      return failure("REQUIREMENTS_NOT_MET", readiness.explanation);
    }
  }
  const next = {
    ...state,
    contracts: {
      ...state.contracts,
      offers: state.contracts.offers.filter(({ id }) => id !== contractId),
      active: [
        ...state.contracts.active,
        { ...offer, status: "active" as const, assignedTargetId: rackId },
      ],
    },
  };
  return success(
    contractId === TUTORIAL_CONTRACT_ID ? next : fillStarterMarketplace(next),
  );
}

export function rejectContractOffer(
  state: GameState,
  contractId: string,
): GameCommandResult {
  if (contractId === TUTORIAL_CONTRACT_ID) {
    return failure(
      "TUTORIAL_REQUIRED",
      "The tutorial contract stays available until you accept it",
    );
  }
  if (!state.contracts.offers.some(({ id }) => id === contractId))
    return failure("NOT_FOUND", `Contract offer not found: ${contractId}`);
  return success(
    fillStarterMarketplace({
      ...state,
      contracts: {
        ...state.contracts,
        offers: state.contracts.offers.filter(({ id }) => id !== contractId),
      },
    }),
  );
}

export function stampLastSaved(state: GameState, timestamp: number): GameState {
  assertFiniteNonNegative(timestamp, "save timestamp");
  const stamped = {
    ...state,
    statistics: { ...state.statistics, lastSavedAt: timestamp },
  };
  assertGameState(stamped);
  return stamped;
}

export function getUnlockedBedroomEquipment() {
  return EQUIPMENT_DEFINITIONS.filter(
    (definition) =>
      definition.requiredResearch === undefined &&
      definition.requiredReputationTier === undefined &&
      definition.id !== "refurbished-desktop",
  );
}

export function equipmentName(definitionId: string): string {
  return getEquipmentDefinition(definitionId).name;
}
