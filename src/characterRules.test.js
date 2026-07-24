import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveCharacter,
  newCharacter,
  pointsSpent,
} from "./characterRules.js";

test("default character starts with all points unspent", () => {
  const character = newCharacter();
  assert.equal(pointsSpent(character.abilities), 0);
  assert.deepEqual(character.inventory, []);
});

test("level 1 Human Fighter derives expected stats from the base spread", () => {
  const derived = deriveCharacter(newCharacter());
  // All abilities start at 8; Human adds +1 to each, giving 9s.
  assert.deepEqual(derived.finalAbilities, {
    str: 9,
    dex: 9,
    con: 9,
    int: 9,
    wis: 9,
    cha: 9,
  });
  assert.equal(derived.hp, 9);
  assert.equal(derived.ac, 9);
  assert.equal(derived.initiative, -1);
  assert.equal(derived.speed, 30);
});

test("higher Fighter levels use fixed 6 + CON modifier", () => {
  // 27-point spread with CON 14 (+1 Human = 15, +2 modifier).
  const character = {
    ...newCharacter(),
    level: 3,
    abilities: { str: 15, dex: 14, con: 14, int: 8, wis: 10, cha: 8 },
  };
  assert.equal(deriveCharacter(character).hp, 28);
});
