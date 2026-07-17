import { describe, expect, it } from "vitest";

import { calculateRackCapacity } from "./capacity";
import {
  CUSTOMER_DEFINITIONS,
  EQUIPMENT_DEFINITIONS,
  FACILITY_DEFINITIONS,
  RACK_DEFINITIONS,
  REPUTATION_TIERS,
  RESEARCH_DEFINITIONS,
  SERVICE_DEFINITIONS,
  collectDefinitionIssues,
  getEquipmentDefinition,
  getFacilityDefinition,
  getRackDefinition,
} from "./definitions";
import { DomainInvariantError, clamp } from "./errors";
import { createInitialState } from "./initialState";
import { placeEquipment } from "./placement";
import { nextRandom, randomInteger, validateSeed } from "./random";
import type { GameState } from "./types";

function successfulPlacement(
  state: GameState,
  equipmentId: string,
  unit: number,
): GameState {
  const result = placeEquipment(state, equipmentId, "rack-starter-1", unit);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

describe("centralized definitions", () => {
  it("contains the complete Phase 1 data set with valid references", () => {
    expect(EQUIPMENT_DEFINITIONS).toHaveLength(12);
    expect(RACK_DEFINITIONS).toHaveLength(3);
    expect(FACILITY_DEFINITIONS).toHaveLength(2);
    expect(SERVICE_DEFINITIONS).toHaveLength(4);
    expect(REPUTATION_TIERS).toHaveLength(3);
    expect(RESEARCH_DEFINITIONS.map(({ branch }) => branch)).toEqual(
      expect.arrayContaining([
        "hardware",
        "infrastructure",
        "services",
        "automation",
      ]),
    );
    expect(CUSTOMER_DEFINITIONS).toHaveLength(3);
    expect(collectDefinitionIssues()).toEqual([]);
  });

  it("rejects unknown definition IDs", () => {
    expect(() => getEquipmentDefinition("bogus")).toThrow(DomainInvariantError);
    expect(() => getRackDefinition("bogus")).toThrow(DomainInvariantError);
    expect(() => getFacilityDefinition("bogus")).toThrow(DomainInvariantError);
  });
});

describe("initial state", () => {
  it("uses the README starting values and returns independent instances", () => {
    const first = createInitialState();
    const second = createInitialState();
    expect(first.company.cash).toBe(0);
    expect(first.facilities[0]?.racks[0]?.equipment).toEqual([]);
    expect(first.inventory).toHaveLength(4);
    expect(first.contracts.offers[0]?.baseRevenuePerSecond).toBe(2);
    first.inventory.pop();
    expect(second.inventory).toHaveLength(4);
  });

  it("accepts injected deterministic metadata and rejects invalid values", () => {
    expect(createInitialState({ seed: 4, startedAt: 12 })).toMatchObject({
      rngSeed: 4,
      statistics: { startedAt: 12 },
    });
    expect(() => createInitialState({ seed: -1 })).toThrow(
      DomainInvariantError,
    );
    expect(() => createInitialState({ startedAt: Number.NaN })).toThrow(
      DomainInvariantError,
    );
  });
});

describe("rack placement", () => {
  it("places contiguous equipment and calculates rack-unit totals", () => {
    let state = createInitialState();
    state = successfulPlacement(state, "equipment-refurbished-1", 0);
    state = successfulPlacement(state, "equipment-router-1", 4);
    state = successfulPlacement(state, "equipment-power-strip-1", 5);
    state = successfulPlacement(state, "equipment-desk-fan-1", 6);
    const facility = state.facilities[0];
    const rack = facility?.racks[0];
    if (facility === undefined || rack === undefined)
      throw new Error("fixture");
    const capacity = calculateRackCapacity(rack, facility);
    expect(capacity.usedRackUnits).toBe(7);
    expect(capacity.raw).toEqual({
      compute: 25,
      gpuCompute: 0,
      storage: 5,
      bandwidth: 100,
    });
    expect(capacity.compute).toBe(25);
    expect(capacity.reliability).toBeCloseTo(0.8);
  });

  it("returns specific failures for invalid placement commands", () => {
    const state = createInitialState();
    expect(placeEquipment(state, "missing", "rack-starter-1", 0)).toMatchObject(
      { ok: false, error: { code: "UNKNOWN_EQUIPMENT_INSTANCE" } },
    );
    expect(
      placeEquipment(state, "equipment-refurbished-1", "missing", 0),
    ).toMatchObject({ ok: false, error: { code: "UNKNOWN_RACK" } });
    expect(
      placeEquipment(state, "equipment-refurbished-1", "rack-starter-1", -1),
    ).toMatchObject({ ok: false, error: { code: "INVALID_START_UNIT" } });
    expect(
      placeEquipment(state, "equipment-refurbished-1", "rack-starter-1", 9),
    ).toMatchObject({ ok: false, error: { code: "RACK_OVERFLOW" } });
  });

  it("rejects overlaps, duplicate instances, incompatible tags, and unknown definitions", () => {
    const occupied = successfulPlacement(
      createInitialState(),
      "equipment-refurbished-1",
      0,
    );
    expect(
      placeEquipment(occupied, "equipment-router-1", "rack-starter-1", 2),
    ).toMatchObject({ ok: false, error: { code: "EQUIPMENT_OVERLAP" } });

    const duplicate = createInitialState();
    const firstInventoryItem = duplicate.inventory[0];
    if (firstInventoryItem === undefined) throw new Error("fixture");
    duplicate.inventory.push({ ...firstInventoryItem });
    expect(
      placeEquipment(duplicate, "equipment-refurbished-1", "rack-starter-1", 0),
    ).toMatchObject({ ok: false, error: { code: "DUPLICATE_INSTANCE" } });

    const incompatible = createInitialState();
    incompatible.inventory.push({
      id: "portable",
      definitionId: "portable-ac",
      acquisitionPrice: 0,
    });
    expect(
      placeEquipment(incompatible, "portable", "rack-starter-1", 0),
    ).toMatchObject({ ok: false, error: { code: "INCOMPATIBLE_EQUIPMENT" } });

    const unknown = createInitialState();
    unknown.inventory.push({
      id: "mystery",
      definitionId: "missing",
      acquisitionPrice: 0,
    });
    expect(
      placeEquipment(unknown, "mystery", "rack-starter-1", 0),
    ).toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_EQUIPMENT_DEFINITION" },
    });
  });
});

describe("power and cooling", () => {
  it("applies power and minimum thermal penalties without negative output", () => {
    const state = createInitialState();
    const facility = state.facilities[0];
    const rack = facility?.racks[0];
    if (facility === undefined || rack === undefined)
      throw new Error("fixture");
    rack.equipment = [
      ...Array.from({ length: 5 }, (_, index) => ({
        id: `compute-${String(index)}`,
        definitionId: "used-2u-compute",
        acquisitionPrice: 0,
        startUnit: index * 2,
        poweredOn: true,
      })),
      {
        id: "power",
        definitionId: "power-strip",
        acquisitionPrice: 0,
        startUnit: 10,
        poweredOn: true,
      },
    ];
    const capacity = calculateRackCapacity(rack, facility, 0.8);
    expect(capacity.powerEfficiency).toBeLessThan(0.8);
    expect(capacity.thermalEfficiency).toBe(0.25);
    expect(capacity.compute).toBeGreaterThan(0);
    expect(capacity.compute).toBeLessThan(capacity.raw.compute);
    expect(capacity.reliability).toBeGreaterThanOrEqual(0);
  });

  it("returns zero effective output without supplied rack power", () => {
    const state = createInitialState();
    const facility = state.facilities[0];
    const rack = facility?.racks[0];
    if (facility === undefined || rack === undefined)
      throw new Error("fixture");
    rack.equipment = [
      {
        id: "compute",
        definitionId: "used-2u-compute",
        acquisitionPrice: 0,
        startUnit: 0,
        poweredOn: true,
      },
    ];
    const capacity = calculateRackCapacity(rack, facility);
    expect(capacity.powerEfficiency).toBe(0);
    expect(capacity.compute).toBe(0);
    expect(capacity.thermalEfficiency).toBeGreaterThanOrEqual(0.25);
  });

  it("rejects direct invariant violations", () => {
    const state = createInitialState();
    const facility = state.facilities[0];
    const rack = facility?.racks[0];
    if (facility === undefined || rack === undefined)
      throw new Error("fixture");
    rack.equipment = [
      {
        id: "same",
        definitionId: "consumer-router",
        acquisitionPrice: 0,
        startUnit: 0,
        poweredOn: true,
      },
      {
        id: "same",
        definitionId: "consumer-router",
        acquisitionPrice: 0,
        startUnit: 1,
        poweredOn: true,
      },
    ];
    expect(() => calculateRackCapacity(rack, facility)).toThrow(
      DomainInvariantError,
    );
    const firstPlacement = rack.equipment[0];
    if (firstPlacement === undefined) throw new Error("fixture");
    expect(() =>
      calculateRackCapacity(
        { ...rack, equipment: [{ ...firstPlacement, startUnit: 12 }] },
        facility,
      ),
    ).toThrow(DomainInvariantError);
    expect(() => clamp(Number.POSITIVE_INFINITY, 0, 1)).toThrow(
      DomainInvariantError,
    );

    const incompatibleRack = {
      ...rack,
      equipment: [
        {
          id: "ac",
          definitionId: "portable-ac",
          acquisitionPrice: 0,
          startUnit: 0,
          poweredOn: true,
        },
      ],
    };
    expect(() => calculateRackCapacity(incompatibleRack, facility)).toThrow(
      DomainInvariantError,
    );
  });
});

describe("seeded randomness", () => {
  it("is reproducible and advances its explicit seed", () => {
    const first = nextRandom(123);
    const second = nextRandom(123);
    expect(first).toEqual(second);
    expect(first.value).toBeGreaterThanOrEqual(0);
    expect(first.value).toBeLessThan(1);
    expect(first.seed).not.toBe(123);
    expect(randomInteger(123, 2, 5)).toEqual(randomInteger(123, 2, 5));
  });

  it("rejects invalid seeds and integer ranges", () => {
    expect(() => {
      validateSeed(1.5);
    }).toThrow(DomainInvariantError);
    expect(() => {
      validateSeed(4_294_967_296);
    }).toThrow(DomainInvariantError);
    expect(() => randomInteger(1, 5, 5)).toThrow(DomainInvariantError);
  });
});
