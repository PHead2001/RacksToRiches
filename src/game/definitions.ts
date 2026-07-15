import { DomainInvariantError, assertFiniteNonNegative } from "./errors";
import type {
  CustomerDefinition,
  EquipmentDefinition,
  FacilityDefinition,
  RackDefinition,
  ReputationTierDefinition,
  ResearchDefinition,
  ServiceDefinition,
} from "./types";

export const EQUIPMENT_DEFINITIONS: readonly EquipmentDefinition[] = [
  {
    id: "refurbished-desktop",
    name: "Refurbished desktop server",
    category: "compute",
    generation: 1,
    rackUnits: 4,
    purchaseCost: 120,
    resaleRatio: 0.5,
    powerDraw: 180,
    heatOutput: 150,
    compute: 25,
    storage: 5,
    reliability: 0.86,
    tags: ["consumer", "general"],
  },
  {
    id: "used-2u-compute",
    name: "Used 2U compute server",
    category: "compute",
    generation: 1,
    rackUnits: 2,
    purchaseCost: 300,
    resaleRatio: 0.5,
    powerDraw: 260,
    heatOutput: 230,
    compute: 65,
    storage: 2,
    reliability: 0.9,
    tags: ["server", "compute"],
  },
  {
    id: "modern-1u-compute",
    name: "Modern 1U compute server",
    category: "compute",
    generation: 2,
    rackUnits: 1,
    purchaseCost: 750,
    resaleRatio: 0.6,
    powerDraw: 220,
    heatOutput: 185,
    compute: 120,
    storage: 2,
    reliability: 0.96,
    requiredResearch: "modern-hardware",
    requiredReputationTier: "local-provider",
    tags: ["server", "compute"],
  },
  {
    id: "basic-nas",
    name: "Basic NAS",
    category: "storage",
    generation: 1,
    rackUnits: 2,
    purchaseCost: 180,
    resaleRatio: 0.5,
    powerDraw: 70,
    heatOutput: 55,
    storage: 80,
    bandwidth: 20,
    reliability: 0.88,
    tags: ["storage"],
  },
  {
    id: "4u-storage-array",
    name: "4U storage array",
    category: "storage",
    generation: 2,
    rackUnits: 4,
    purchaseCost: 900,
    resaleRatio: 0.6,
    powerDraw: 300,
    heatOutput: 260,
    storage: 650,
    bandwidth: 100,
    reliability: 0.96,
    requiredResearch: "dense-storage",
    requiredReputationTier: "local-provider",
    tags: ["storage", "server"],
  },
  {
    id: "consumer-router",
    name: "Consumer router",
    category: "network",
    generation: 1,
    rackUnits: 1,
    purchaseCost: 45,
    resaleRatio: 0.4,
    powerDraw: 15,
    heatOutput: 12,
    bandwidth: 100,
    reliability: 0.87,
    tags: ["consumer", "network"],
  },
  {
    id: "gigabit-switch",
    name: "Gigabit switch",
    category: "network",
    generation: 1,
    rackUnits: 1,
    purchaseCost: 160,
    resaleRatio: 0.5,
    powerDraw: 35,
    heatOutput: 28,
    bandwidth: 1000,
    reliability: 0.94,
    tags: ["network"],
  },
  {
    id: "power-strip",
    name: "Power strip",
    category: "power",
    generation: 1,
    rackUnits: 1,
    purchaseCost: 35,
    resaleRatio: 0.4,
    powerDraw: 2,
    heatOutput: 1,
    powerCapacity: 900,
    reliability: 0.88,
    tags: ["power", "consumer"],
  },
  {
    id: "basic-ups",
    name: "Basic UPS",
    category: "power",
    generation: 1,
    rackUnits: 2,
    purchaseCost: 260,
    resaleRatio: 0.5,
    powerDraw: 12,
    heatOutput: 10,
    powerCapacity: 1800,
    reliability: 0.97,
    tags: ["power", "redundancy"],
  },
  {
    id: "desk-fan",
    name: "Desk fan",
    category: "cooling",
    generation: 1,
    rackUnits: 1,
    purchaseCost: 25,
    resaleRatio: 0.4,
    powerDraw: 30,
    heatOutput: 5,
    cooling: 140,
    reliability: 0.85,
    tags: ["cooling", "consumer"],
  },
  {
    id: "rack-fan-panel",
    name: "Rack fan panel",
    category: "cooling",
    generation: 1,
    rackUnits: 1,
    purchaseCost: 120,
    resaleRatio: 0.5,
    powerDraw: 55,
    heatOutput: 8,
    cooling: 400,
    reliability: 0.93,
    tags: ["cooling"],
  },
  {
    id: "portable-ac",
    name: "Portable air conditioner",
    category: "cooling",
    generation: 2,
    rackUnits: 4,
    purchaseCost: 650,
    resaleRatio: 0.5,
    powerDraw: 700,
    heatOutput: 30,
    cooling: 1800,
    reliability: 0.92,
    requiredReputationTier: "local-provider",
    tags: ["facility"],
  },
];

const ALL_CATEGORIES = [
  "compute",
  "gpu",
  "storage",
  "network",
  "power",
  "cooling",
  "security",
] as const;
const ALL_EQUIPMENT_TAGS = [
  "consumer",
  "general",
  "server",
  "compute",
  "storage",
  "network",
  "power",
  "redundancy",
  "cooling",
  "facility",
] as const;

export const RACK_DEFINITIONS: readonly RackDefinition[] = [
  {
    id: "starter-12u",
    name: "Starter 12U rack",
    rackUnits: 12,
    maximumPower: 1200,
    airflowModifier: 0.8,
    reliabilityModifier: -0.02,
    purchaseCost: 100,
    supportedCategories: ALL_CATEGORIES,
    supportedEquipmentTags: ALL_EQUIPMENT_TAGS.filter(
      (tag) => tag !== "facility",
    ),
    requiredFacilityIds: ["bedroom", "office-server-closet"],
  },
  {
    id: "standard-24u",
    name: "Standard 24U rack",
    rackUnits: 24,
    maximumPower: 4000,
    airflowModifier: 1,
    reliabilityModifier: 0,
    purchaseCost: 800,
    supportedCategories: ALL_CATEGORIES,
    supportedEquipmentTags: ALL_EQUIPMENT_TAGS,
    requiredFacilityIds: ["office-server-closet"],
  },
  {
    id: "standard-42u",
    name: "Standard 42U rack",
    rackUnits: 42,
    maximumPower: 8000,
    airflowModifier: 1.1,
    reliabilityModifier: 0.01,
    purchaseCost: 1800,
    supportedCategories: ALL_CATEGORIES,
    supportedEquipmentTags: ALL_EQUIPMENT_TAGS,
    requiredFacilityIds: ["office-server-closet"],
  },
];

export const FACILITY_DEFINITIONS: readonly FacilityDefinition[] = [
  {
    id: "bedroom",
    name: "Bedroom",
    maximumRacks: 1,
    powerCapacity: 1500,
    baseCooling: 180,
    internetCapacity: 100,
    rentPerSecond: 0,
    reliabilityModifier: -0.03,
    supportedRackIds: ["starter-12u"],
    requiredReputationTier: "bedroom-host",
  },
  {
    id: "office-server-closet",
    name: "Office server closet",
    maximumRacks: 4,
    powerCapacity: 12000,
    baseCooling: 3000,
    internetCapacity: 2000,
    rentPerSecond: 0.05,
    reliabilityModifier: 0.02,
    supportedRackIds: ["starter-12u", "standard-24u", "standard-42u"],
    requiredReputationTier: "local-provider",
  },
];

export const SERVICE_DEFINITIONS: readonly ServiceDefinition[] = [
  {
    id: "website-hosting",
    name: "Website hosting",
    requiredResources: ["compute", "storage", "bandwidth"],
  },
  {
    id: "file-storage",
    name: "File storage",
    requiredResources: ["storage", "bandwidth", "reliability"],
  },
  {
    id: "backup-hosting",
    name: "Backup hosting",
    requiredResources: ["storage", "bandwidth", "reliability"],
  },
  {
    id: "game-servers",
    name: "Game servers",
    requiredResources: ["compute", "bandwidth", "reliability"],
  },
];

export const REPUTATION_TIERS: readonly ReputationTierDefinition[] = [
  {
    id: "bedroom-host",
    name: "Bedroom Host",
    minimumReputation: 0,
    maximumReputation: 99,
  },
  {
    id: "local-provider",
    name: "Local Provider",
    minimumReputation: 100,
    maximumReputation: 499,
  },
  {
    id: "regional-provider",
    name: "Regional Provider",
    minimumReputation: 500,
  },
];

export const RESEARCH_DEFINITIONS: readonly ResearchDefinition[] = [
  {
    id: "modern-hardware",
    name: "Modern hardware",
    branch: "hardware",
    cost: 10,
    requiredReputationTier: "local-provider",
    prerequisiteIds: [],
  },
  {
    id: "dense-storage",
    name: "Dense storage",
    branch: "hardware",
    cost: 15,
    requiredReputationTier: "local-provider",
    prerequisiteIds: ["modern-hardware"],
  },
  {
    id: "standard-racks",
    name: "Standard racks",
    branch: "infrastructure",
    cost: 10,
    requiredReputationTier: "local-provider",
    prerequisiteIds: [],
  },
  {
    id: "managed-services",
    name: "Managed services",
    branch: "services",
    cost: 10,
    requiredReputationTier: "local-provider",
    prerequisiteIds: [],
  },
  {
    id: "auto-renewal",
    name: "Automatic renewal",
    branch: "automation",
    cost: 20,
    requiredReputationTier: "regional-provider",
    prerequisiteIds: ["managed-services"],
  },
];

export const CUSTOMER_DEFINITIONS: readonly CustomerDefinition[] = [
  {
    id: "gravys-garden",
    name: "Gravy's Garden",
    stages: [
      { stage: 1, name: "Garden blog", serviceType: "website-hosting" },
      { stage: 2, name: "Seed catalog", serviceType: "website-hosting" },
      { stage: 3, name: "Garden community", serviceType: "file-storage" },
      {
        stage: 4,
        name: "National gardening platform",
        serviceType: "backup-hosting",
      },
    ],
  },
  {
    id: "foxfire-studios",
    name: "Foxfire Studios",
    stages: [
      { stage: 1, name: "Portfolio website", serviceType: "website-hosting" },
      { stage: 2, name: "Asset storage", serviceType: "file-storage" },
      { stage: 3, name: "Creative platform", serviceType: "website-hosting" },
      { stage: 4, name: "Media infrastructure", serviceType: "backup-hosting" },
    ],
  },
  {
    id: "acorn-arcade",
    name: "Acorn Arcade",
    stages: [
      { stage: 1, name: "Private server", serviceType: "game-servers" },
      { stage: 2, name: "Community launch", serviceType: "game-servers" },
      { stage: 3, name: "Regional hosting", serviceType: "game-servers" },
      {
        stage: 4,
        name: "Live-service platform",
        serviceType: "backup-hosting",
      },
    ],
  },
];

function findById<T extends { id: string }>(
  definitions: readonly T[],
  id: string,
  kind: string,
): T {
  const definition = definitions.find((candidate) => candidate.id === id);
  if (definition === undefined) {
    throw new DomainInvariantError(
      "UNKNOWN_DEFINITION",
      `Unknown ${kind} definition: ${id}`,
    );
  }
  return definition;
}

export const getEquipmentDefinition = (id: string): EquipmentDefinition =>
  findById(EQUIPMENT_DEFINITIONS, id, "equipment");
export const getRackDefinition = (id: string): RackDefinition =>
  findById(RACK_DEFINITIONS, id, "rack");
export const getFacilityDefinition = (id: string): FacilityDefinition =>
  findById(FACILITY_DEFINITIONS, id, "facility");

function duplicateIds(
  definitions: readonly { id: string }[],
  label: string,
): string[] {
  const seen = new Set<string>();
  const issues: string[] = [];
  for (const definition of definitions) {
    if (seen.has(definition.id))
      issues.push(`Duplicate ${label} id: ${definition.id}`);
    seen.add(definition.id);
  }
  return issues;
}

export function collectDefinitionIssues(): string[] {
  const issues = [
    ...duplicateIds(EQUIPMENT_DEFINITIONS, "equipment"),
    ...duplicateIds(RACK_DEFINITIONS, "rack"),
    ...duplicateIds(FACILITY_DEFINITIONS, "facility"),
    ...duplicateIds(SERVICE_DEFINITIONS, "service"),
    ...duplicateIds(REPUTATION_TIERS, "reputation tier"),
    ...duplicateIds(RESEARCH_DEFINITIONS, "research"),
    ...duplicateIds(CUSTOMER_DEFINITIONS, "customer"),
  ];
  const researchIds = new Set(RESEARCH_DEFINITIONS.map(({ id }) => id));
  const tierIds = new Set(REPUTATION_TIERS.map(({ id }) => id));
  const rackIds = new Set(RACK_DEFINITIONS.map(({ id }) => id));
  const facilityIds = new Set(FACILITY_DEFINITIONS.map(({ id }) => id));
  for (const equipment of EQUIPMENT_DEFINITIONS) {
    for (const [label, value] of [
      ["rackUnits", equipment.rackUnits],
      ["purchaseCost", equipment.purchaseCost],
      ["powerDraw", equipment.powerDraw],
      ["heatOutput", equipment.heatOutput],
      ["reliability", equipment.reliability],
    ] as const) {
      try {
        assertFiniteNonNegative(value, `${equipment.id}.${label}`);
      } catch (error: unknown) {
        issues.push(
          error instanceof Error
            ? error.message
            : `Invalid ${equipment.id}.${label}`,
        );
      }
    }
    if (equipment.resaleRatio < 0.4 || equipment.resaleRatio > 0.7)
      issues.push(`${equipment.id} has an illegal resale ratio`);
    if (
      equipment.requiredResearch !== undefined &&
      !researchIds.has(equipment.requiredResearch)
    )
      issues.push(`${equipment.id} references unknown research`);
    if (
      equipment.requiredReputationTier !== undefined &&
      !tierIds.has(equipment.requiredReputationTier)
    )
      issues.push(`${equipment.id} references unknown reputation tier`);
  }
  for (const rack of RACK_DEFINITIONS)
    for (const facilityId of rack.requiredFacilityIds)
      if (!facilityIds.has(facilityId))
        issues.push(`${rack.id} references unknown facility`);
  for (const facility of FACILITY_DEFINITIONS)
    for (const rackId of facility.supportedRackIds)
      if (!rackIds.has(rackId))
        issues.push(`${facility.id} references unknown rack`);
  for (const research of RESEARCH_DEFINITIONS)
    for (const prerequisiteId of research.prerequisiteIds)
      if (!researchIds.has(prerequisiteId))
        issues.push(`${research.id} references unknown prerequisite`);
  for (const customer of CUSTOMER_DEFINITIONS)
    if (customer.stages.length !== 4)
      issues.push(`${customer.id} must have four stages`);
  return issues;
}
