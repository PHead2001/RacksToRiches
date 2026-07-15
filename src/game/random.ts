import { DomainInvariantError } from "./errors";

const UINT32_RANGE = 4_294_967_296;

export interface RandomResult {
  value: number;
  seed: number;
}

export function validateSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed >= UINT32_RANGE) {
    throw new DomainInvariantError(
      "INVALID_NUMBER",
      "Random seed must be an unsigned 32-bit integer",
    );
  }
}

export function nextRandom(seed: number): RandomResult {
  validateSeed(seed);
  const nextSeed = (seed + 0x6d2b79f5) >>> 0;
  let value = nextSeed;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return {
    value: ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE,
    seed: nextSeed,
  };
}

export function randomInteger(
  seed: number,
  minimumInclusive: number,
  maximumExclusive: number,
): RandomResult {
  if (
    !Number.isInteger(minimumInclusive) ||
    !Number.isInteger(maximumExclusive) ||
    maximumExclusive <= minimumInclusive
  ) {
    throw new DomainInvariantError(
      "INVALID_NUMBER",
      "Random integer bounds must be ordered integers",
    );
  }
  const result = nextRandom(seed);
  return {
    value:
      minimumInclusive +
      Math.floor(result.value * (maximumExclusive - minimumInclusive)),
    seed: result.seed,
  };
}
