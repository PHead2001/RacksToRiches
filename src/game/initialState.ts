import { CURRENT_GAME_VERSION } from "./constants";
import { CUSTOMER_DEFINITIONS } from "./definitions";
import { assertFiniteNonNegative } from "./errors";
import { validateSeed } from "./random";
import type { GameState } from "./types";

export interface InitialStateOptions {
  seed?: number;
  startedAt?: number;
}

export function createInitialState(
  options: InitialStateOptions = {},
): GameState {
  const seed = options.seed ?? 0x5eed1234;
  const startedAt = options.startedAt ?? 0;
  validateSeed(seed);
  assertFiniteNonNegative(startedAt, "startedAt");

  return {
    version: CURRENT_GAME_VERSION,
    clockSeconds: 0,
    rngSeed: seed,
    company: {
      name: "Racks to Riches Hosting",
      cash: 500,
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
      { id: "equipment-refurbished-1", definitionId: "refurbished-desktop" },
      { id: "equipment-router-1", definitionId: "consumer-router" },
      { id: "equipment-power-strip-1", definitionId: "power-strip" },
      { id: "equipment-desk-fan-1", definitionId: "desk-fan" },
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
          remainingSeconds: 180,
          totalDurationSeconds: 180,
          growthPotential: "high",
          customerTolerance: 45,
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
    progression: { completedMilestones: [], prestigeCurrency: 0 },
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
