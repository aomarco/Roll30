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

test("migration strips equipped armor and shield that are not owned", () => {
  const token = migrateTokenData({
    id: 2,
    dexterity: 14,
    inventory: [{ itemId: "leather-armor", quantity: 1 }],
    armor: "plate-armor",
    shield: true,
  });
  // Unowned plate/shield are cleared; AC falls back to unarmored 10 + Dex.
  assert.equal(token.armor, null);
  assert.equal(token.shield, false);
  assert.equal(token.ac, 12);

  const owned = migrateTokenData({
    id: 3,
    dexterity: 14,
    inventory: [
      { itemId: "leather-armor", quantity: 1 },
      { itemId: "shield", quantity: 1 },
    ],
    armor: "leather-armor",
    shield: true,
  });
  assert.equal(owned.armor, "leather-armor");
  assert.equal(owned.shield, true);
  assert.equal(owned.ac, 15); // 11 + 2 Dex + 2 shield
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
