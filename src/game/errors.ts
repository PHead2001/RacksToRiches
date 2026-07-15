export type DomainErrorCode =
  | "INVALID_NUMBER"
  | "UNKNOWN_DEFINITION"
  | "INVALID_CONTRACT"
  | "DUPLICATE_INSTANCE"
  | "RACK_OVERFLOW"
  | "EQUIPMENT_OVERLAP"
  | "INCOMPATIBLE_EQUIPMENT"
  | "INVALID_STATE";

export class DomainInvariantError extends Error {
  override readonly name = "DomainInvariantError";

  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainInvariantError(
      "INVALID_NUMBER",
      `${label} must be a finite non-negative number`,
    );
  }
}

export function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new DomainInvariantError(
      "INVALID_NUMBER",
      `${label} must be a finite number`,
    );
  }
}

export function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainInvariantError(
      "INVALID_NUMBER",
      `${label} must be a finite positive number`,
    );
  }
}

export function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    throw new DomainInvariantError(
      "INVALID_NUMBER",
      "Cannot clamp a non-finite value",
    );
  }
  return Math.min(maximum, Math.max(minimum, value));
}
