import test from "node:test";
import assert from "node:assert/strict";
import { CLASSES, classById } from "./classes.js";
import { deriveCharacter, newCharacter } from "./characterRules.js";

test("the class catalog contains Fighter and Wizard", () => {
  assert.deepEqual(
    CLASSES.map((cls) => cls.id),
    ["fighter", "wizard"],
  );
});

test("classById resolves by id or display name and falls back to Fighter", () => {
  assert.equal(classById("wizard").name, "Wizard");
  assert.equal(classById("Wizard").name, "Wizard");
  assert.equal(classById("Fighter").id, "fighter");
  assert.equal(classById("nonexistent").id, "fighter");
});

test("only the Wizard is a spellcaster", () => {
  assert.equal(classById("fighter").spellcasting, null);
  assert.equal(classById("wizard").spellcasting.ability, "int");
});

test("a level 1 Wizard uses the d6 hit die and has no spellcasting on Fighter", () => {
  const wizard = deriveCharacter({ ...newCharacter(), className: "Wizard" });
  // Human all-9s: CON 9 → -1 modifier, so 6 + (-1) = 5 HP.
  assert.equal(wizard.hp, 5);
  assert.equal(wizard.className, "Wizard");
  assert.equal(deriveCharacter(newCharacter()).spellcasting, null);
});

test("Wizard spellcasting derives an unlimited-slot placeholder with DC/attack", () => {
  const wizard = deriveCharacter({ ...newCharacter(), className: "Wizard" });
  // INT 9 → -1 modifier; level 1 proficiency +2.
  assert.equal(wizard.spellcasting.ability, "int");
  assert.equal(wizard.spellcasting.slots, "unlimited");
  assert.equal(wizard.spellcasting.saveDC, 9); // 8 + 2 - 1
  assert.equal(wizard.spellcasting.attackBonus, 1); // 2 - 1
});
