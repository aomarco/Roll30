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
  ammunition = null,
  fixedDamage = null,
  versatileDamageDice = null,
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
  damage:
    fixedDamage != null
      ? { type: "fixed", amount: fixedDamage }
      : { type: "dice", notation: damageDice },
  damageDice,
  versatileDamageDice,
  damageType,
  ammunition,
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
  // Versatile weapons: wielded two-handed (larger die) when the other hand is
  // free, or one-handed (smaller die) when a shield occupies the off hand.
  weapon({
    id: "quarterstaff",
    name: "Quarterstaff",
    weaponCategory: "Simple",
    damageDice: "1d6",
    versatileDamageDice: "1d8",
    damageType: "Bludgeoning",
    properties: ["Versatile", "Monk"],
    hands: "versatile",
    cost: { quantity: 2, unit: "sp" },
    weight: 4,
  }),
  weapon({
    id: "spear",
    name: "Spear",
    weaponCategory: "Simple",
    damageDice: "1d6",
    versatileDamageDice: "1d8",
    damageType: "Piercing",
    properties: ["Thrown", "Versatile", "Monk"],
    hands: "versatile",
    normalRange: 20,
    longRange: 60,
    lodgesOnHit: true,
    cost: { quantity: 1, unit: "gp" },
    weight: 3,
  }),
  weapon({
    id: "battleaxe",
    name: "Battleaxe",
    weaponCategory: "Martial",
    damageDice: "1d8",
    versatileDamageDice: "1d10",
    damageType: "Slashing",
    properties: ["Versatile"],
    hands: "versatile",
    cost: { quantity: 10, unit: "gp" },
    weight: 4,
  }),
  weapon({
    id: "longsword",
    name: "Longsword",
    weaponCategory: "Martial",
    damageDice: "1d8",
    versatileDamageDice: "1d10",
    damageType: "Slashing",
    properties: ["Versatile"],
    hands: "versatile",
    cost: { quantity: 15, unit: "gp" },
    weight: 3,
  }),
  weapon({
    id: "trident",
    name: "Trident",
    weaponCategory: "Martial",
    damageDice: "1d6",
    versatileDamageDice: "1d8",
    damageType: "Piercing",
    properties: ["Thrown", "Versatile"],
    hands: "versatile",
    normalRange: 20,
    longRange: 60,
    lodgesOnHit: true,
    cost: { quantity: 5, unit: "gp" },
    weight: 4,
  }),
  weapon({
    id: "warhammer",
    name: "Warhammer",
    weaponCategory: "Martial",
    damageDice: "1d8",
    versatileDamageDice: "1d10",
    damageType: "Bludgeoning",
    properties: ["Versatile"],
    hands: "versatile",
    cost: { quantity: 15, unit: "gp" },
    weight: 2,
  }),
  // Ranged weapons: each consumes one unit of its ammunition per attack.
  weapon({
    id: "crossbow-light",
    name: "Crossbow, light",
    weaponCategory: "Simple",
    rangeType: "ranged",
    damageDice: "1d8",
    damageType: "Piercing",
    properties: ["Ammunition", "Loading", "Two-Handed"],
    hands: "two",
    normalRange: 80,
    longRange: 320,
    ammunition: "crossbow-bolt",
    cost: { quantity: 25, unit: "gp" },
    weight: 5,
  }),
  weapon({
    id: "shortbow",
    name: "Shortbow",
    weaponCategory: "Simple",
    rangeType: "ranged",
    damageDice: "1d6",
    damageType: "Piercing",
    properties: ["Ammunition", "Two-Handed"],
    hands: "two",
    normalRange: 80,
    longRange: 320,
    ammunition: "arrow",
    cost: { quantity: 25, unit: "gp" },
    weight: 2,
  }),
  weapon({
    id: "sling",
    name: "Sling",
    weaponCategory: "Simple",
    rangeType: "ranged",
    damageDice: "1d4",
    damageType: "Bludgeoning",
    properties: ["Ammunition"],
    hands: "one",
    normalRange: 30,
    longRange: 120,
    ammunition: "sling-bullet",
    cost: { quantity: 1, unit: "sp" },
    weight: 0,
  }),
  weapon({
    id: "blowgun",
    name: "Blowgun",
    weaponCategory: "Martial",
    rangeType: "ranged",
    damageDice: "1",
    fixedDamage: 1,
    damageType: "Piercing",
    properties: ["Ammunition", "Loading"],
    hands: "one",
    normalRange: 25,
    longRange: 100,
    ammunition: "blowgun-needle",
    cost: { quantity: 10, unit: "gp" },
    weight: 1,
  }),
  weapon({
    id: "crossbow-hand",
    name: "Crossbow, hand",
    weaponCategory: "Martial",
    rangeType: "ranged",
    damageDice: "1d6",
    damageType: "Piercing",
    properties: ["Ammunition", "Light", "Loading"],
    hands: "one",
    normalRange: 30,
    longRange: 120,
    ammunition: "crossbow-bolt",
    cost: { quantity: 75, unit: "gp" },
    weight: 3,
  }),
  weapon({
    id: "crossbow-heavy",
    name: "Crossbow, heavy",
    weaponCategory: "Martial",
    rangeType: "ranged",
    damageDice: "1d10",
    damageType: "Piercing",
    properties: ["Ammunition", "Heavy", "Loading", "Two-Handed"],
    hands: "two",
    normalRange: 100,
    longRange: 400,
    ammunition: "crossbow-bolt",
    cost: { quantity: 50, unit: "gp" },
    weight: 18,
  }),
  weapon({
    id: "longbow",
    name: "Longbow",
    weaponCategory: "Martial",
    rangeType: "ranged",
    damageDice: "1d8",
    damageType: "Piercing",
    properties: ["Ammunition", "Heavy", "Two-Handed"],
    hands: "two",
    normalRange: 150,
    longRange: 600,
    ammunition: "arrow",
    cost: { quantity: 50, unit: "gp" },
    weight: 2,
  }),
];

/** Ammunition catalog. Source-backed 2014 SRD adventuring gear. */
export const AMMUNITION = [
  {
    id: "arrow",
    name: "Arrow",
    cost: { quantity: 1, unit: "gp" },
    weight: 1,
    bundle: 20,
  },
  {
    id: "crossbow-bolt",
    name: "Crossbow bolt",
    cost: { quantity: 1, unit: "gp" },
    weight: 1.5,
    bundle: 20,
  },
  {
    id: "sling-bullet",
    name: "Sling bullet",
    cost: { quantity: 4, unit: "cp" },
    weight: 1.5,
    bundle: 20,
  },
  {
    id: "blowgun-needle",
    name: "Blowgun needle",
    cost: { quantity: 1, unit: "gp" },
    weight: 1,
    bundle: 50,
  },
].map((ammo) => ({ ...ammo, source: "5e-srd-2014" }));

export const ammunitionById = (id) =>
  AMMUNITION.find((candidate) => candidate.id === id) || null;

/** Armor catalog. Source-backed 2014 SRD armor and shield. */
const armor = ({
  id,
  name,
  category,
  acBase,
  acDex = false,
  acMaxBonus = null,
  strMinimum = 0,
  stealthDisadvantage = false,
  cost,
  weight,
}) => ({
  id,
  name,
  category,
  acBase,
  acDex,
  acMaxBonus,
  strMinimum,
  stealthDisadvantage,
  cost,
  weight,
  source: "5e-srd-2014",
});

export const ARMOR = [
  armor({ id: "padded-armor", name: "Padded Armor", category: "Light", acBase: 11, acDex: true, stealthDisadvantage: true, cost: { quantity: 5, unit: "gp" }, weight: 8 }),
  armor({ id: "leather-armor", name: "Leather Armor", category: "Light", acBase: 11, acDex: true, cost: { quantity: 10, unit: "gp" }, weight: 10 }),
  armor({ id: "studded-leather-armor", name: "Studded Leather Armor", category: "Light", acBase: 12, acDex: true, cost: { quantity: 45, unit: "gp" }, weight: 13 }),
  armor({ id: "hide-armor", name: "Hide Armor", category: "Medium", acBase: 12, acDex: true, acMaxBonus: 2, cost: { quantity: 10, unit: "gp" }, weight: 12 }),
  armor({ id: "chain-shirt", name: "Chain Shirt", category: "Medium", acBase: 13, acDex: true, acMaxBonus: 2, cost: { quantity: 50, unit: "gp" }, weight: 20 }),
  armor({ id: "scale-mail", name: "Scale Mail", category: "Medium", acBase: 14, acDex: true, acMaxBonus: 2, stealthDisadvantage: true, cost: { quantity: 50, unit: "gp" }, weight: 45 }),
  armor({ id: "breastplate", name: "Breastplate", category: "Medium", acBase: 14, acDex: true, acMaxBonus: 2, cost: { quantity: 400, unit: "gp" }, weight: 20 }),
  armor({ id: "half-plate-armor", name: "Half Plate Armor", category: "Medium", acBase: 15, acDex: true, acMaxBonus: 2, stealthDisadvantage: true, cost: { quantity: 750, unit: "gp" }, weight: 40 }),
  armor({ id: "ring-mail", name: "Ring Mail", category: "Heavy", acBase: 14, stealthDisadvantage: true, cost: { quantity: 30, unit: "gp" }, weight: 40 }),
  armor({ id: "chain-mail", name: "Chain Mail", category: "Heavy", acBase: 16, strMinimum: 13, stealthDisadvantage: true, cost: { quantity: 75, unit: "gp" }, weight: 55 }),
  armor({ id: "splint-armor", name: "Splint Armor", category: "Heavy", acBase: 17, strMinimum: 15, stealthDisadvantage: true, cost: { quantity: 200, unit: "gp" }, weight: 60 }),
  armor({ id: "plate-armor", name: "Plate Armor", category: "Heavy", acBase: 18, strMinimum: 15, stealthDisadvantage: true, cost: { quantity: 1500, unit: "gp" }, weight: 65 }),
  armor({ id: "shield", name: "Shield", category: "Shield", acBase: 2, cost: { quantity: 10, unit: "gp" }, weight: 6 }),
];

export const armorById = (id) =>
  ARMOR.find((candidate) => candidate.id === id) || null;

/**
 * Effective damage die for a weapon given hand state. Versatile weapons deal
 * their two-handed die when the other hand is free, and their one-handed die
 * when a shield occupies it. All other weapons return their normal die.
 */
export function effectiveDamageDice(weapon, { shield = false } = {}) {
  if (weapon?.hands === "versatile" && weapon.versatileDamageDice)
    return shield ? weapon.damageDice : weapon.versatileDamageDice;
  return weapon?.damageDice;
}

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
  const naturalCrit = naturalRoll === 20;
  const hit = naturalCrit || (naturalRoll !== 1 && attackTotal >= target.ac);
  // A hit is also a critical when the target's state forces it (e.g. a melee
  // hit against a paralyzed or unconscious creature).
  const critical = naturalCrit || (hit && !!options.autoCritical);
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
