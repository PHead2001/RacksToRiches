import { describe, expect, it } from "vitest";

import { DomainInvariantError } from "./errors";
import { createInitialState } from "./initialState";
import {
  SAVE_MIGRATIONS,
  gameStateSchema,
  loadGame,
  serializeGame,
} from "./persistence";
import { placeEquipment } from "./placement";
import { assertGameState } from "./validation";

describe("versioned persistence", () => {
  it("round-trips a valid save", () => {
    const state = createInitialState({ seed: 123, startedAt: 456 });
    expect(loadGame(serializeGame(state))).toEqual({ ok: true, state });
    expect(SAVE_MIGRATIONS.size).toBe(0);
  });

  it("returns typed errors for malformed JSON, bad envelopes, and unsupported versions", () => {
    expect(loadGame("{")).toMatchObject({
      ok: false,
      error: { kind: "malformed-json" },
    });
    expect(loadGame("{}")).toMatchObject({
      ok: false,
      error: { kind: "invalid-save" },
    });
    expect(loadGame(JSON.stringify({ version: 99, state: {} }))).toEqual({
      ok: false,
      error: { kind: "unsupported-version", version: 99 },
    });
    expect(loadGame(JSON.stringify({ version: 0, state: {} }))).toEqual({
      ok: false,
      error: { kind: "unsupported-version", version: 0 },
    });
  });

  it("rejects unknown IDs, duplicate instances, overlap, and extra fields", () => {
    const serialized = serializeGame(createInitialState());
    expect(
      loadGame(
        serialized.replace(
          '"definitionId":"bedroom"',
          '"definitionId":"moon-base"',
        ),
      ),
    ).toMatchObject({ ok: false, error: { kind: "invalid-save" } });
    expect(
      loadGame(
        serialized.replace("equipment-router-1", "equipment-refurbished-1"),
      ),
    ).toMatchObject({ ok: false, error: { kind: "invalid-save" } });

    let equipped = createInitialState();
    for (const [id, unit] of [
      ["equipment-refurbished-1", 0],
      ["equipment-router-1", 4],
    ] as const) {
      const result = placeEquipment(equipped, id, "rack-starter-1", unit);
      if (!result.ok) throw new Error(result.error.message);
      equipped = result.state;
    }
    expect(
      loadGame(
        serializeGame(equipped).replace('"startUnit":4', '"startUnit":2'),
      ),
    ).toMatchObject({ ok: false, error: { kind: "invalid-save" } });

    const extraFieldSave = serialized.replace(
      '"state":{',
      '"state":{"surprise":true,',
    );
    expect(loadGame(extraFieldSave)).toMatchObject({
      ok: false,
      error: { kind: "invalid-save" },
    });
    expect(gameStateSchema.safeParse({}).success).toBe(false);
  });
});

describe("state invariants", () => {
  it("rejects invalid active targets and unknown research", () => {
    const state = createInitialState();
    const offer = state.contracts.offers[0];
    if (offer === undefined) throw new Error("fixture");
    state.contracts.active = [
      { ...offer, status: "active", assignedTargetId: "missing" },
    ];
    state.contracts.offers = [];
    expect(() => {
      assertGameState(state);
    }).toThrow(DomainInvariantError);

    const researchState = createInitialState();
    researchState.research.unlockedNodeIds = ["unknown"];
    expect(() => {
      assertGameState(researchState);
    }).toThrow(DomainInvariantError);
  });

  it("refuses to serialize a programmer-created invalid state", () => {
    const state = createInitialState();
    state.company.cash = Number.NaN;
    expect(() => serializeGame(state)).toThrow(DomainInvariantError);
  });

  it("rejects invalid facility and customer structure", () => {
    const missingActiveFacility = createInitialState();
    missingActiveFacility.activeFacilityId = "missing";
    expect(() => {
      assertGameState(missingActiveFacility);
    }).toThrow(DomainInvariantError);

    const tooManyRacks = createInitialState();
    const facility = tooManyRacks.facilities[0];
    const rack = facility?.racks[0];
    if (facility === undefined || rack === undefined)
      throw new Error("fixture");
    facility.racks.push({ ...rack, id: "rack-extra", equipment: [] });
    expect(() => {
      assertGameState(tooManyRacks);
    }).toThrow(DomainInvariantError);

    const invalidLoyalty = createInitialState();
    const customer = invalidLoyalty.customers[0];
    if (customer === undefined) throw new Error("fixture");
    customer.loyalty = 2;
    expect(() => {
      assertGameState(invalidLoyalty);
    }).toThrow(DomainInvariantError);

    const invalidStage = createInitialState();
    const stagedCustomer = invalidStage.customers[0];
    if (stagedCustomer === undefined) throw new Error("fixture");
    stagedCustomer.currentStage = 0;
    expect(() => {
      assertGameState(invalidStage);
    }).toThrow(DomainInvariantError);

    const unknownCustomer = createInitialState();
    const namedCustomer = unknownCustomer.customers[0];
    if (namedCustomer === undefined) throw new Error("fixture");
    namedCustomer.definitionId = "unknown";
    expect(() => {
      assertGameState(unknownCustomer);
    }).toThrow(DomainInvariantError);
  });
});
