import test from "node:test";
import assert from "node:assert/strict";
import {
  COMBAT_DATA_VERSION,
  migrateCharacterData,
  migrateTokenData,
  restoreBattleData,
} from "./persistenceRules.js";

test("legacy tokens gain size and a safe first-owned loadout", () => {
  const token = migrateTokenData({
    id: 1,
    inventory: ["club", "club"],
  });
  assert.equal(token.size, "medium");
  assert.deepEqual(token.inventory, [{ itemId: "club", quantity: 2 }]);
  assert.deepEqual(token.loadout, { mainHand: "club", offHand: null });
});

test("legacy characters gain size and normalized inventory", () => {
  const character = migrateCharacterData({
    id: "hero",
    inventory: [{ id: "rapier", quantity: 1 }],
  });
  assert.equal(character.size, "medium");
  assert.deepEqual(character.loadout, {
    mainHand: "rapier",
    offHand: null,
  });
});

test("legacy battles reopen in Setup while versioned battles restore items", () => {
  const tokens = [migrateTokenData({ id: 1, speed: 30 })];
  assert.equal(
    restoreBattleData(
      { battle: { order: [1], turn: 0, resources: {} } },
      tokens,
    ),
    null,
  );
  const restored = restoreBattleData(
    {
      combatVersion: COMBAT_DATA_VERSION,
      battle: {
        order: [1],
        turn: 0,
        resources: { movementBase: 30, movementSpent: 10 },
        items: [{ id: "knife", state: "ground" }],
      },
    },
    tokens,
  );
  assert.equal(restored.resources.movementSpent, 10);
  assert.deepEqual(restored.items, [{ id: "knife", state: "ground" }]);
});
