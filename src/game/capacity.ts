import {
  getEquipmentDefinition,
  getFacilityDefinition,
  getRackDefinition,
} from "./definitions";
import { DomainInvariantError, assertFiniteNonNegative, clamp } from "./errors";
import type {
  FacilityInstance,
  GameState,
  RackCapacity,
  RackInstance,
  ResourceVector,
} from "./types";

const emptyResources = (): ResourceVector => ({
  compute: 0,
  gpuCompute: 0,
  storage: 0,
  bandwidth: 0,
});

export function calculateRackCapacity(
  rack: RackInstance,
  facility: FacilityInstance,
  facilityPowerEfficiency = 1,
): RackCapacity {
  const rackDefinition = getRackDefinition(rack.definitionId);
  const facilityDefinition = getFacilityDefinition(facility.definitionId);
  assertFiniteNonNegative(facilityPowerEfficiency, "facility power efficiency");
  const raw = emptyResources();
  let powerDraw = 0;
  let heatOutput = 0;
  let suppliedPower = 0;
  let suppliedCooling = 0;
  let security = 0;
  let usedRackUnits = 0;
  let reliability = 1;
  const occupiedUnits = new Set<number>();
  const instanceIds = new Set<string>();

  for (const placement of rack.equipment) {
    if (instanceIds.has(placement.id)) {
      throw new DomainInvariantError(
        "DUPLICATE_INSTANCE",
        `Duplicate equipment instance: ${placement.id}`,
      );
    }
    instanceIds.add(placement.id);
    const definition = getEquipmentDefinition(placement.definitionId);
    if (
      !rackDefinition.supportedCategories.includes(definition.category) ||
      !definition.tags.some((tag) =>
        rackDefinition.supportedEquipmentTags.includes(tag),
      )
    ) {
      throw new DomainInvariantError(
        "INCOMPATIBLE_EQUIPMENT",
        `${definition.id} is incompatible with ${rackDefinition.id}`,
      );
    }
    const endUnit = placement.startUnit + definition.rackUnits;
    if (
      !Number.isInteger(placement.startUnit) ||
      placement.startUnit < 0 ||
      endUnit > rackDefinition.rackUnits
    ) {
      throw new DomainInvariantError(
        "RACK_OVERFLOW",
        `${placement.id} is outside rack bounds`,
      );
    }
    for (let unit = placement.startUnit; unit < endUnit; unit += 1) {
      if (occupiedUnits.has(unit)) {
        throw new DomainInvariantError(
          "EQUIPMENT_OVERLAP",
          `${placement.id} overlaps rack unit ${String(unit)}`,
        );
      }
      occupiedUnits.add(unit);
    }
    usedRackUnits += definition.rackUnits;
    if (!placement.poweredOn) continue;
    raw.compute += definition.compute ?? 0;
    raw.gpuCompute += definition.gpuCompute ?? 0;
    raw.storage += definition.storage ?? 0;
    raw.bandwidth += definition.bandwidth ?? 0;
    powerDraw += definition.powerDraw;
    heatOutput += definition.heatOutput;
    suppliedPower += definition.powerCapacity ?? 0;
    suppliedCooling += definition.cooling ?? 0;
    security += definition.security ?? 0;
    reliability = Math.min(reliability, definition.reliability);
  }

  const availablePower = Math.min(rackDefinition.maximumPower, suppliedPower);
  const rackPowerEfficiency =
    powerDraw === 0 ? 1 : clamp(availablePower / powerDraw, 0, 1);
  const powerEfficiency = Math.min(
    rackPowerEfficiency,
    clamp(facilityPowerEfficiency, 0, 1),
  );
  const rackCount = Math.max(1, facility.racks.length);
  const availableCooling =
    (facilityDefinition.baseCooling / rackCount + suppliedCooling) *
    rackDefinition.airflowModifier;
  const coolingRatio = heatOutput === 0 ? 1 : availableCooling / heatOutput;
  const thermalEfficiency = clamp(coolingRatio, 0.25, 1);
  const outputEfficiency = powerEfficiency * thermalEfficiency;
  const adjustedReliability = clamp(
    reliability +
      facilityDefinition.reliabilityModifier +
      rackDefinition.reliabilityModifier,
    0,
    1,
  );
  const effectiveReliability = clamp(
    adjustedReliability * powerEfficiency * thermalEfficiency,
    0,
    1,
  );

  return {
    compute: raw.compute * outputEfficiency,
    gpuCompute: raw.gpuCompute * outputEfficiency,
    storage: raw.storage * outputEfficiency,
    bandwidth: Math.min(
      raw.bandwidth * outputEfficiency,
      facilityDefinition.internetCapacity,
    ),
    security: security * outputEfficiency,
    reliability: effectiveReliability,
    raw,
    powerDraw,
    availablePower,
    powerEfficiency,
    heatOutput,
    availableCooling,
    thermalEfficiency,
    usedRackUnits,
  };
}

export function calculateAllRackCapacities(
  state: GameState,
): ReadonlyMap<string, RackCapacity> {
  const result = new Map<string, RackCapacity>();
  for (const facility of state.facilities) {
    const definition = getFacilityDefinition(facility.definitionId);
    const totalPower = facility.racks.reduce(
      (facilityTotal, rack) =>
        facilityTotal +
        rack.equipment.reduce(
          (rackTotal, equipment) =>
            rackTotal +
            (equipment.poweredOn
              ? getEquipmentDefinition(equipment.definitionId).powerDraw
              : 0),
          0,
        ),
      0,
    );
    const facilityPowerEfficiency =
      totalPower === 0 ? 1 : clamp(definition.powerCapacity / totalPower, 0, 1);
    const capacities = facility.racks.map((rack) => ({
      rack,
      capacity: calculateRackCapacity(rack, facility, facilityPowerEfficiency),
    }));
    const totalBandwidth = capacities.reduce(
      (sum, { capacity }) => sum + capacity.bandwidth,
      0,
    );
    const bandwidthEfficiency =
      totalBandwidth === 0
        ? 1
        : clamp(definition.internetCapacity / totalBandwidth, 0, 1);
    for (const { rack, capacity } of capacities) {
      result.set(rack.id, {
        ...capacity,
        bandwidth: capacity.bandwidth * bandwidthEfficiency,
      });
    }
  }
  return result;
}
