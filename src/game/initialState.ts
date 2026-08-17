import { CURRENT_GAME_VERSION, TUTORIAL_DURATION_SECONDS } from "./constants";
import { calculateSlaBufferSeconds } from "./contracts";
import { CUSTOMER_DEFINITIONS } from "./definitions";
import { assertFiniteNonNegative } from "./errors";
import { DomainInvariantError } from "./errors";
import { validateSeed } from "./random";
import type { GameState } from "./types";

export interface InitialStateOptions {
  seed?: number;
  startedAt?: number;
  companyName?: string;
}

export function createInitialState(
  options: InitialStateOptions = {},
): GameState {
  const seed = options.seed ?? 0x5eed1234;
  const startedAt = options.startedAt ?? 0;
  const companyName = options.companyName?.trim() ?? "Racks to Riches Hosting";
  validateSeed(seed);
  assertFiniteNonNegative(startedAt, "startedAt");
  if (companyName.length === 0 || companyName.length > 60) {
    throw new DomainInvariantError(
      "INVALID_STATE",
      "Company name must contain between 1 and 60 characters",
    );
  }

  return {
    version: CURRENT_GAME_VERSION,
    clockSeconds: 0,
    rngSeed: seed,
    company: {
      name: companyName,
      cash: 0,
      reputation: 0,
      researchPoints: 0,
      lifetimeRevenue: 0,
      lifetimeExpenses: 0,
      currentTier: "bedroom-host",
    },
    facilities: [
      {
        id: "facility-bedroom-1",
        definitionId: "bedroom",
        racks: [
          {
            id: "rack-starter-1",
            definitionId: "starter-12u",
            equipment: [],
          },
        ],
      },
    ],
    activeFacilityId: "facility-bedroom-1",
    inventory: [
      {
        id: "equipment-refurbished-1",
        definitionId: "refurbished-desktop",
        acquisitionPrice: 0,
      },
      {
        id: "equipment-router-1",
        definitionId: "consumer-router",
        acquisitionPrice: 0,
      },
      {
        id: "equipment-power-strip-1",
        definitionId: "power-strip",
        acquisitionPrice: 0,
      },
      {
        id: "equipment-desk-fan-1",
        definitionId: "desk-fan",
        acquisitionPrice: 0,
      },
    ],
    contracts: {
      offers: [
        {
          id: "contract-tutorial-1",
          customerId: "gravys-garden",
          serviceType: "website-hosting",
          tier: 1,
          status: "offered",
          requirements: {
            compute: 20,
            storage: 5,
            bandwidth: 10,
            reliability: 0.8,
          },
          baseRevenuePerSecond: 2,
          remainingSeconds: TUTORIAL_DURATION_SECONDS,
          totalDurationSeconds: TUTORIAL_DURATION_SECONDS,
          growthPotential: "high",
          customerTolerance: calculateSlaBufferSeconds(
            TUTORIAL_DURATION_SECONDS,
          ),
          performanceScore: 0,
          violationSeconds: 0,
          autoRenew: false,
        },
      ],
      active: [],
      completedCount: 0,
    },
    customers: CUSTOMER_DEFINITIONS.map((customer) => ({
      id: `customer-${customer.id}`,
      definitionId: customer.id,
      name: customer.name,
      loyalty: 0.5,
      currentStage: 1,
    })),
    research: { unlockedNodeIds: [] },
    progression: {
      completedMilestones: [],
      prestigeCurrency: 0,
      terminalState: null,
    },
    statistics: {
      startedAt,
      lastSavedAt: startedAt,
      totalOnlineSeconds: 0,
      totalOfflineSeconds: 0,
      contractsCompleted: 0,
      contractsBreached: 0,
      highestIncomePerSecond: 0,
    },
    settings: {
      soundEnabled: true,
      reducedMotion: false,
      compactNumbers: true,
      autosaveEnabled: true,
    },
  };
}
