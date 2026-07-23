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
