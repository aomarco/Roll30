import test from "node:test";
import assert from "node:assert/strict";
import {
  FIGHTER_SAVES,
  SAVING_THROWS,
  SKILLS,
  saveModifier,
  skillModifier,
} from "./skills.js";

const abilities = { str: 16, dex: 14, con: 12, int: 10, wis: 8, cha: 10 };

test("the 18 SRD skills and 6 saving throws are present", () => {
  assert.equal(SKILLS.length, 18);
  assert.equal(SAVING_THROWS.length, 6);
  assert.deepEqual(FIGHTER_SAVES, ["str", "con"]);
});

test("skillModifier adds the proficiency bonus only when proficient", () => {
  // Athletics is STR-based; STR 16 → +3, level 1 proficiency bonus +2.
  assert.equal(skillModifier(abilities, 1, "athletics", false), 3);
  assert.equal(skillModifier(abilities, 1, "athletics", true), 5);
});

test("saveModifier mirrors skillModifier for an ability", () => {
  // WIS 8 → -1; proficient at level 1 → -1 + 2 = +1.
  assert.equal(saveModifier(abilities, 1, "wis", false), -1);
  assert.equal(saveModifier(abilities, 1, "wis", true), 1);
});

test("proficiency bonus scales with level", () => {
  // DEX 14 → +2. Levels 1-4 add +2, levels 5-8 add +3.
  assert.equal(skillModifier(abilities, 4, "acrobatics", true), 4);
  assert.equal(skillModifier(abilities, 5, "acrobatics", true), 5);
});

test("an unknown skill id contributes nothing", () => {
  assert.equal(skillModifier(abilities, 1, "made-up", true), 0);
});
