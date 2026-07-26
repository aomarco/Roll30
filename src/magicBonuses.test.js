import test from "node:test";
import assert from "node:assert/strict";
import {
  WORN_MAGIC_ITEMS,
  isWornMagicItem,
  enchantmentBonus,
  armorClassMagicBonus,
  weaponMagicBonuses,
  saveMagicBonus,
} from "./magicBonuses.js";
import { computeArmorClass } from "./combatRules.js";
import { resolveWeaponAttack } from "./weapons.js";

const meleeWeapon = { id: "longsword", rangeType: "melee", ability: "str" };
const bow = { id: "longbow", rangeType: "ranged", ability: "dex" };

test("worn accessories are recognised by id", () => {
  assert.ok(isWornMagicItem("ring-of-protection"));
  assert.ok(!isWornMagicItem("longsword"));
  assert.equal(WORN_MAGIC_ITEMS.length, 6);
});

test("enchantmentBonus clamps to a non-negative number", () => {
  const c = { enchantments: { longsword: 2, dagger: -5 } };
  assert.equal(enchantmentBonus(c, "longsword"), 2);
  assert.equal(enchantmentBonus(c, "dagger"), 0);
  assert.equal(enchantmentBonus(c, "missing"), 0);
});

test("weapon enchantment adds to both attack and damage", () => {
  const c = { enchantments: { longsword: 3 } };
  assert.deepEqual(weaponMagicBonuses(c, meleeWeapon), { attack: 3, damage: 3 });
});

test("Bracers of Archery add ranged damage only, Ioun Stone of Mastery adds attack", () => {
  const c = { worn: ["bracers-of-archery", "ioun-stone-of-mastery"] };
  assert.deepEqual(weaponMagicBonuses(c, bow), { attack: 1, damage: 2 });
  // The archery bracers do nothing for a melee weapon.
  assert.deepEqual(weaponMagicBonuses(c, meleeWeapon), { attack: 1, damage: 0 });
});

test("protection items and magic armor stack into the AC bonus", () => {
  const c = {
    armor: "plate-armor",
    shield: true,
    enchantments: { "plate-armor": 1, shield: 2 },
    worn: ["ring-of-protection", "ioun-stone-of-protection"],
  };
  // +1 armor, +2 shield, +1 ring, +1 ioun stone = +5.
  assert.equal(armorClassMagicBonus(c), 5);
});

test("Bracers of Defense only apply while unarmored and shieldless", () => {
  const unarmored = { worn: ["bracers-of-defense"] };
  assert.equal(armorClassMagicBonus(unarmored), 2);
  const armored = { armor: "leather-armor", worn: ["bracers-of-defense"] };
  assert.equal(armorClassMagicBonus(armored), 0);
  const shielded = { shield: true, worn: ["bracers-of-defense"] };
  assert.equal(armorClassMagicBonus(shielded), 0);
});

test("saveMagicBonus totals protection accessories", () => {
  const c = { worn: ["ring-of-protection", "cloak-of-protection"] };
  assert.equal(saveMagicBonus(c), 2);
});

test("computeArmorClass folds in the acBonus argument", () => {
  const base = computeArmorClass({ armor: "leather-armor", dexterity: 14 });
  const boosted = computeArmorClass({
    armor: "leather-armor",
    dexterity: 14,
    acBonus: 3,
  });
  assert.equal(boosted, base + 3);
});

test("resolveWeaponAttack applies item attack and damage bonuses", () => {
  const attacker = { level: 1, strength: 10 };
  const target = { ac: 5 };
  const weapon = { damage: { type: "dice", notation: "1d6" }, ability: "str" };
  // Force natural roll of 10 (index 0 of the sequence), damage die 4.
  const rolls = [10 / 20, 3 / 6];
  let i = 0;
  const random = () => rolls[i++];
  const result = resolveWeaponAttack(attacker, target, weapon, random, {
    attackBonus: 2,
    damageBonus: 2,
  });
  assert.equal(result.itemAttackBonus, 2);
  // bonus = str mod (0) + proficiency (2) + item (2) = 4.
  assert.equal(result.bonus, 4);
  assert.equal(result.damage.itemBonus, 2);
  // die 4 + str 0 + item 2 = 6.
  assert.equal(result.damage.total, 6);
});
