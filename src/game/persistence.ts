import { z } from "zod";

import {
  CURRENT_GAME_VERSION,
  STARTER_EQUIPMENT_INSTANCE_IDS,
  TUTORIAL_DURATION_SECONDS,
} from "./constants";
import { calculateSlaBufferSeconds } from "./contracts";
import { EQUIPMENT_DEFINITIONS } from "./definitions";
import { DomainInvariantError } from "./errors";
import { TUTORIAL_CONTRACT_ID } from "./marketplace";
import type { GameState } from "./types";
import { assertGameState } from "./validation";

const finiteNumber = z.number();
const nonNegative = finiteNumber.nonnegative();
const nonNegativeInteger = z.number().int().nonnegative();

const equipmentInstanceSchema = z
  .object({
    id: z.string().min(1),
    definitionId: z.string().min(1),
    acquisitionPrice: nonNegative,
  })
  .strict();
const placementSchema = equipmentInstanceSchema.extend({
  startUnit: nonNegativeInteger,
  poweredOn: z.boolean(),
});
const rackSchema = z
  .object({
    id: z.string().min(1),
    definitionId: z.string().min(1),
    equipment: z.array(placementSchema),
  })
  .strict();
const facilitySchema = z
  .object({
    id: z.string().min(1),
    definitionId: z.string().min(1),
    racks: z.array(rackSchema),
  })
  .strict();
const requirementsSchema = z
  .object({
    compute: nonNegative.optional(),
    gpuCompute: nonNegative.optional(),
    storage: nonNegative.optional(),
    bandwidth: nonNegative.optional(),
    reliability: nonNegative.optional(),
    security: nonNegative.optional(),
  })
  .strict();
const contractSchema = z
  .object({
    id: z.string().min(1),
    customerId: z.string().min(1),
    serviceType: z.enum([
      "website-hosting",
      "file-storage",
      "backup-hosting",
      "game-servers",
    ]),
    tier: z.number().int().positive(),
    status: z.enum([
      "offered",
      "active",
      "expiring",
      "completed",
      "breached",
      "cancelled",
    ]),
    assignedTargetId: z.string().min(1).optional(),
    requirements: requirementsSchema,
    baseRevenuePerSecond: nonNegative,
    remainingSeconds: nonNegative,
    totalDurationSeconds: finiteNumber.positive(),
    growthPotential: z.enum(["none", "low", "medium", "high"]),
    customerTolerance: finiteNumber.positive(),
    performanceScore: nonNegative,
    violationSeconds: nonNegative,
    autoRenew: z.boolean(),
  })
  .strict();
const customerSchema = z
  .object({
    id: z.string().min(1),
    definitionId: z.string().min(1).optional(),
    name: z.string().min(1),
    loyalty: nonNegative,
    currentStage: z.number().int().positive(),
  })
  .strict();

const terminalStateSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("tutorial-failed"),
      occurredAtSeconds: nonNegative,
    })
    .strict(),
  z
    .object({
      kind: z.literal("bankrupt"),
      occurredAtSeconds: nonNegative,
      tutorialFailed: z.boolean(),
    })
    .strict(),
]);

export const gameStateSchema: z.ZodType<GameState> = z
  .object({
    version: z.literal(CURRENT_GAME_VERSION),
    clockSeconds: nonNegative,
    rngSeed: nonNegativeInteger.max(4_294_967_295),
    company: z
      .object({
        name: z.string().min(1),
        cash: finiteNumber,
        reputation: nonNegative,
        researchPoints: nonNegative,
        lifetimeRevenue: nonNegative,
        lifetimeExpenses: nonNegative,
        currentTier: z.enum([
          "bedroom-host",
          "local-provider",
          "regional-provider",
        ]),
      })
      .strict(),
    facilities: z.array(facilitySchema).min(1),
    activeFacilityId: z.string().min(1),
    inventory: z.array(equipmentInstanceSchema),
    contracts: z
      .object({
        offers: z.array(contractSchema),
        active: z.array(contractSchema),
        completedCount: nonNegativeInteger,
      })
      .strict(),
    customers: z.array(customerSchema),
    research: z
      .object({ unlockedNodeIds: z.array(z.string().min(1)) })
      .strict(),
    progression: z
      .object({
        completedMilestones: z.array(z.string().min(1)),
        prestigeCurrency: nonNegative,
        terminalState: terminalStateSchema.nullable(),
      })
      .strict(),
    statistics: z
      .object({
        startedAt: nonNegative,
        lastSavedAt: nonNegative,
        totalOnlineSeconds: nonNegative,
        totalOfflineSeconds: nonNegative,
        contractsCompleted: nonNegativeInteger,
        contractsBreached: nonNegativeInteger,
        highestIncomePerSecond: nonNegative,
      })
      .strict(),
    settings: z
      .object({
        soundEnabled: z.boolean(),
        reducedMotion: z.boolean(),
        compactNumbers: z.boolean(),
        autosaveEnabled: z.boolean(),
      })
      .strict(),
  })
  .strict();

interface SaveEnvelope {
  version: number;
  state: unknown;
}

export type SaveMigration = (state: unknown) => unknown;
const legacyRecordSchema = z.record(z.string(), z.unknown());

const migrateVersionOne: SaveMigration = (state) => {
  const record = legacyRecordSchema.parse(state);
  const progression = legacyRecordSchema.parse(record["progression"]);
  return {
    ...record,
    version: 2,
    progression: { ...progression, terminalState: null },
  };
};

const starterEquipmentIds = new Set<string>(STARTER_EQUIPMENT_INSTANCE_IDS);

function migrateEquipmentAcquisitionPrice(value: unknown): unknown {
  const record = legacyRecordSchema.parse(value);
  const id = record["id"];
  const definitionId = record["definitionId"];
  const definition = EQUIPMENT_DEFINITIONS.find(
    (candidate) => candidate.id === definitionId,
  );
  return {
    ...record,
    acquisitionPrice:
      typeof id === "string" && starterEquipmentIds.has(id)
        ? 0
        : (definition?.purchaseCost ?? 0),
  };
}

function migrateRackEquipment(value: unknown): unknown {
  const record = legacyRecordSchema.parse(value);
  const equipment = z.array(z.unknown()).parse(record["equipment"]);
  return {
    ...record,
    equipment: equipment.map(migrateEquipmentAcquisitionPrice),
  };
}

function migrateFacilityEquipment(value: unknown): unknown {
  const record = legacyRecordSchema.parse(value);
  const racks = z.array(z.unknown()).parse(record["racks"]);
  return { ...record, racks: racks.map(migrateRackEquipment) };
}

function migrateContractBalance(value: unknown): unknown {
  const record = legacyRecordSchema.parse(value);
  const id = record["id"];
  const status = record["status"];
  const oldDuration = record["totalDurationSeconds"];
  const oldRemaining = record["remainingSeconds"];
  const oldTolerance = record["customerTolerance"];
  const oldViolation = record["violationSeconds"];
  if (
    typeof oldDuration !== "number" ||
    !Number.isFinite(oldDuration) ||
    oldDuration <= 0
  ) {
    return record;
  }
  const tutorial = id === TUTORIAL_CONTRACT_ID;
  const newDuration = tutorial ? TUTORIAL_DURATION_SECONDS : oldDuration;
  const newTolerance = calculateSlaBufferSeconds(newDuration);
  const ratioIsValid =
    typeof oldTolerance === "number" &&
    Number.isFinite(oldTolerance) &&
    oldTolerance > 0 &&
    typeof oldViolation === "number" &&
    Number.isFinite(oldViolation) &&
    oldViolation >= 0;
  const consumedRatio = ratioIsValid
    ? Math.min(1, oldViolation / oldTolerance)
    : null;
  const remainingIsValid =
    typeof oldRemaining === "number" &&
    Number.isFinite(oldRemaining) &&
    oldRemaining >= 0;
  const completionRatio = remainingIsValid
    ? Math.min(1, Math.max(0, (oldDuration - oldRemaining) / oldDuration))
    : null;
  const active = status === "active";
  const migratedRemaining = tutorial
    ? status === "offered"
      ? newDuration
      : status === "completed"
        ? 0
        : completionRatio !== null
          ? active
            ? Math.max(
                Number.EPSILON,
                newDuration * Math.max(0, 1 - completionRatio),
              )
            : newDuration * Math.max(0, 1 - completionRatio)
          : oldRemaining
    : oldRemaining;
  return {
    ...record,
    totalDurationSeconds: newDuration,
    remainingSeconds: migratedRemaining,
    customerTolerance: newTolerance,
    violationSeconds:
      consumedRatio === null
        ? oldViolation
        : Math.min(
            active ? newTolerance - Number.EPSILON : newTolerance,
            consumedRatio * newTolerance,
          ),
  };
}

const migrateVersionTwo: SaveMigration = (state) => {
  const record = legacyRecordSchema.parse(state);
  const facilities = z.array(z.unknown()).parse(record["facilities"]);
  const inventory = z.array(z.unknown()).parse(record["inventory"]);
  const contracts = legacyRecordSchema.parse(record["contracts"]);
  const offers = z.array(z.unknown()).parse(contracts["offers"]);
  const active = z.array(z.unknown()).parse(contracts["active"]);
  return {
    ...record,
    version: 3,
    facilities: facilities.map(migrateFacilityEquipment),
    inventory: inventory.map(migrateEquipmentAcquisitionPrice),
    contracts: {
      ...contracts,
      offers: offers.map(migrateContractBalance),
      active: active.map(migrateContractBalance),
    },
  };
};

export const SAVE_MIGRATIONS: ReadonlyMap<number, SaveMigration> = new Map([
  [1, migrateVersionOne],
  [2, migrateVersionTwo],
]);

const envelopeSchema = z
  .object({ version: z.number().int().nonnegative(), state: z.unknown() })
  .strict();

export type LoadError =
  | { kind: "malformed-json"; message: string }
  | { kind: "invalid-save"; issues: readonly string[] }
  | { kind: "unsupported-version"; version: number };

export type LoadResult =
  { ok: true; state: GameState } | { ok: false; error: LoadError };

function migrateEnvelope(envelope: SaveEnvelope): SaveEnvelope | undefined {
  let version = envelope.version;
  let state = envelope.state;
  if (version > CURRENT_GAME_VERSION) return undefined;
  while (version < CURRENT_GAME_VERSION) {
    const migration = SAVE_MIGRATIONS.get(version);
    if (migration === undefined) return undefined;
    state = migration(state);
    version += 1;
  }
  return { version, state };
}

export function serializeGame(state: GameState): string {
  assertGameState(state);
  return JSON.stringify({ version: CURRENT_GAME_VERSION, state });
}

export function loadGame(serialized: string): LoadResult {
  let input: unknown;
  try {
    input = JSON.parse(serialized);
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        kind: "malformed-json",
        message: error instanceof Error ? error.message : "Invalid JSON",
      },
    };
  }
  const envelopeResult = envelopeSchema.safeParse(input);
  if (!envelopeResult.success) {
    return {
      ok: false,
      error: {
        kind: "invalid-save",
        issues: envelopeResult.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      },
    };
  }
  let migrated: SaveEnvelope | undefined;
  try {
    migrated = migrateEnvelope(envelopeResult.data);
  } catch (error: unknown) {
    return {
      ok: false,
      error: {
        kind: "invalid-save",
        issues: [
          error instanceof Error ? error.message : "Save migration failed",
        ],
      },
    };
  }
  if (migrated === undefined) {
    return {
      ok: false,
      error: {
        kind: "unsupported-version",
        version: envelopeResult.data.version,
      },
    };
  }
  const stateResult = gameStateSchema.safeParse(migrated.state);
  if (!stateResult.success) {
    return {
      ok: false,
      error: {
        kind: "invalid-save",
        issues: stateResult.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      },
    };
  }
  try {
    assertGameState(stateResult.data);
  } catch (error: unknown) {
    if (error instanceof DomainInvariantError) {
      return {
        ok: false,
        error: { kind: "invalid-save", issues: [error.message] },
      };
    }
    throw error;
  }
  return { ok: true, state: stateResult.data };
}
