import { FULFILLMENT_EPSILON } from "./constants";
import { calculateFulfillment } from "./contracts";
import { TUTORIAL_CONTRACT_ID } from "./marketplace";
import type { ContractInstance, RackCapacity, RequirementKey } from "./types";

const REQUIREMENT_KEYS: readonly RequirementKey[] = [
  "compute",
  "gpuCompute",
  "storage",
  "bandwidth",
  "reliability",
  "security",
];

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
}

export interface SlaBuffer {
  totalSeconds: number;
  consumedSeconds: number;
  remainingSeconds: number;
  state: "Healthy" | "Recovering" | "Warning" | "Breached";
}

export function calculateSlaBuffer(contract: ContractInstance): SlaBuffer {
  const totalSeconds = contract.customerTolerance;
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
): ContractReadiness {
  const fulfillment = calculateFulfillment(capacity, contract.requirements);
  if (contract.status === "active") {
    const healthy = fulfillment >= 1 - FULFILLMENT_EPSILON;
    return healthy
      ? {
          kind: "active",
          label: "ACTIVE",
          canAccept: false,
          explanation: "The assigned rack currently meets contract demand.",
          fulfillment,
        }
      : {
          kind: "sla-warning",
          label: "SLA WARNING",
          canAccept: false,
          explanation: "Current rack output is below the contracted demand.",
          fulfillment,
        };
  }

  const missing = REQUIREMENT_KEYS.filter((key) => {
    const required = contract.requirements[key];
    return (
      required !== undefined &&
      required > 0 &&
      capacity[key] < required - FULFILLMENT_EPSILON
    );
  });
  if (missing.length === 0) {
    return {
      kind: "ready",
      label: "READY",
      canAccept: true,
      explanation: "The starter rack meets every current requirement.",
      fulfillment,
    };
  }
  const absent = missing.some((key) => capacity[key] <= FULFILLMENT_EPSILON);
  const isTutorial = contract.id === TUTORIAL_CONTRACT_ID;
  const label = absent ? "INSTALL HARDWARE" : "CAPACITY SHORTFALL";
  return {
    kind: absent ? "install-hardware" : "capacity-shortfall",
    label,
    canAccept: !isTutorial,
    explanation: `${isTutorial ? "Install and power the starter hardware" : "Rack output is below this offer"}: ${missing.join(", ")}.`,
    fulfillment,
  };
}
