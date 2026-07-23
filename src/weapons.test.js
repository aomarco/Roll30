import test from "node:test";
import assert from "node:assert/strict";
import { resolveWeaponAttack, WEAPONS, weaponModifier } from "./weapons.js";

test("the five SRD test weapons are available", () => {
  assert.deepEqual(
    WEAPONS.map((weapon) => weapon.id),
    ["club", "dagger", "longsword", "battleaxe", "shortbow"],
  );
});

test("finesse uses the better ability modifier", () => {
  assert.equal(weaponModifier({ strength: 8, dexterity: 16 }, WEAPONS[1]), 3);
});

test("an attack meeting AC hits and rolls damage", () => {
  const rolls = [0.5, 0];
  const result = resolveWeaponAttack(
    { strength: 10, dexterity: 10, level: 1 },
    { ac: 13 },
    WEAPONS[2],
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
