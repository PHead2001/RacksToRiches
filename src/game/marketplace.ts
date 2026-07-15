import { nextRandom, randomInteger } from "./random";
import type {
  ContractInstance,
  ContractRequirements,
  GameState,
  ServiceType,
} from "./types";

export const TUTORIAL_CONTRACT_ID = "contract-tutorial-1";
export const TUTORIAL_MILESTONE_ID = "tutorial-completed";
export const TUTORIAL_REPUTATION_REWARD = 10;
export const STARTER_MARKETPLACE_SIZE = 3;

const CUSTOMER_PREFIXES = ["Copper", "Fox", "Pixel", "Maple", "North"] as const;
const CUSTOMER_SUFFIXES = [
  "Workshop",
  "Games",
  "Garden",
  "Studio",
  "Club",
] as const;
const STARTER_SERVICES = [
  "website-hosting",
  "file-storage",
  "game-servers",
] as const satisfies readonly ServiceType[];

interface GeneratedOffer {
  offer: ContractInstance;
  seed: number;
}

function integer(seed: number, minimum: number, maximum: number) {
  return randomInteger(seed, minimum, maximum + 1);
}

export function generateStarterOffer(seed: number): GeneratedOffer {
  const serviceRoll = randomInteger(seed, 0, STARTER_SERVICES.length);
  const serviceType = STARTER_SERVICES[serviceRoll.value];
  if (serviceType === undefined) throw new Error("Starter service roll failed");
  const prefixRoll = randomInteger(
    serviceRoll.seed,
    0,
    CUSTOMER_PREFIXES.length,
  );
  const suffixRoll = randomInteger(
    prefixRoll.seed,
    0,
    CUSTOMER_SUFFIXES.length,
  );
  const durationRoll = integer(suffixRoll.seed, 180, 600);
  const toleranceRoll = integer(durationRoll.seed, 35, 75);
  let currentSeed = toleranceRoll.seed;
  let requirements: ContractRequirements;
  let baseRevenuePerSecond: number;

  if (serviceType === "website-hosting") {
    const compute = integer(currentSeed, 8, 22);
    const storage = integer(compute.seed, 2, 9);
    const bandwidth = integer(storage.seed, 5, 25);
    const reliability = integer(bandwidth.seed, 70, 84);
    currentSeed = reliability.seed;
    requirements = {
      compute: compute.value,
      storage: storage.value,
      bandwidth: bandwidth.value,
      reliability: reliability.value / 100,
    };
    baseRevenuePerSecond =
      (compute.value + storage.value + bandwidth.value) / 22;
  } else if (serviceType === "file-storage") {
    const storage = integer(currentSeed, 18, 70);
    const bandwidth = integer(storage.seed, 5, 20);
    const reliability = integer(bandwidth.seed, 72, 86);
    currentSeed = reliability.seed;
    requirements = {
      storage: storage.value,
      bandwidth: bandwidth.value,
      reliability: reliability.value / 100,
    };
    baseRevenuePerSecond = (storage.value + bandwidth.value) / 24;
  } else {
    const compute = integer(currentSeed, 10, 32);
    const bandwidth = integer(compute.seed, 8, 28);
    const reliability = integer(bandwidth.seed, 70, 84);
    currentSeed = reliability.seed;
    requirements = {
      compute: compute.value,
      bandwidth: bandwidth.value,
      reliability: reliability.value / 100,
    };
    baseRevenuePerSecond = (compute.value + bandwidth.value) / 18;
  }

  const finalRandom = nextRandom(currentSeed);
  const prefix = CUSTOMER_PREFIXES[prefixRoll.value];
  const suffix = CUSTOMER_SUFFIXES[suffixRoll.value];
  if (prefix === undefined || suffix === undefined)
    throw new Error("Starter customer roll failed");
  return {
    offer: {
      id: `contract-market-${currentSeed.toString(16)}`,
      customerId: `procedural-${prefix.toLowerCase()}-${suffix.toLowerCase()}`,
      serviceType,
      tier: 1,
      status: "offered",
      requirements,
      baseRevenuePerSecond: Math.max(
        0.75,
        Math.round((baseRevenuePerSecond + finalRandom.value) * 100) / 100,
      ),
      remainingSeconds: durationRoll.value,
      totalDurationSeconds: durationRoll.value,
      growthPotential: "low",
      customerTolerance: toleranceRoll.value,
      performanceScore: 0,
      violationSeconds: 0,
      autoRenew: false,
    },
    seed: finalRandom.seed,
  };
}

export function fillStarterMarketplace(state: GameState): GameState {
  if (!state.progression.completedMilestones.includes(TUTORIAL_MILESTONE_ID))
    return state;
  let seed = state.rngSeed;
  const offers = [...state.contracts.offers];
  const knownIds = new Set([
    ...offers.map(({ id }) => id),
    ...state.contracts.active.map(({ id }) => id),
  ]);
  while (offers.length < STARTER_MARKETPLACE_SIZE) {
    const generated = generateStarterOffer(seed);
    seed = generated.seed;
    if (knownIds.has(generated.offer.id)) continue;
    knownIds.add(generated.offer.id);
    offers.push(generated.offer);
  }
  return {
    ...state,
    rngSeed: seed,
    contracts: { ...state.contracts, offers },
  };
}
