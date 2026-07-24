import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveCharacter,
  newCharacter,
  pointsSpent,
} from "./characterRules.js";
import { raceById, subraceById } from "./races.js";

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

test("raceById and subraceById resolve known ids", () => {
  assert.equal(raceById("dwarf").name, "Dwarf");
  assert.equal(raceById("nope"), null);
  assert.equal(subraceById("dwarf", "hill-dwarf").name, "Hill Dwarf");
  assert.equal(subraceById("dwarf", null), null);
  assert.equal(subraceById("human", "anything"), null);
});

test("race ability bonuses apply on top of the base spread", () => {
  const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const dwarf = deriveCharacter({ ...newCharacter(), race: "dwarf", abilities: base });
  assert.equal(dwarf.finalAbilities.con, 12);
  assert.equal(dwarf.finalAbilities.str, 10);
  const elf = deriveCharacter({ ...newCharacter(), race: "elf", abilities: base });
  assert.equal(elf.finalAbilities.dex, 12);
});

test("subrace bonuses stack with the race bonus", () => {
  const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const hillDwarf = deriveCharacter({
    ...newCharacter(),
    race: "dwarf",
    subrace: "hill-dwarf",
    abilities: base,
  });
  assert.equal(hillDwarf.finalAbilities.con, 12);
  assert.equal(hillDwarf.finalAbilities.wis, 11);
});

test("a Small race derives its slower speed and size", () => {
  const halfling = deriveCharacter({ ...newCharacter(), race: "halfling" });
  assert.equal(halfling.baseSpeed, 25);
  assert.equal(halfling.speed, 25);
  assert.equal(halfling.size, "small");
});
