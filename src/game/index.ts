export { advanceGame } from "./advanceGame";
export {
  BANKRUPTCY_THRESHOLD,
  CURRENT_GAME_VERSION,
  FULFILLMENT_EPSILON,
  MAXIMUM_SLA_BUFFER_SECONDS,
  MINIMUM_SLA_BUFFER_SECONDS,
  SLA_BUFFER_RATIO,
  STARTER_EQUIPMENT_INSTANCE_IDS,
  TUTORIAL_DURATION_SECONDS,
  VIOLATION_RECOVERY_RATE,
} from "./constants";
export { calculateAllRackCapacities, calculateRackCapacity } from "./capacity";
export {
  aggregateContractDemand,
  CAPABILITY_REQUIREMENT_KEYS,
  calculateServicePoolProjection,
  calculateSlaBufferSeconds,
  calculateContractPerformance,
  calculateFulfillment,
  revenueMultiplier,
  CONSUMABLE_RESOURCE_KEYS,
  validateContractRequirements,
} from "./contracts";
export type {
  ServicePoolCapabilityProjection,
  ServicePoolProjection,
  ServicePoolResourceProjection,
} from "./contracts";
export {
  calculateContractReadiness,
  calculateSlaBuffer,
} from "./contractStatus";
export type {
  ContractReadiness,
  ContractReadinessKind,
  SlaBuffer,
} from "./contractStatus";
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
  calculateResaleProceeds,
  sellEquipment,
  setEquipmentPower,
  stampLastSaved,
} from "./commands";
export type { GameCommandErrorCode, GameCommandResult } from "./commands";
export { DomainInvariantError } from "./errors";
export { createInitialState } from "./initialState";
export { gameStateSchema, loadGame, serializeGame } from "./persistence";
export type { LoadError, LoadResult, SaveMigration } from "./persistence";
export { placeEquipment, relocateEquipment } from "./placement";
export type {
  EquipmentTarget,
  PlacementErrorCode,
  PlacementResult,
} from "./placement";
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
export { evaluateBankruptcy, isTerminal } from "./terminal";
export type * from "./types";
