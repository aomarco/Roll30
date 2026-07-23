import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveCharacter,
  newCharacter,
  pointsSpent,
} from "./characterRules.js";

test("default character spends exactly 27 points", () => {
  const character = newCharacter();
  assert.equal(pointsSpent(character.abilities), 27);
  assert.deepEqual(character.inventory, []);
});

test("level 1 Human Fighter derives expected stats", () => {
  const derived = deriveCharacter(newCharacter());
  assert.deepEqual(derived.finalAbilities, {
    str: 16,
    dex: 15,
    con: 14,
    int: 9,
    wis: 13,
    cha: 11,
  });
  assert.equal(derived.hp, 12);
  assert.equal(derived.ac, 12);
  assert.equal(derived.initiative, 2);
  assert.equal(derived.speed, 30);
});

test("higher Fighter levels use fixed 6 + CON modifier", () => {
  const character = { ...newCharacter(), level: 3 };
  assert.equal(deriveCharacter(character).hp, 28);
});
