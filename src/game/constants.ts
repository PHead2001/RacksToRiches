export const CURRENT_GAME_VERSION = 3;
export const ELECTRICITY_COST_PER_WATT_SECOND = 0.000_01;
export const VIOLATION_RECOVERY_RATE = 0.5;
export const BANKRUPTCY_THRESHOLD = -10_000;
export const FULFILLMENT_EPSILON = 1e-9;
export const SLA_BUFFER_RATIO = 0.1;
export const MINIMUM_SLA_BUFFER_SECONDS = 5;
export const MAXIMUM_SLA_BUFFER_SECONDS = 45;
export const TUTORIAL_DURATION_SECONDS = 30;
export const STARTER_EQUIPMENT_INSTANCE_IDS = [
  "equipment-refurbished-1",
  "equipment-router-1",
  "equipment-power-strip-1",
  "equipment-desk-fan-1",
] as const;
