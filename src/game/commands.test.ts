import { describe, expect, it } from "vitest";

import {
  acceptContract,
  createInitialState,
  equipmentName,
  fillStarterMarketplace,
  generateStarterOffer,
  getUnlockedBedroomEquipment,
  moveEquipment,
  placeEquipment,
  purchaseEquipment,
  rejectContractOffer,
  removeEquipment,
  setEquipmentPower,
  stampLastSaved,
  TUTORIAL_MILESTONE_ID,
} from ".";

describe("Phase 2 domain commands", () => {
  it("creates independent named initial states", () => {
    const first = createInitialState({
      companyName: "  Fox Rack  ",
      seed: 7,
      startedAt: 9,
    });
    const second = createInitialState({
      companyName: "Other",
      seed: 7,
      startedAt: 9,
    });
    expect(first.company.name).toBe("Fox Rack");
    first.inventory.pop();
    expect(second.inventory).toHaveLength(4);
    expect(() => createInitialState({ companyName: "   " })).toThrow(
      /Company name/,
    );
  });

  it("installs, powers, moves, and removes equipment without mutating input", () => {
    const initial = createInitialState();
    const placed = placeEquipment(
      initial,
      "equipment-router-1",
      "rack-starter-1",
      0,
    );
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(initial.inventory).toHaveLength(4);
    const powered = setEquipmentPower(
      placed.state,
      "equipment-router-1",
      false,
    );
    expect(powered.ok).toBe(true);
    if (!powered.ok) return;
    const moved = moveEquipment(
      powered.state,
      "equipment-router-1",
      "rack-starter-1",
      4,
    );
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.state.facilities[0]?.racks[0]?.equipment[0]).toMatchObject({
      startUnit: 4,
      poweredOn: false,
    });
    const removed = removeEquipment(moved.state, "equipment-router-1");
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(
      removed.state.inventory.some(({ id }) => id === "equipment-router-1"),
    ).toBe(true);
    expect(removeEquipment(initial, "missing")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(setEquipmentPower(initial, "missing", true)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("purchases atomically and rejects unavailable products", () => {
    const initial = createInitialState({ seed: 42 });
    const purchased = purchaseEquipment(initial, "used-2u-compute");
    expect(purchased.ok).toBe(true);
    if (!purchased.ok) return;
    expect(purchased.state.company.cash).toBeLessThan(initial.company.cash);
    expect(purchased.state.inventory).toHaveLength(
      initial.inventory.length + 1,
    );
    expect(initial.company.cash).toBe(500);
    expect(
      purchaseEquipment(
        { ...initial, company: { ...initial.company, cash: 0 } },
        "used-2u-compute",
      ),
    ).toMatchObject({ ok: false, error: { code: "INSUFFICIENT_CASH" } });
    expect(purchaseEquipment(initial, "missing")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(purchaseEquipment(initial, "modern-1u-compute")).toMatchObject({
      ok: false,
      error: { code: "LOCKED" },
    });
    expect(
      getUnlockedBedroomEquipment().some(
        ({ id }) => id === "modern-1u-compute",
      ),
    ).toBe(false);
    expect(equipmentName("consumer-router")).toBe("Consumer router");
  });

  it("keeps the tutorial recoverable and assigns accepted contracts", () => {
    const initial = createInitialState();
    expect(rejectContractOffer(initial, "contract-tutorial-1")).toMatchObject({
      ok: false,
      error: { code: "TUTORIAL_REQUIRED" },
    });
    const accepted = acceptContract(
      initial,
      "contract-tutorial-1",
      "rack-starter-1",
    );
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.state.contracts.active[0]).toMatchObject({
      status: "active",
      assignedTargetId: "rack-starter-1",
    });
    expect(
      acceptContract(initial, "contract-tutorial-1", "missing"),
    ).toMatchObject({ ok: false, error: { code: "INVALID_TARGET" } });
    expect(acceptContract(initial, "missing", "rack-starter-1")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(rejectContractOffer(initial, "missing")).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });

  it("generates and refreshes exactly three deterministic starter offers", () => {
    expect(generateStarterOffer(123)).toEqual(generateStarterOffer(123));
    const initial = createInitialState({ seed: 123 });
    expect(fillStarterMarketplace(initial)).toBe(initial);
    const unlocked = fillStarterMarketplace({
      ...initial,
      progression: {
        ...initial.progression,
        completedMilestones: [TUTORIAL_MILESTONE_ID],
      },
      contracts: { ...initial.contracts, offers: [] },
    });
    expect(unlocked.contracts.offers).toHaveLength(3);
    expect(
      unlocked.contracts.offers.every(({ requirements }) =>
        Object.values(requirements).some(
          (value) => value !== undefined && value > 0,
        ),
      ),
    ).toBe(true);
    const rejected = rejectContractOffer(
      unlocked,
      unlocked.contracts.offers[0]?.id ?? "missing",
    );
    expect(rejected.ok).toBe(true);
    if (rejected.ok) expect(rejected.state.contracts.offers).toHaveLength(3);
    const serviceTypes = new Set(
      Array.from(
        { length: 80 },
        (_, seed) => generateStarterOffer(seed + 1).offer.serviceType,
      ),
    );
    expect(serviceTypes).toEqual(
      new Set(["website-hosting", "file-storage", "game-servers"]),
    );
  });

  it("validates save stamps", () => {
    const initial = createInitialState();
    expect(stampLastSaved(initial, 123).statistics.lastSavedAt).toBe(123);
    expect(() => stampLastSaved(initial, Number.NaN)).toThrow();
  });
});
