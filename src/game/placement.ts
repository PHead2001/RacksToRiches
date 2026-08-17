import { EQUIPMENT_DEFINITIONS, getRackDefinition } from "./definitions";
import { assertGameState } from "./validation";
import type {
  EquipmentInstance,
  EquipmentPlacement,
  GameState,
  RackInstance,
} from "./types";

export type PlacementErrorCode =
  | "UNKNOWN_EQUIPMENT_INSTANCE"
  | "UNKNOWN_EQUIPMENT_DEFINITION"
  | "UNKNOWN_RACK"
  | "DUPLICATE_INSTANCE"
  | "INVALID_START_UNIT"
  | "RACK_OVERFLOW"
  | "EQUIPMENT_OVERLAP"
  | "INCOMPATIBLE_EQUIPMENT"
  | "CAPACITY_EXCEEDED"
  | "INVALID_TARGET"
  | "TERMINAL_STATE";

export type PlacementResult =
  | {
      ok: true;
      state: GameState;
      placement: EquipmentPlacement | null;
      reflowed: boolean;
    }
  | { ok: false; error: { code: PlacementErrorCode; message: string } };

function failure(code: PlacementErrorCode, message: string): PlacementResult {
  return { ok: false, error: { code, message } };
}

export type EquipmentTarget =
  { kind: "inventory" } | { kind: "rack"; rackId: string; anchorUnit: number };

interface LocatedEquipment {
  item: EquipmentInstance;
  placement: EquipmentPlacement | null;
}

function locateEquipment(
  state: GameState,
  equipmentId: string,
): LocatedEquipment | null {
  const inventory = state.inventory.find(({ id }) => id === equipmentId);
  if (inventory !== undefined) return { item: inventory, placement: null };
  for (const facility of state.facilities) {
    for (const rack of facility.racks) {
      const placement = rack.equipment.find(({ id }) => id === equipmentId);
      if (placement !== undefined) return { item: placement, placement };
    }
  }
  return null;
}

function equipmentSize(definitionId: string): number | null {
  return (
    EQUIPMENT_DEFINITIONS.find(({ id }) => id === definitionId)?.rackUnits ??
    null
  );
}

function overlaps(
  start: number,
  size: number,
  placement: EquipmentPlacement,
): boolean {
  const placedSize = equipmentSize(placement.definitionId);
  if (placedSize === null) return true;
  return (
    start < placement.startUnit + placedSize &&
    start + size > placement.startUnit
  );
}

function candidateStarts(
  rackUnits: number,
  itemUnits: number,
  anchorUnit: number,
): number[] {
  return Array.from(
    { length: rackUnits - itemUnits + 1 },
    (_, start) => start,
  ).sort((left, right) => {
    const distance = (start: number) =>
      anchorUnit < start
        ? start - anchorUnit
        : anchorUnit >= start + itemUnits
          ? anchorUnit - (start + itemUnits - 1)
          : 0;
    return distance(left) - distance(right) || left - right;
  });
}

function bestReflow(
  existing: readonly EquipmentPlacement[],
  rackUnits: number,
  targetStart: number,
  targetUnits: number,
): EquipmentPlacement[] | null {
  const ordered = [...existing].sort(
    (left, right) =>
      left.startUnit - right.startUnit || left.id.localeCompare(right.id),
  );
  const candidates: {
    placements: EquipmentPlacement[];
    score: number;
    key: string;
  }[] = [];

  const search = (
    index: number,
    minimumStart: number,
    placements: EquipmentPlacement[],
  ): void => {
    const equipment = ordered[index];
    if (equipment === undefined) {
      const movement = placements.reduce((sum, placement, placementIndex) => {
        const original = ordered[placementIndex];
        if (original === undefined) return sum;
        const distance = Math.abs(placement.startUnit - original.startUnit);
        const upwardPenalty = placement.startUnit > original.startUnit ? 1 : 0;
        return sum + distance * 100 + upwardPenalty;
      }, 0);
      const key = placements
        .map(({ startUnit }) => String(startUnit).padStart(3, "0"))
        .join(":");
      candidates.push({ placements: [...placements], score: movement, key });
      return;
    }
    const size = equipmentSize(equipment.definitionId);
    if (size === null) return;
    for (let start = minimumStart; start + size <= rackUnits; start += 1) {
      const touchesTarget =
        start < targetStart + targetUnits && start + size > targetStart;
      if (touchesTarget) continue;
      search(index + 1, start + size, [
        ...placements,
        { ...equipment, startUnit: start },
      ]);
    }
  };

  search(0, 0, []);
  candidates.sort(
    (left, right) =>
      left.score - right.score || left.key.localeCompare(right.key),
  );
  return candidates[0]?.placements ?? null;
}

export function relocateEquipment(
  state: GameState,
  equipmentId: string,
  target: EquipmentTarget,
): PlacementResult {
  if (state.progression.terminalState !== null) {
    return failure("TERMINAL_STATE", "This company can no longer edit racks");
  }
  const ids = [
    ...state.inventory.map(({ id }) => id),
    ...state.facilities.flatMap(({ racks }) =>
      racks.flatMap(({ equipment }) => equipment.map(({ id }) => id)),
    ),
  ];
  if (new Set(ids).size !== ids.length) {
    return failure(
      "DUPLICATE_INSTANCE",
      "Equipment instance IDs must be unique",
    );
  }
  const located = locateEquipment(state, equipmentId);
  if (located === null) {
    return failure(
      "UNKNOWN_EQUIPMENT_INSTANCE",
      `Unknown equipment instance: ${equipmentId}`,
    );
  }
  const definition = EQUIPMENT_DEFINITIONS.find(
    ({ id }) => id === located.item.definitionId,
  );
  if (definition === undefined) {
    return failure(
      "UNKNOWN_EQUIPMENT_DEFINITION",
      `Unknown equipment definition: ${located.item.definitionId}`,
    );
  }

  const withoutItem = state.facilities.map((facility) => ({
    ...facility,
    racks: facility.racks.map((rack) => ({
      ...rack,
      equipment: rack.equipment.filter(({ id }) => id !== equipmentId),
    })),
  }));
  if (target.kind === "inventory") {
    if (located.placement === null) {
      return failure(
        "INVALID_TARGET",
        `${definition.name} is already in inventory`,
      );
    }
    const next = {
      ...state,
      facilities: withoutItem,
      inventory: [...state.inventory, located.item],
    };
    assertGameState(next);
    return { ok: true, state: next, placement: null, reflowed: false };
  }

  const targetRack = withoutItem
    .flatMap(({ racks }) => racks)
    .find(({ id }) => id === target.rackId);
  if (targetRack === undefined) {
    return failure("UNKNOWN_RACK", `Unknown rack instance: ${target.rackId}`);
  }
  const rackDefinition = getRackDefinition(targetRack.definitionId);
  if (
    !Number.isInteger(target.anchorUnit) ||
    target.anchorUnit < 0 ||
    target.anchorUnit >= rackDefinition.rackUnits
  ) {
    return failure(
      "INVALID_START_UNIT",
      "Rack anchor must identify an existing unit",
    );
  }
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
  if (definition.rackUnits > rackDefinition.rackUnits) {
    return failure(
      "CAPACITY_EXCEEDED",
      `${definition.name} is larger than the rack`,
    );
  }

  const starts = candidateStarts(
    rackDefinition.rackUnits,
    definition.rackUnits,
    target.anchorUnit,
  );
  let selectedStart: number | undefined;
  let existingLayout = targetRack.equipment;
  let reflowed = false;
  const usedUnits = targetRack.equipment.reduce((sum, placement) => {
    const size = equipmentSize(placement.definitionId);
    return size === null ? Number.POSITIVE_INFINITY : sum + size;
  }, 0);
  if (usedUnits + definition.rackUnits > rackDefinition.rackUnits) {
    return failure(
      "CAPACITY_EXCEEDED",
      `${definition.name} cannot fit because the rack lacks ${String(definition.rackUnits)} free units`,
    );
  }
  for (const start of starts) {
    const empty = targetRack.equipment.every(
      (placement) => !overlaps(start, definition.rackUnits, placement),
    );
    if (empty) {
      selectedStart = start;
      break;
    }
    if (targetRack.equipment.length > 0) {
      const layout = bestReflow(
        targetRack.equipment,
        rackDefinition.rackUnits,
        start,
        definition.rackUnits,
      );
      if (layout !== null) {
        selectedStart = start;
        existingLayout = layout;
        reflowed = true;
        break;
      }
    }
  }
  if (selectedStart === undefined) {
    return failure(
      "CAPACITY_EXCEEDED",
      `${definition.name} has no valid rack layout`,
    );
  }

  const placement: EquipmentPlacement = {
    ...located.item,
    startUnit: selectedStart,
    poweredOn: located.placement?.poweredOn ?? true,
  };
  const nextRack: RackInstance = {
    ...targetRack,
    equipment: [...existingLayout, placement].sort(
      (left, right) =>
        left.startUnit - right.startUnit || left.id.localeCompare(right.id),
    ),
  };
  const next = {
    ...state,
    inventory: state.inventory.filter(({ id }) => id !== equipmentId),
    facilities: withoutItem.map((facility) => ({
      ...facility,
      racks: facility.racks.map((rack) =>
        rack.id === target.rackId ? nextRack : rack,
      ),
    })),
  };
  assertGameState(next);
  return { ok: true, state: next, placement, reflowed };
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
    placement:
      targetRack.equipment.find(({ id }) => id === equipmentInstanceId) ?? null,
    reflowed: false,
  };
}
