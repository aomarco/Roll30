export const WEAPONS = [
  {
    id: "club",
    name: "Club",
    category: "Simple melee",
    damageDice: "1d4",
    damageType: "Bludgeoning",
    ability: "str",
    rangeFeet: 5,
  },
  {
    id: "dagger",
    name: "Dagger",
    category: "Simple melee · Finesse",
    damageDice: "1d4",
    damageType: "Piercing",
    ability: "finesse",
    rangeFeet: 5,
  },
  {
    id: "longsword",
    name: "Longsword",
    category: "Martial melee",
    damageDice: "1d8",
    damageType: "Slashing",
    ability: "str",
    rangeFeet: 5,
  },
  {
    id: "shortbow",
    name: "Shortbow",
    category: "Simple ranged",
    damageDice: "1d6",
    damageType: "Piercing",
    ability: "dex",
    rangeFeet: 80,
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
) {
  const naturalRoll = Math.floor(random() * 20) + 1;
  const abilityModifier = weaponModifier(attacker, weapon);
  const bonus = abilityModifier + proficiencyBonus(attacker.level);
  const attackTotal = naturalRoll + bonus;
  const critical = naturalRoll === 20;
  const hit = critical || (naturalRoll !== 1 && attackTotal >= target.ac);
  const damage = hit
    ? rollDice(weapon.damageDice, random, critical ? 2 : 1)
    : { rolls: [], total: 0 };
  return { naturalRoll, bonus, attackTotal, critical, hit, damage };
}
