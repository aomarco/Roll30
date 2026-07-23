import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveWeaponAttack, WEAPONS, weaponModifier } from "./weapons.js";

const SRD_EQUIPMENT = JSON.parse(
  readFileSync(
    new URL("../DND 5E Data/5e-SRD-Equipment.json", import.meta.url),
    "utf8",
  ),
);

test("the nine mechanically compatible SRD weapons are available", () => {
  assert.deepEqual(
    WEAPONS.map((weapon) => weapon.id),
    [
      "club",
      "mace",
      "sickle",
      "flail",
      "morningstar",
      "rapier",
      "scimitar",
      "shortsword",
      "war-pick",
    ],
  );
  assert.ok(WEAPONS.every((weapon) => weapon.source === "5e-srd-2014"));
});

test("imported weapon records match their local SRD source", () => {
  for (const weapon of WEAPONS) {
    const source = SRD_EQUIPMENT.find((item) => item.index === weapon.id);
    assert.ok(source, `${weapon.id} exists in the SRD equipment data`);
    assert.equal(weapon.name, source.name);
    assert.equal(weapon.damageDice, source.damage.damage_dice);
    assert.equal(weapon.damageType, source.damage.damage_type.name);
    assert.equal(weapon.rangeFeet, source.range.normal);
    assert.deepEqual(
      weapon.properties,
      source.properties.map((property) => property.name),
    );
    assert.deepEqual(weapon.cost, source.cost);
    assert.equal(weapon.weight, source.weight);
  }
});

test("finesse uses the better ability modifier", () => {
  const rapier = WEAPONS.find((weapon) => weapon.id === "rapier");
  assert.equal(weaponModifier({ strength: 8, dexterity: 16 }, rapier), 3);
});

test("finesse adds the better modifier to attack and damage", () => {
  const rapier = WEAPONS.find((weapon) => weapon.id === "rapier");
  const rolls = [0.5, 0];
  const result = resolveWeaponAttack(
    { strength: 8, dexterity: 16, level: 1 },
    { ac: 10 },
    rapier,
    () => rolls.shift(),
  );
  assert.equal(result.bonus, 5);
  assert.equal(result.damage.diceTotal, 1);
  assert.equal(result.damage.modifier, 3);
  assert.equal(result.damage.total, 4);
});

test("ordinary melee attacks add Strength to damage", () => {
  const flail = WEAPONS.find((weapon) => weapon.id === "flail");
  const rolls = [0.5, 0];
  const result = resolveWeaponAttack(
    { strength: 16, dexterity: 8, level: 1 },
    { ac: 10 },
    flail,
    () => rolls.shift(),
  );
  assert.equal(result.damage.diceTotal, 1);
  assert.equal(result.damage.modifier, 3);
  assert.equal(result.damage.total, 4);
});

test("advantage keeps the higher d20 and disadvantage keeps the lower", () => {
  const club = WEAPONS.find((weapon) => weapon.id === "club");
  const advantageRolls = [0.2, 0.8, 0];
  const advantage = resolveWeaponAttack(
    { strength: 10, level: 1 },
    { ac: 1 },
    club,
    () => advantageRolls.shift(),
    { rollMode: "advantage" },
  );
  assert.deepEqual(advantage.attackRolls, [5, 17]);
  assert.equal(advantage.naturalRoll, 17);
  assert.equal(advantage.selectedRollIndex, 1);

  const disadvantageRolls = [0.2, 0.8, 0];
  const disadvantage = resolveWeaponAttack(
    { strength: 10, level: 1 },
    { ac: 1 },
    club,
    () => disadvantageRolls.shift(),
    { rollMode: "disadvantage" },
  );
  assert.deepEqual(disadvantage.attackRolls, [5, 17]);
  assert.equal(disadvantage.naturalRoll, 5);
  assert.equal(disadvantage.selectedRollIndex, 0);
});

test("negative finesse damage cannot reduce a hit below zero damage", () => {
  const rapier = WEAPONS.find((weapon) => weapon.id === "rapier");
  const rolls = [0.25, 0];
  const result = resolveWeaponAttack(
    { strength: 6, dexterity: 8, level: 1 },
    { ac: 1 },
    rapier,
    () => rolls.shift(),
  );
  assert.equal(result.damage.modifier, -1);
  assert.equal(result.damage.total, 0);
});

test("an attack meeting AC hits and rolls damage", () => {
  const rolls = [0.5, 0];
  const result = resolveWeaponAttack(
    { strength: 10, dexterity: 10, level: 1 },
    { ac: 13 },
    WEAPONS.find((weapon) => weapon.id === "flail"),
    () => rolls.shift(),
  );
  assert.equal(result.attackTotal, 13);
  assert.equal(result.hit, true);
  assert.equal(result.damage.total, 1);
});

test("natural 1 misses and natural 20 doubles damage dice", () => {
  assert.equal(
    resolveWeaponAttack({ level: 1 }, { ac: 1 }, WEAPONS[0], () => 0).hit,
    false,
  );
  const rolls = [0.999, 0, 0.999];
  const critical = resolveWeaponAttack(
    { level: 1 },
    { ac: 99 },
    WEAPONS[0],
    () => rolls.shift(),
  );
  assert.equal(critical.critical, true);
  assert.deepEqual(critical.damage.rolls, [1, 4]);
});
