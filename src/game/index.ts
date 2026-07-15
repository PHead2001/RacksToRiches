export { advanceGame } from "./advanceGame";
export { calculateAllRackCapacities, calculateRackCapacity } from "./capacity";
export {
  aggregateContractDemand,
  calculateContractPerformance,
  calculateFulfillment,
  revenueMultiplier,
  validateContractRequirements,
} from "./contracts";
export {
  CUSTOMER_DEFINITIONS,
  EQUIPMENT_DEFINITIONS,
  FACILITY_DEFINITIONS,
  RACK_DEFINITIONS,
  REPUTATION_TIERS,
  RESEARCH_DEFINITIONS,
  SERVICE_DEFINITIONS,
  collectDefinitionIssues,
  getEquipmentDefinition,
} from "./definitions";
export { calculateEconomyRate } from "./economy";
export {
  acceptContract,
  equipmentName,
  getUnlockedBedroomEquipment,
  moveEquipment,
  purchaseEquipment,
  rejectContractOffer,
  removeEquipment,
  setEquipmentPower,
  stampLastSaved,
} from "./commands";
export type { GameCommandErrorCode, GameCommandResult } from "./commands";
export { DomainInvariantError } from "./errors";
export { createInitialState } from "./initialState";
export { gameStateSchema, loadGame, serializeGame } from "./persistence";
export type { LoadError, LoadResult, SaveMigration } from "./persistence";
export { placeEquipment } from "./placement";
export type { PlacementErrorCode, PlacementResult } from "./placement";
export { nextRandom, randomInteger } from "./random";
export {
  STARTER_MARKETPLACE_SIZE,
  TUTORIAL_CONTRACT_ID,
  TUTORIAL_MILESTONE_ID,
  TUTORIAL_REPUTATION_REWARD,
  fillStarterMarketplace,
  generateStarterOffer,
} from "./marketplace";
export { assertGameState } from "./validation";
export type * from "./types";
