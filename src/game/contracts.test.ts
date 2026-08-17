import { describe, expect, it } from "vitest";

import {
  aggregateContractDemand,
  calculateContractPerformance,
  calculateFulfillment,
  calculateServicePoolProjection,
  calculateSlaBufferSeconds,
  revenueMultiplier,
  validateContractRequirements,
} from "./contracts";
import {
  calculateContractReadiness,
  calculateSlaBuffer,
} from "./contractStatus";
import { DomainInvariantError } from "./errors";
import type { ContractInstance, RackCapacity } from "./types";

function capacity(overrides: Partial<RackCapacity> = {}): RackCapacity {
  return {
    compute: 100,
    gpuCompute: 100,
    storage: 100,
    bandwidth: 100,
    security: 1,
    reliability: 1,
    raw: { compute: 100, gpuCompute: 100, storage: 100, bandwidth: 100 },
    powerDraw: 0,
    availablePower: 0,
    powerEfficiency: 1,
    heatOutput: 0,
    availableCooling: 0,
    thermalEfficiency: 1,
    usedRackUnits: 0,
    ...overrides,
  };
}

function contract(
  requirements: ContractInstance["requirements"],
): ContractInstance {
  return {
    id: "contract-1",
    customerId: "customer",
    serviceType: "website-hosting",
    tier: 1,
    status: "active",
    assignedTargetId: "rack-1",
    requirements,
    baseRevenuePerSecond: 1,
    remainingSeconds: 10,
    totalDurationSeconds: 10,
    growthPotential: "none",
    customerTolerance: 5,
    performanceScore: 0,
    violationSeconds: 0,
    autoRenew: false,
  };
}

describe("contract fulfillment", () => {
  it.each([
    [0.49, 0],
    [0.5, 0.25],
    [0.8, 0.64],
    [1, 1],
    [1.1, 1.08],
    [1.25, 1.2],
    [2, 1.2],
  ])(
    "maps %s fulfillment to the expected revenue boundary",
    (score, multiplier) => {
      expect(revenueMultiplier(score)).toBeCloseTo(multiplier);
    },
  );

  it("uses the lowest positive requirement and excludes zero demand", () => {
    expect(
      calculateFulfillment(capacity({ compute: 49, storage: 80 }), {
        compute: 100,
        storage: 100,
        bandwidth: 0,
      }),
    ).toBe(0.49);
    expect(
      calculateFulfillment(capacity({ storage: 80 }), {
        compute: 0,
        storage: 100,
      }),
    ).toBe(0.8);
  });

  it("rejects empty, negative, and non-finite contract demand", () => {
    expect(() => {
      validateContractRequirements({});
    }).toThrow(DomainInvariantError);
    expect(() => {
      validateContractRequirements({ compute: 0 });
    }).toThrow(DomainInvariantError);
    expect(() => {
      validateContractRequirements({ compute: -1 });
    }).toThrow(DomainInvariantError);
    expect(() => {
      validateContractRequirements({ compute: Number.NaN });
    }).toThrow(DomainInvariantError);
    expect(() => revenueMultiplier(-1)).toThrow(DomainInvariantError);
  });

  it("aggregates only active, unexpired contracts assigned to the target", () => {
    const active = contract({ compute: 10, bandwidth: 0 });
    const second = {
      ...contract({ compute: 5, storage: 4 }),
      id: "contract-2",
    };
    const offered = {
      ...contract({ compute: 999 }),
      id: "contract-3",
      status: "offered" as const,
    };
    const other = {
      ...contract({ compute: 999 }),
      id: "contract-4",
      assignedTargetId: "rack-2",
    };
    const expired = {
      ...contract({ compute: 999 }),
      id: "contract-5",
      remainingSeconds: 0,
    };
    expect(
      aggregateContractDemand(
        [active, second, offered, other, expired],
        "rack-1",
      ),
    ).toEqual({ compute: 15, storage: 4 });
  });

  it("derives bounded SLA buffers from duration", () => {
    expect(calculateSlaBufferSeconds(30)).toBe(5);
    expect(calculateSlaBufferSeconds(180)).toBe(18);
    expect(calculateSlaBufferSeconds(300)).toBe(30);
    expect(calculateSlaBufferSeconds(600)).toBe(45);
    expect(() => calculateSlaBufferSeconds(0)).toThrow(DomainInvariantError);
  });

  it("projects residual consumable capacity without consuming capabilities", () => {
    const active = contract({
      compute: 40,
      storage: 7,
      bandwidth: 60,
      reliability: 0.9,
    });
    const candidate = {
      ...contract({ compute: 25, storage: 10, reliability: 0.95 }),
      id: "candidate",
      status: "offered" as const,
      assignedTargetId: undefined,
    };
    const projection = calculateServicePoolProjection(
      capacity({ compute: 60, storage: 85, bandwidth: 100 }),
      [active],
      "rack-1",
      candidate,
    );
    expect(projection.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "compute",
          used: 40,
          remaining: 20,
          candidateRequired: 25,
          shortfall: 5,
        }),
        expect.objectContaining({ key: "storage", used: 7, remaining: 78 }),
      ]),
    );
    expect(projection.capabilities).toContainEqual({
      key: "reliability",
      available: 1,
      required: 0.95,
      shortfall: 0,
    });
    expect(projection.safe).toBe(false);
  });

  it("fails explicitly when an active assignment has no capacity", () => {
    expect(() =>
      calculateContractPerformance(
        [contract({ compute: 1 })],
        new Map<string, RackCapacity>(),
      ),
    ).toThrow(DomainInvariantError);
    expect(() =>
      calculateFulfillment(capacity({ compute: Number.POSITIVE_INFINITY }), {
        compute: 1,
      }),
    ).toThrow(DomainInvariantError);
  });

  it("reports consumed, recovered, remaining, and breached SLA buffer", () => {
    const warning = {
      ...contract({ compute: 100 }),
      totalDurationSeconds: 450,
      remainingSeconds: 450,
      customerTolerance: 45,
      performanceScore: 0.8,
      violationSeconds: 12,
    };
    expect(calculateSlaBuffer(warning)).toEqual({
      totalSeconds: 45,
      consumedSeconds: 12,
      remainingSeconds: 33,
      state: "Warning",
    });
    expect(
      calculateSlaBuffer({
        ...warning,
        performanceScore: 1,
        violationSeconds: 7,
      }),
    ).toMatchObject({ remainingSeconds: 38, state: "Recovering" });
    expect(
      calculateSlaBuffer({
        ...warning,
        performanceScore: 1,
        violationSeconds: 0,
      }),
    ).toMatchObject({ remainingSeconds: 45, state: "Healthy" });
    expect(calculateSlaBuffer({ ...warning, violationSeconds: 50 })).toEqual({
      totalSeconds: 45,
      consumedSeconds: 45,
      remainingSeconds: 0,
      state: "Breached",
    });
  });

  it("uses one epsilon-aware readiness result for labels and acceptance", () => {
    const tutorial = {
      ...contract({ compute: 100 }),
      id: "contract-tutorial-1",
      status: "offered" as const,
      assignedTargetId: undefined,
    };
    expect(
      calculateContractReadiness(tutorial, capacity({ compute: 0 })),
    ).toMatchObject({
      kind: "install-hardware",
      label: "INSTALL HARDWARE",
      canAccept: false,
    });
    expect(
      calculateContractReadiness(tutorial, capacity({ compute: 99 })),
    ).toMatchObject({
      kind: "capacity-shortfall",
      label: "CAPACITY SHORTFALL",
      canAccept: false,
    });
    expect(
      calculateContractReadiness(tutorial, capacity({ compute: 100 - 5e-10 })),
    ).toMatchObject({ kind: "ready", label: "READY", canAccept: true });
    const active = {
      ...tutorial,
      status: "active" as const,
      assignedTargetId: "rack-1",
    };
    expect(
      calculateContractReadiness(
        active,
        capacity({ compute: 100 }),
        [active],
        "rack-1",
      ),
    ).toMatchObject({ kind: "active", label: "ACTIVE", canAccept: false });
    expect(
      calculateContractReadiness(
        active,
        capacity({ compute: 50 }),
        [active],
        "rack-1",
      ),
    ).toMatchObject({
      kind: "sla-warning",
      label: "SLA WARNING",
      canAccept: false,
    });
  });
});
