import { FULFILLMENT_EPSILON } from "./constants";
import {
  calculateServicePoolProjection,
  calculateSlaBufferSeconds,
} from "./contracts";
import { TUTORIAL_CONTRACT_ID } from "./marketplace";
import type { ServicePoolProjection } from "./contracts";
import type { ContractInstance, RackCapacity } from "./types";

export type ContractReadinessKind =
  | "ready"
  | "install-hardware"
  | "capacity-shortfall"
  | "active"
  | "sla-warning";

export interface ContractReadiness {
  kind: ContractReadinessKind;
  label:
    | "READY"
    | "INSTALL HARDWARE"
    | "CAPACITY SHORTFALL"
    | "ACTIVE"
    | "SLA WARNING";
  canAccept: boolean;
  explanation: string;
  fulfillment: number;
  projection: ServicePoolProjection;
}

export interface SlaBuffer {
  totalSeconds: number;
  consumedSeconds: number;
  remainingSeconds: number;
  state: "Healthy" | "Recovering" | "Warning" | "Breached";
}

export function calculateSlaBuffer(contract: ContractInstance): SlaBuffer {
  const totalSeconds = calculateSlaBufferSeconds(contract.totalDurationSeconds);
  const consumedSeconds = Math.min(
    totalSeconds,
    Math.max(0, contract.violationSeconds),
  );
  const remainingSeconds = Math.min(
    totalSeconds,
    Math.max(0, totalSeconds - consumedSeconds),
  );
  const state =
    remainingSeconds <= FULFILLMENT_EPSILON
      ? "Breached"
      : contract.performanceScore >= 1 - FULFILLMENT_EPSILON
        ? consumedSeconds > FULFILLMENT_EPSILON
          ? "Recovering"
          : "Healthy"
        : "Warning";
  return { totalSeconds, consumedSeconds, remainingSeconds, state };
}

export function calculateContractReadiness(
  contract: ContractInstance,
  capacity: RackCapacity,
  activeContracts: readonly ContractInstance[] = [],
  targetId = "rack-starter-1",
): ContractReadiness {
  const contractsForProjection =
    contract.status === "active" &&
    !activeContracts.some(({ id }) => id === contract.id)
      ? [...activeContracts, contract]
      : activeContracts;
  const projection = calculateServicePoolProjection(
    capacity,
    contractsForProjection,
    targetId,
    contract.status === "active" ? undefined : contract,
  );
  const fulfillment = projection.projectedFulfillment;
  if (contract.status === "active") {
    const healthy = fulfillment >= 1 - FULFILLMENT_EPSILON;
    return healthy
      ? {
          kind: "active",
          label: "ACTIVE",
          canAccept: false,
          explanation:
            "The shared rack service pool currently meets aggregate contract demand.",
          fulfillment,
          projection,
        }
      : {
          kind: "sla-warning",
          label: "SLA WARNING",
          canAccept: false,
          explanation:
            "The shared rack service pool is below aggregate contracted demand.",
          fulfillment,
          projection,
        };
  }

  if (projection.safe) {
    return {
      kind: "ready",
      label: "READY",
      canAccept: true,
      explanation:
        activeContracts.length === 0
          ? "The starter rack meets every current requirement."
          : "The offer remains fully supported after active contract reservations.",
      fulfillment,
      projection,
    };
  }
  const absent = projection.limitingResources.some(
    ({ key }) => capacity[key] <= FULFILLMENT_EPSILON,
  );
  const isTutorial = contract.id === TUTORIAL_CONTRACT_ID;
  const installHardware = isTutorial && absent;
  const shortage = projection.limitingResources
    .map(({ key, shortfall }) => `${key} +${shortfall.toFixed(2)}`)
    .join(", ");
  return {
    kind: installHardware ? "install-hardware" : "capacity-shortfall",
    label: installHardware ? "INSTALL HARDWARE" : "CAPACITY SHORTFALL",
    canAccept: false,
    explanation: installHardware
      ? `Install and power the starter hardware. Missing capacity: ${shortage}.`
      : `Active contracts have reserved part of this rack. Additional capacity required: ${shortage}.`,
    fulfillment,
    projection,
  };
}
