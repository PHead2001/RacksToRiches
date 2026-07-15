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
  relocateEquipment,
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
    const base = createInitialState({ seed: 42 });
    const initial = { ...base, company: { ...base.company, cash: 500 } };
    const purchased = purchaseEquipment(initial, "used-2u-compute");
    expect(purchased.ok).toBe(true);
    if (!purchased.ok) return;
    expect(purchased.state.company.cash).toBeLessThan(initial.company.cash);
    expect(purchased.state.inventory).toHaveLength(
      initial.inventory.length + 1,
    );
    expect(base.company.cash).toBe(0);
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
    let ready = initial;
    for (const [id, unit] of [
      ["equipment-refurbished-1", 0],
      ["equipment-router-1", 4],
      ["equipment-power-strip-1", 5],
      ["equipment-desk-fan-1", 6],
    ] as const) {
      const placed = placeEquipment(ready, id, "rack-starter-1", unit);
      if (!placed.ok) throw new Error(placed.error.message);
      ready = placed.state;
    }
    const accepted = acceptContract(
      ready,
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

  it("anchors large items at the top edge and reflows obstruction deterministically", () => {
    const initial = createInitialState();
    const top = relocateEquipment(initial, "equipment-refurbished-1", {
      kind: "rack",
      rackId: "rack-starter-1",
      anchorUnit: 11,
    });
    expect(top).toMatchObject({
      ok: true,
      placement: { startUnit: 8 },
      reflowed: false,
    });

    let obstructed = createInitialState();
    for (const [id, anchor] of [
      ["equipment-router-1", 6],
      ["equipment-power-strip-1", 7],
      ["equipment-desk-fan-1", 8],
    ] as const) {
      const placed = relocateEquipment(obstructed, id, {
        kind: "rack",
        rackId: "rack-starter-1",
        anchorUnit: anchor,
      });
      if (!placed.ok) throw new Error(placed.error.message);
      obstructed = placed.state;
    }
    const snapshot = structuredClone(obstructed);
    const reflowed = relocateEquipment(obstructed, "equipment-refurbished-1", {
      kind: "rack",
      rackId: "rack-starter-1",
      anchorUnit: 11,
    });
    expect(reflowed.ok).toBe(true);
    if (!reflowed.ok) return;
    expect(reflowed.reflowed).toBe(true);
    expect(reflowed.placement?.startUnit).toBe(8);
    expect(obstructed).toEqual(snapshot);
    const equipment = reflowed.state.facilities[0]?.racks[0]?.equipment ?? [];
    expect(equipment.slice(0, 3).map(({ id }) => id)).toEqual([
      "equipment-router-1",
      "equipment-power-strip-1",
      "equipment-desk-fan-1",
    ]);
  });

  it("preserves power and fails atomically when total rack capacity is exceeded", () => {
    let state = createInitialState();
    const installed = relocateEquipment(state, "equipment-refurbished-1", {
      kind: "rack",
      rackId: "rack-starter-1",
      anchorUnit: 0,
    });
    if (!installed.ok) throw new Error(installed.error.message);
    const powered = setEquipmentPower(
      installed.state,
      "equipment-refurbished-1",
      false,
    );
    if (!powered.ok) throw new Error(powered.error.message);
    const moved = relocateEquipment(powered.state, "equipment-refurbished-1", {
      kind: "rack",
      rackId: "rack-starter-1",
      anchorUnit: 11,
    });
    expect(moved.ok && moved.placement?.poweredOn).toBe(false);

    state = createInitialState();
    const rack = state.facilities[0]?.racks[0];
    if (rack === undefined) throw new Error("fixture");
    rack.equipment = Array.from({ length: 6 }, (_, index) => ({
      id: `full-${String(index)}`,
      definitionId: "used-2u-compute",
      startUnit: index * 2,
      poweredOn: index % 2 === 0,
    }));
    const before = structuredClone(state);
    const failed = relocateEquipment(state, "equipment-router-1", {
      kind: "rack",
      rackId: "rack-starter-1",
      anchorUnit: 11,
    });
    expect(failed).toMatchObject({
      ok: false,
      error: { code: "CAPACITY_EXCEEDED" },
    });
    expect(state).toEqual(before);
  });

  it("returns typed relocation failures without corrupting equipment", () => {
    const initial = createInitialState();
    const rackTarget = {
      kind: "rack" as const,
      rackId: "rack-starter-1",
      anchorUnit: 0,
    };
    expect(relocateEquipment(initial, "missing", rackTarget)).toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_EQUIPMENT_INSTANCE" },
    });
    expect(
      relocateEquipment(initial, "equipment-router-1", { kind: "inventory" }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_TARGET" } });
    expect(
      relocateEquipment(initial, "equipment-router-1", {
        ...rackTarget,
        rackId: "missing",
      }),
    ).toMatchObject({ ok: false, error: { code: "UNKNOWN_RACK" } });
    expect(
      relocateEquipment(initial, "equipment-router-1", {
        ...rackTarget,
        anchorUnit: -1,
      }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_START_UNIT" } });

    const first = initial.inventory[0];
    if (first === undefined) throw new Error("starter inventory missing");
    const duplicate = {
      ...initial,
      inventory: [...initial.inventory, { ...first }],
    };
    expect(
      relocateEquipment(duplicate, "equipment-router-1", rackTarget),
    ).toMatchObject({ ok: false, error: { code: "DUPLICATE_INSTANCE" } });

    const unknownDefinition = {
      ...initial,
      inventory: initial.inventory.map((item) =>
        item.id === "equipment-router-1"
          ? { ...item, definitionId: "missing" }
          : item,
      ),
    };
    expect(
      relocateEquipment(unknownDefinition, "equipment-router-1", rackTarget),
    ).toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_EQUIPMENT_DEFINITION" },
    });

    const terminal = {
      ...initial,
      progression: {
        ...initial.progression,
        terminalState: {
          kind: "tutorial-failed" as const,
          occurredAtSeconds: 0,
        },
      },
    };
    expect(
      relocateEquipment(terminal, "equipment-router-1", rackTarget),
    ).toMatchObject({ ok: false, error: { code: "TERMINAL_STATE" } });
    expect(initial.inventory).toHaveLength(4);
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
