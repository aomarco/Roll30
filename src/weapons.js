export const WEAPONS = [
  {
    id: "club",
    name: "Club",
    category: "Simple melee · Light · Monk",
    damageDice: "1d4",
    damageType: "Bludgeoning",
    ability: "str",
    rangeFeet: 5,
    properties: ["Light", "Monk"],
    cost: { quantity: 1, unit: "sp" },
    weight: 2,
    source: "5e-srd-2014",
  },
  {
    id: "mace",
    name: "Mace",
    category: "Simple melee · Monk",
    damageDice: "1d6",
    damageType: "Bludgeoning",
    ability: "str",
    rangeFeet: 5,
    properties: ["Monk"],
    cost: { quantity: 5, unit: "gp" },
    weight: 4,
    source: "5e-srd-2014",
  },
  {
    id: "sickle",
    name: "Sickle",
    category: "Simple melee · Light · Monk",
    damageDice: "1d4",
    damageType: "Slashing",
    ability: "str",
    rangeFeet: 5,
    properties: ["Light", "Monk"],
    cost: { quantity: 1, unit: "gp" },
    weight: 2,
    source: "5e-srd-2014",
  },
  {
    id: "flail",
    name: "Flail",
    category: "Martial melee",
    damageDice: "1d8",
    damageType: "Bludgeoning",
    ability: "str",
    rangeFeet: 5,
    properties: [],
    cost: { quantity: 10, unit: "gp" },
    weight: 2,
    source: "5e-srd-2014",
  },
  {
    id: "morningstar",
    name: "Morningstar",
    category: "Martial melee",
    damageDice: "1d8",
    damageType: "Piercing",
    ability: "str",
    rangeFeet: 5,
    properties: [],
    cost: { quantity: 15, unit: "gp" },
    weight: 4,
    source: "5e-srd-2014",
  },
  {
    id: "rapier",
    name: "Rapier",
    category: "Martial melee · Finesse",
    damageDice: "1d8",
    damageType: "Piercing",
    ability: "finesse",
    rangeFeet: 5,
    properties: ["Finesse"],
    cost: { quantity: 25, unit: "gp" },
    weight: 2,
    source: "5e-srd-2014",
  },
  {
    id: "scimitar",
    name: "Scimitar",
    category: "Martial melee · Finesse · Light",
    damageDice: "1d6",
    damageType: "Slashing",
    ability: "finesse",
    rangeFeet: 5,
    properties: ["Finesse", "Light"],
    cost: { quantity: 25, unit: "gp" },
    weight: 3,
    source: "5e-srd-2014",
  },
  {
    id: "shortsword",
    name: "Shortsword",
    category: "Martial melee · Finesse · Light · Monk",
    damageDice: "1d6",
    damageType: "Piercing",
    ability: "finesse",
    rangeFeet: 5,
    properties: ["Finesse", "Light", "Monk"],
    cost: { quantity: 10, unit: "gp" },
    weight: 2,
    source: "5e-srd-2014",
  },
  {
    id: "war-pick",
    name: "War pick",
    category: "Martial melee",
    damageDice: "1d8",
    damageType: "Piercing",
    ability: "str",
    rangeFeet: 5,
    properties: [],
    cost: { quantity: 5, unit: "gp" },
    weight: 2,
    source: "5e-srd-2014",
  },
];

export const modifier = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
export const proficiencyBonus = (level) =>
  2 + Math.floor((Math.max(1, Number(level) || 1) - 1) / 4);

export function weaponModifier(token, weapon) {
  const strength = modifier(token.strength ?? 10);
  const dexterity = modifier(token.dexterity ?? 10);
  if (weapon.ability === "dex") return dexterity;
  if (weapon.ability === "finesse") return Math.max(strength, dexterity);
  return strength;
}

export function rollDice(notation, random = Math.random, multiplier = 1) {
  const [count, sides] = notation.split("d").map(Number);
  const rolls = Array.from(
    { length: count * multiplier },
    () => Math.floor(random() * sides) + 1,
  );
  return { rolls, total: rolls.reduce((sum, roll) => sum + roll, 0) };
}

export function resolveWeaponAttack(
  attacker,
  target,
  weapon,
  random = Math.random,
  options = {},
) {
  const rollMode = ["advantage", "disadvantage"].includes(options.rollMode)
    ? options.rollMode
    : "normal";
  const attackRolls = Array.from(
    { length: rollMode === "normal" ? 1 : 2 },
    () => Math.floor(random() * 20) + 1,
  );
  const naturalRoll =
    rollMode === "advantage"
      ? Math.max(...attackRolls)
      : rollMode === "disadvantage"
        ? Math.min(...attackRolls)
        : attackRolls[0];
  const selectedRollIndex = attackRolls.indexOf(naturalRoll);
  const abilityModifier = weaponModifier(attacker, weapon);
  const proficiency = proficiencyBonus(attacker.level);
  const bonus = abilityModifier + proficiency;
  const attackTotal = naturalRoll + bonus;
  const critical = naturalRoll === 20;
  const hit = critical || (naturalRoll !== 1 && attackTotal >= target.ac);
  const damageRoll = hit
    ? rollDice(weapon.damageDice, random, critical ? 2 : 1)
    : { rolls: [], total: 0 };
  const damageModifier = hit ? abilityModifier : 0;
  const damage = {
    ...damageRoll,
    diceTotal: damageRoll.total,
    modifier: damageModifier,
    total: hit ? Math.max(0, damageRoll.total + damageModifier) : 0,
  };
  return {
    naturalRoll,
    attackRolls,
    selectedRollIndex,
    rollMode,
    abilityModifier,
    proficiency,
    bonus,
    attackTotal,
    critical,
    hit,
    damage,
  };
}
