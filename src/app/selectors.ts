import {
  calculateAllRackCapacities,
  calculateContractPerformance,
  calculateEconomyRate,
  getEquipmentDefinition,
  revenueMultiplier,
} from "../game";
import type {
  ContractInstance,
  GameState,
  RackCapacity,
  RequirementKey,
} from "../game";

export interface GameMetrics {
  capacity: RackCapacity;
  grossRevenuePerSecond: number;
  netIncomePerSecond: number;
  performance: ReadonlyMap<string, number>;
}

export interface ResourceFulfillment {
  key: RequirementKey;
  required: number;
  available: number;
  ratio: number;
}

const REQUIREMENT_KEYS: readonly RequirementKey[] = [
  "compute",
  "gpuCompute",
  "storage",
  "bandwidth",
  "reliability",
  "security",
];

const EMPTY_CAPACITY: RackCapacity = {
  compute: 0,
  gpuCompute: 0,
  storage: 0,
  bandwidth: 0,
  security: 0,
  reliability: 1,
  raw: { compute: 0, gpuCompute: 0, storage: 0, bandwidth: 0 },
  powerDraw: 0,
  availablePower: 0,
  powerEfficiency: 1,
  heatOutput: 0,
  availableCooling: 0,
  thermalEfficiency: 1,
  usedRackUnits: 0,
};

export function selectGameMetrics(state: GameState): GameMetrics {
  const capacities = calculateAllRackCapacities(state);
  const capacity = capacities.get("rack-starter-1") ?? EMPTY_CAPACITY;
  const economy = calculateEconomyRate(state);
  return {
    capacity,
    grossRevenuePerSecond: economy.grossRevenuePerSecond,
    netIncomePerSecond: economy.netIncomePerSecond,
    performance: calculateContractPerformance(
      state.contracts.active,
      capacities,
    ),
  };
}

export function contractActualRevenue(
  contract: ContractInstance,
  performance: number,
): number {
  return contract.baseRevenuePerSecond * revenueMultiplier(performance);
}

export function selectResourceFulfillment(
  capacity: RackCapacity,
  contract: ContractInstance,
): readonly ResourceFulfillment[] {
  return REQUIREMENT_KEYS.flatMap((key) => {
    const required = contract.requirements[key];
    if (required === undefined || required === 0) return [];
    const available = capacity[key];
    return [{ key, required, available, ratio: available / required }];
  });
}

export function formatMoney(value: number, compact: boolean): string {
  if (!compact || Math.abs(value) < 1_000)
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  const units = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ] as const;
  const unit = units.find(([threshold]) => Math.abs(value) >= threshold);
  if (unit === undefined) return `$${value.toFixed(2)}`;
  return `$${(value / unit[0]).toFixed(2)}${unit[1]}`;
}

export function formatDuration(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${String(minutes)}:${String(remainder).padStart(2, "0")}`;
}

export function formatRequirement(key: RequirementKey, value: number): string {
  if (key === "reliability") return `${(value * 100).toFixed(0)}% reliability`;
  if (key === "bandwidth") return `${String(value)} Mbps bandwidth`;
  return `${String(value)} ${key.replace("gpuCompute", "GPU")}`;
}

export function equipmentLabel(definitionId: string): string {
  return getEquipmentDefinition(definitionId).name;
}

export function contractCustomerName(contract: ContractInstance): string {
  if (contract.customerId === "gravys-garden") return "Gravy's Garden Blog";
  return contract.customerId
    .replace("procedural-", "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
