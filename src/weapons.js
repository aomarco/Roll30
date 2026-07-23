const weapon = ({
  id,
  name,
  weaponCategory,
  rangeType = "melee",
  damageDice,
  damageType,
  properties = [],
  cost,
  weight,
  hands = "one",
  meleeRange = properties.includes("Reach") ? 10 : 5,
  normalRange = null,
  longRange = null,
  lodgesOnHit = false,
  ability,
}) => ({
  id,
  name,
  category:
    `${weaponCategory} ${rangeType} · ${properties.join(" · ")}`.replace(
      / · $/,
      "",
    ),
  weaponCategory,
  rangeType,
  damage: { type: "dice", notation: damageDice },
  damageDice,
  damageType,
  ability:
    ability ??
    (properties.includes("Finesse")
      ? "finesse"
      : rangeType === "ranged"
        ? "dex"
        : "str"),
  meleeRange,
  rangeFeet: rangeType === "ranged" ? normalRange : 5,
  normalRange,
  longRange,
  thrown: properties.includes("Thrown")
    ? { normalRange, longRange, lodgesOnHit }
    : null,
  properties,
  hands,
  cost,
  weight,
  source: "5e-srd-2014",
});

export const WEAPONS = [
  weapon({
    id: "club",
    name: "Club",
    weaponCategory: "Simple",
    damageDice: "1d4",
    damageType: "Bludgeoning",
    properties: ["Light", "Monk"],
    cost: { quantity: 1, unit: "sp" },
    weight: 2,
  }),
  weapon({
    id: "mace",
    name: "Mace",
    weaponCategory: "Simple",
    damageDice: "1d6",
    damageType: "Bludgeoning",
    properties: ["Monk"],
    cost: { quantity: 5, unit: "gp" },
    weight: 4,
  }),
  weapon({
    id: "sickle",
    name: "Sickle",
    weaponCategory: "Simple",
    damageDice: "1d4",
    damageType: "Slashing",
    properties: ["Light", "Monk"],
    cost: { quantity: 1, unit: "gp" },
    weight: 2,
  }),
  weapon({
    id: "flail",
    name: "Flail",
    weaponCategory: "Martial",
    damageDice: "1d8",
    damageType: "Bludgeoning",
    cost: { quantity: 10, unit: "gp" },
    weight: 2,
  }),
  weapon({
    id: "morningstar",
    name: "Morningstar",
    weaponCategory: "Martial",
    damageDice: "1d8",
    damageType: "Piercing",
    cost: { quantity: 15, unit: "gp" },
    weight: 4,
  }),
  weapon({
    id: "rapier",
    name: "Rapier",
    weaponCategory: "Martial",
    damageDice: "1d8",
    damageType: "Piercing",
    properties: ["Finesse"],
    cost: { quantity: 25, unit: "gp" },
    weight: 2,
  }),
  weapon({
    id: "scimitar",
    name: "Scimitar",
    weaponCategory: "Martial",
    damageDice: "1d6",
    damageType: "Slashing",
    properties: ["Finesse", "Light"],
    cost: { quantity: 25, unit: "gp" },
    weight: 3,
  }),
  weapon({
    id: "shortsword",
    name: "Shortsword",
    weaponCategory: "Martial",
    damageDice: "1d6",
    damageType: "Piercing",
    properties: ["Finesse", "Light", "Monk"],
    cost: { quantity: 10, unit: "gp" },
    weight: 2,
  }),
  weapon({
    id: "war-pick",
    name: "War pick",
    weaponCategory: "Martial",
    damageDice: "1d8",
    damageType: "Piercing",
    cost: { quantity: 5, unit: "gp" },
    weight: 2,
  }),
  weapon({
    id: "dagger",
    name: "Dagger",
    weaponCategory: "Simple",
    damageDice: "1d4",
    damageType: "Piercing",
    properties: ["Finesse", "Light", "Thrown", "Monk"],
    normalRange: 20,
    longRange: 60,
    lodgesOnHit: true,
    cost: { quantity: 2, unit: "gp" },
    weight: 1,
  }),
  weapon({
    id: "greatclub",
    name: "Greatclub",
    weaponCategory: "Simple",
    damageDice: "1d8",
    damageType: "Bludgeoning",
    properties: ["Two-Handed"],
    hands: "two",
    cost: { quantity: 2, unit: "sp" },
    weight: 10,
  }),
  weapon({
    id: "handaxe",
    name: "Handaxe",
    weaponCategory: "Simple",
    damageDice: "1d6",
    damageType: "Slashing",
    properties: ["Light", "Thrown", "Monk"],
    normalRange: 20,
    longRange: 60,
    lodgesOnHit: true,
    cost: { quantity: 5, unit: "gp" },
    weight: 2,
  }),
  weapon({
    id: "javelin",
    name: "Javelin",
    weaponCategory: "Simple",
    damageDice: "1d6",
    damageType: "Piercing",
    properties: ["Thrown", "Monk"],
    normalRange: 30,
    longRange: 120,
    lodgesOnHit: true,
    cost: { quantity: 5, unit: "sp" },
    weight: 2,
  }),
  weapon({
    id: "light-hammer",
    name: "Light hammer",
    weaponCategory: "Simple",
    damageDice: "1d4",
    damageType: "Bludgeoning",
    properties: ["Light", "Thrown", "Monk"],
    normalRange: 20,
    longRange: 60,
    cost: { quantity: 2, unit: "gp" },
    weight: 2,
  }),
  weapon({
    id: "dart",
    name: "Dart",
    weaponCategory: "Simple",
    rangeType: "ranged",
    damageDice: "1d4",
    damageType: "Piercing",
    properties: ["Finesse", "Thrown"],
    normalRange: 20,
    longRange: 60,
    lodgesOnHit: true,
    cost: { quantity: 5, unit: "cp" },
    weight: 0.25,
  }),
  weapon({
    id: "glaive",
    name: "Glaive",
    weaponCategory: "Martial",
    damageDice: "1d10",
    damageType: "Slashing",
    properties: ["Heavy", "Reach", "Two-Handed"],
    hands: "two",
    cost: { quantity: 20, unit: "gp" },
    weight: 6,
  }),
  weapon({
    id: "greataxe",
    name: "Greataxe",
    weaponCategory: "Martial",
    damageDice: "1d12",
    damageType: "Slashing",
    properties: ["Heavy", "Two-Handed"],
    hands: "two",
    cost: { quantity: 30, unit: "gp" },
    weight: 7,
  }),
  weapon({
    id: "greatsword",
    name: "Greatsword",
    weaponCategory: "Martial",
    damageDice: "2d6",
    damageType: "Slashing",
    properties: ["Heavy", "Two-Handed"],
    hands: "two",
    cost: { quantity: 50, unit: "gp" },
    weight: 6,
  }),
  weapon({
    id: "halberd",
    name: "Halberd",
    weaponCategory: "Martial",
    damageDice: "1d10",
    damageType: "Slashing",
    properties: ["Heavy", "Reach", "Two-Handed"],
    hands: "two",
    cost: { quantity: 20, unit: "gp" },
    weight: 6,
  }),
  weapon({
    id: "lance",
    name: "Lance",
    weaponCategory: "Martial",
    damageDice: "1d12",
    damageType: "Piercing",
    properties: ["Reach", "Special"],
    hands: "one",
    cost: { quantity: 10, unit: "gp" },
    weight: 6,
  }),
  weapon({
    id: "maul",
    name: "Maul",
    weaponCategory: "Martial",
    damageDice: "2d6",
    damageType: "Bludgeoning",
    properties: ["Heavy", "Two-Handed"],
    hands: "two",
    cost: { quantity: 10, unit: "gp" },
    weight: 10,
  }),
  weapon({
    id: "pike",
    name: "Pike",
    weaponCategory: "Martial",
    damageDice: "1d10",
    damageType: "Piercing",
    properties: ["Heavy", "Reach", "Two-Handed"],
    hands: "two",
    cost: { quantity: 5, unit: "gp" },
    weight: 18,
  }),
  weapon({
    id: "whip",
    name: "Whip",
    weaponCategory: "Martial",
    damageDice: "1d4",
    damageType: "Slashing",
    properties: ["Finesse", "Reach"],
    cost: { quantity: 2, unit: "gp" },
    weight: 3,
  }),
];

export const weaponById = (id) =>
  WEAPONS.find((candidate) => candidate.id === id) || null;

export const modifier = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
export const proficiencyBonus = (level) =>
  2 + Math.floor((Math.max(1, Number(level) || 1) - 1) / 4);

export function weaponModifier(token, selectedWeapon) {
  const strength = modifier(token.strength ?? 10);
  const dexterity = modifier(token.dexterity ?? 10);
  if (selectedWeapon.ability === "dex") return dexterity;
  if (selectedWeapon.ability === "finesse")
    return Math.max(strength, dexterity);
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
  selectedWeapon,
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
  const abilityModifier = weaponModifier(attacker, selectedWeapon);
  const proficiency = proficiencyBonus(attacker.level);
  const bonus = abilityModifier + proficiency;
  const attackTotal = naturalRoll + bonus;
  const critical = naturalRoll === 20;
  const hit = critical || (naturalRoll !== 1 && attackTotal >= target.ac);
  const damageDefinition = selectedWeapon.damage || {
    type: "dice",
    notation: selectedWeapon.damageDice,
  };
  const damageRoll =
    hit && damageDefinition.type === "dice"
      ? rollDice(damageDefinition.notation, random, critical ? 2 : 1)
      : {
          rolls: [],
          total: hit ? Number(damageDefinition.amount) || 0 : 0,
        };
  const ordinaryModifier =
    options.damageModifier === "off-hand"
      ? Math.min(0, abilityModifier)
      : abilityModifier;
  const damageModifier = hit ? ordinaryModifier : 0;
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
