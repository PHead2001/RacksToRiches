import { EQUIPMENT_DEFINITIONS, getRackDefinition } from "./definitions";
import type { GameState } from "./types";

export type PlacementErrorCode =
  | "UNKNOWN_EQUIPMENT_INSTANCE"
  | "UNKNOWN_EQUIPMENT_DEFINITION"
  | "UNKNOWN_RACK"
  | "DUPLICATE_INSTANCE"
  | "INVALID_START_UNIT"
  | "RACK_OVERFLOW"
  | "EQUIPMENT_OVERLAP"
  | "INCOMPATIBLE_EQUIPMENT";

export type PlacementResult =
  | { ok: true; state: GameState }
  | { ok: false; error: { code: PlacementErrorCode; message: string } };

function failure(code: PlacementErrorCode, message: string): PlacementResult {
  return { ok: false, error: { code, message } };
}

export function placeEquipment(
  state: GameState,
  equipmentInstanceId: string,
  rackInstanceId: string,
  startUnit: number,
): PlacementResult {
  const inventoryItem = state.inventory.find(
    (item) => item.id === equipmentInstanceId,
  );
  if (inventoryItem === undefined) {
    return failure(
      "UNKNOWN_EQUIPMENT_INSTANCE",
      `Unknown inventory instance: ${equipmentInstanceId}`,
    );
  }
  const definition = EQUIPMENT_DEFINITIONS.find(
    (item) => item.id === inventoryItem.definitionId,
  );
  if (definition === undefined) {
    return failure(
      "UNKNOWN_EQUIPMENT_DEFINITION",
      `Unknown equipment definition: ${inventoryItem.definitionId}`,
    );
  }
  const allPlacedIds = state.facilities.flatMap((facility) =>
    facility.racks.flatMap((rack) => rack.equipment.map(({ id }) => id)),
  );
  const allIds = [...state.inventory.map(({ id }) => id), ...allPlacedIds];
  if (new Set(allIds).size !== allIds.length) {
    return failure(
      "DUPLICATE_INSTANCE",
      "Equipment instance IDs must be unique",
    );
  }
  if (!Number.isInteger(startUnit) || startUnit < 0) {
    return failure(
      "INVALID_START_UNIT",
      "Rack start unit must be a non-negative integer",
    );
  }

  let targetRack = state.facilities
    .flatMap(({ racks }) => racks)
    .find(({ id }) => id === rackInstanceId);
  if (targetRack === undefined) {
    return failure("UNKNOWN_RACK", `Unknown rack instance: ${rackInstanceId}`);
  }
  const rackDefinition = getRackDefinition(targetRack.definitionId);
  if (
    !rackDefinition.supportedCategories.includes(definition.category) ||
    !definition.tags.some((tag) =>
      rackDefinition.supportedEquipmentTags.includes(tag),
    )
  ) {
    return failure(
      "INCOMPATIBLE_EQUIPMENT",
      `${definition.name} is incompatible with ${rackDefinition.name}`,
    );
  }
  const endUnit = startUnit + definition.rackUnits;
  if (endUnit > rackDefinition.rackUnits) {
    return failure(
      "RACK_OVERFLOW",
      `${definition.name} does not fit in the rack`,
    );
  }
  const overlaps = targetRack.equipment.some((placement) => {
    const placedDefinition = EQUIPMENT_DEFINITIONS.find(
      ({ id }) => id === placement.definitionId,
    );
    if (placedDefinition === undefined) return true;
    const placedEnd = placement.startUnit + placedDefinition.rackUnits;
    return startUnit < placedEnd && endUnit > placement.startUnit;
  });
  if (overlaps) {
    return failure(
      "EQUIPMENT_OVERLAP",
      `${definition.name} overlaps equipment`,
    );
  }

  targetRack = {
    ...targetRack,
    equipment: [
      ...targetRack.equipment,
      { ...inventoryItem, startUnit, poweredOn: true },
    ],
  };
  return {
    ok: true,
    state: {
      ...state,
      inventory: state.inventory.filter(({ id }) => id !== equipmentInstanceId),
      facilities: state.facilities.map((facility) => ({
        ...facility,
        racks: facility.racks.map((rack) =>
          rack.id === rackInstanceId ? targetRack : rack,
        ),
      })),
    },
  };
}
