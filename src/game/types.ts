export type ResourceKey = "compute" | "gpuCompute" | "storage" | "bandwidth";
export type RequirementKey = ResourceKey | "reliability" | "security";
export type EquipmentCategory =
  "compute" | "gpu" | "storage" | "network" | "power" | "cooling" | "security";
export type ServiceType =
  "website-hosting" | "file-storage" | "backup-hosting" | "game-servers";
export type ReputationTierId =
  "bedroom-host" | "local-provider" | "regional-provider";
export type ResearchBranch =
  "hardware" | "infrastructure" | "services" | "automation";

export interface ResourceVector {
  compute: number;
  gpuCompute: number;
  storage: number;
  bandwidth: number;
}

export interface ContractRequirements {
  compute?: number | undefined;
  gpuCompute?: number | undefined;
  storage?: number | undefined;
  bandwidth?: number | undefined;
  reliability?: number | undefined;
  security?: number | undefined;
}

export interface EquipmentDefinition {
  id: string;
  name: string;
  category: EquipmentCategory;
  generation: number;
  rackUnits: number;
  purchaseCost: number;
  resaleRatio: number;
  powerDraw: number;
  heatOutput: number;
  compute?: number;
  gpuCompute?: number;
  storage?: number;
  bandwidth?: number;
  cooling?: number;
  powerCapacity?: number;
  reliability: number;
  security?: number;
  requiredResearch?: string;
  requiredReputationTier?: ReputationTierId;
  tags: readonly string[];
}

export interface RackDefinition {
  id: string;
  name: string;
  rackUnits: number;
  maximumPower: number;
  airflowModifier: number;
  reliabilityModifier: number;
  purchaseCost: number;
  supportedCategories: readonly EquipmentCategory[];
  supportedEquipmentTags: readonly string[];
  requiredFacilityIds: readonly string[];
}

export interface FacilityDefinition {
  id: string;
  name: string;
  maximumRacks: number;
  powerCapacity: number;
  baseCooling: number;
  internetCapacity: number;
  rentPerSecond: number;
  reliabilityModifier: number;
  supportedRackIds: readonly string[];
  requiredReputationTier: ReputationTierId;
}

export interface ServiceDefinition {
  id: ServiceType;
  name: string;
  requiredResources: readonly RequirementKey[];
}

export interface ReputationTierDefinition {
  id: ReputationTierId;
  name: string;
  minimumReputation: number;
  maximumReputation?: number;
}

export interface ResearchDefinition {
  id: string;
  name: string;
  branch: ResearchBranch;
  cost: number;
  requiredReputationTier: ReputationTierId;
  prerequisiteIds: readonly string[];
}

export interface AnchorCustomerStage {
  stage: number;
  name: string;
  serviceType: ServiceType;
}

export interface CustomerDefinition {
  id: string;
  name: string;
  stages: readonly AnchorCustomerStage[];
}

export interface EquipmentInstance {
  id: string;
  definitionId: string;
}

export interface EquipmentPlacement extends EquipmentInstance {
  startUnit: number;
  poweredOn: boolean;
}

export interface RackInstance {
  id: string;
  definitionId: string;
  equipment: EquipmentPlacement[];
}

export interface FacilityInstance {
  id: string;
  definitionId: string;
  racks: RackInstance[];
}

export type ContractStatus =
  "offered" | "active" | "expiring" | "completed" | "breached" | "cancelled";

export interface ContractInstance {
  id: string;
  customerId: string;
  serviceType: ServiceType;
  tier: number;
  status: ContractStatus;
  assignedTargetId?: string | undefined;
  requirements: ContractRequirements;
  baseRevenuePerSecond: number;
  remainingSeconds: number;
  totalDurationSeconds: number;
  growthPotential: "none" | "low" | "medium" | "high";
  customerTolerance: number;
  performanceScore: number;
  violationSeconds: number;
  autoRenew: boolean;
}

export interface CustomerState {
  id: string;
  definitionId?: string | undefined;
  name: string;
  loyalty: number;
  currentStage: number;
}

export interface GameState {
  version: number;
  clockSeconds: number;
  rngSeed: number;
  company: {
    name: string;
    cash: number;
    reputation: number;
    researchPoints: number;
    lifetimeRevenue: number;
    lifetimeExpenses: number;
    currentTier: ReputationTierId;
  };
  facilities: FacilityInstance[];
  activeFacilityId: string;
  inventory: EquipmentInstance[];
  contracts: {
    offers: ContractInstance[];
    active: ContractInstance[];
    completedCount: number;
  };
  customers: CustomerState[];
  research: {
    unlockedNodeIds: string[];
  };
  progression: {
    completedMilestones: string[];
    prestigeCurrency: number;
  };
  statistics: {
    startedAt: number;
    lastSavedAt: number;
    totalOnlineSeconds: number;
    totalOfflineSeconds: number;
    contractsCompleted: number;
    contractsBreached: number;
    highestIncomePerSecond: number;
  };
  settings: {
    soundEnabled: boolean;
    reducedMotion: boolean;
    compactNumbers: boolean;
    autosaveEnabled: boolean;
  };
}

export interface RackCapacity extends ResourceVector {
  security: number;
  reliability: number;
  raw: ResourceVector;
  powerDraw: number;
  availablePower: number;
  powerEfficiency: number;
  heatOutput: number;
  availableCooling: number;
  thermalEfficiency: number;
  usedRackUnits: number;
}

export interface EconomyRate {
  grossRevenuePerSecond: number;
  electricityPerSecond: number;
  rentPerSecond: number;
  netIncomePerSecond: number;
}
