// Tier 1 magic-item mechanics: flat numeric bonuses that ride on systems that
// already exist (weapon attack/damage, Armor Class). Two shapes:
//
//   1. Enchantments — a per-item "+X" applied to a base weapon, armor, or shield
//      the character already owns and equips. Stored on the character as
//      `enchantments: { [itemId]: plus }`.
//   2. Worn accessories — distinct magic items (rings, cloaks, bracers, ioun
//      stones) whose bonuses apply while "worn". Stored as `worn: [itemId]`.
//
// Everything here is pure so it can be unit-tested and reused by both the
// character sheet (derived AC) and the battle engine (attack/damage bonuses).

/** Distinct, wearable Tier 1 magic items and the flat bonuses they grant. */
export const WORN_MAGIC_ITEMS = [
  {
    id: "bracers-of-archery",
    name: "Bracers of Archery",
    rarity: "Uncommon",
    itemCategory: "Wondrous Items",
    // +2 damage with ranged weapons.
    effect: { rangedDamage: 2 },
  },
  {
    id: "bracers-of-defense",
    name: "Bracers of Defense",
    rarity: "Rare",
    itemCategory: "Wondrous Items",
    // +2 AC only while wearing no armor and no shield.
    effect: { ac: 2, requiresNoArmorOrShield: true },
  },
  {
    id: "cloak-of-protection",
    name: "Cloak of Protection",
    rarity: "Uncommon",
    itemCategory: "Wondrous Items",
    effect: { ac: 1, save: 1 },
  },
  {
    id: "ring-of-protection",
    name: "Ring of Protection",
    rarity: "Rare",
    itemCategory: "Ring",
    effect: { ac: 1, save: 1 },
  },
  {
    id: "ioun-stone-of-mastery",
    name: "Ioun Stone of Mastery",
    rarity: "Legendary",
    itemCategory: "Wondrous Items",
    // +1 proficiency bonus; modelled here as +1 to weapon attack rolls.
    effect: { attack: 1 },
  },
  {
    id: "ioun-stone-of-protection",
    name: "Ioun Stone of Protection",
    rarity: "Rare",
    itemCategory: "Wondrous Items",
    effect: { ac: 1 },
  },
];

const WORN_BY_ID = new Map(WORN_MAGIC_ITEMS.map((item) => [item.id, item]));

/** True if the given item id is a worn Tier 1 accessory. */
export const isWornMagicItem = (itemId) => WORN_BY_ID.has(itemId);

export const wornMagicItemById = (itemId) => WORN_BY_ID.get(itemId) || null;

/** The effect objects for every accessory a character currently has worn. */
const wornEffects = (character) =>
  (Array.isArray(character?.worn) ? character.worn : [])
    .map((itemId) => WORN_BY_ID.get(itemId)?.effect)
    .filter(Boolean);

/** A non-negative "+X" enchantment stored for a specific owned item id. */
export function enchantmentBonus(character, itemId) {
  if (!itemId) return 0;
  return Math.max(0, Number(character?.enchantments?.[itemId]) || 0);
}

/**
 * Total Armor Class bonus from magic gear: the "+X" on equipped magic armor and
 * shield, plus any worn accessories that raise AC. Bracers of Defense only apply
 * when the wearer has no armor and no shield.
 */
export function armorClassMagicBonus(character) {
  const wearingArmor = !!character?.armor;
  const wearingShield = !!character?.shield;
  let total = wearingArmor ? enchantmentBonus(character, character.armor) : 0;
  if (wearingShield) total += enchantmentBonus(character, "shield");
  for (const effect of wornEffects(character)) {
    if (!effect.ac) continue;
    if (effect.requiresNoArmorOrShield && (wearingArmor || wearingShield))
      continue;
    total += effect.ac;
  }
  return total;
}

/**
 * Flat attack and damage bonuses when attacking with the given weapon: the
 * weapon's own "+X" enchantment (adds to both attack and damage) plus any worn
 * accessories (e.g. Ioun Stone of Mastery attack, Bracers of Archery ranged
 * damage).
 */
export function weaponMagicBonuses(character, weapon) {
  if (!weapon) return { attack: 0, damage: 0 };
  const plus = enchantmentBonus(character, weapon.id);
  let attack = plus;
  let damage = plus;
  for (const effect of wornEffects(character)) {
    if (effect.attack) attack += effect.attack;
    if (effect.rangedDamage && weapon.rangeType === "ranged")
      damage += effect.rangedDamage;
  }
  return { attack, damage };
}

/** Total saving-throw bonus from worn accessories (not yet used in combat). */
export function saveMagicBonus(character) {
  return wornEffects(character).reduce(
    (total, effect) => total + (effect.save || 0),
    0,
  );
}
