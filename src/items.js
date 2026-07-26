import { AMMUNITION, ARMOR, WEAPONS } from "./weapons.js";
import { GEAR } from "./gear.js";
import { MAGIC_ITEMS } from "./magicItems.js";
import { WORN_MAGIC_ITEMS } from "./magicBonuses.js";

/** Human-readable label for a gear category id. */
const GEAR_CATEGORY_LABELS = {
  "standard-gear": "Gear",
  "holy-symbols": "Holy Symbol",
  "arcane-foci": "Arcane Focus",
  "druidic-foci": "Druidic Focus",
  kits: "Kit",
  "equipment-packs": "Pack",
  tools: "Tool",
  "mounts-and-vehicles": "Mount / Vehicle",
};

const gearLabel = (category) => GEAR_CATEGORY_LABELS[category] || "Gear";

/** Generic catalog shape. More SRD equipment can be appended without changing inventory UI. */
const WEAPON_ITEMS = WEAPONS.map((weapon) => ({
  ...weapon,
  kind: "weapon",
  typeLabel: "Weapon",
  searchText: [
    weapon.name,
    weapon.category,
    ...(weapon.properties || []),
    weapon.damageType,
    weapon.damageDice,
    weapon.cost && `${weapon.cost.quantity} ${weapon.cost.unit}`,
  ]
    .join(" ")
    .toLowerCase(),
}));

const AMMUNITION_ITEMS = AMMUNITION.map((ammo) => ({
  ...ammo,
  kind: "ammunition",
  typeLabel: "Ammunition",
  category: "Ammunition",
  searchText: [
    ammo.name,
    "ammunition",
    ammo.cost && `${ammo.cost.quantity} ${ammo.cost.unit}`,
  ]
    .join(" ")
    .toLowerCase(),
}));

const ARMOR_ITEMS = ARMOR.map((armor) => ({
  ...armor,
  kind: "armor",
  typeLabel: armor.category === "Shield" ? "Shield" : "Armour",
  searchText: [
    armor.name,
    "armour armor",
    armor.category,
    armor.cost && `${armor.cost.quantity} ${armor.cost.unit}`,
  ]
    .join(" ")
    .toLowerCase(),
}));

const GEAR_ITEMS = GEAR.map((item) => ({
  ...item,
  kind: "gear",
  category: item.gearCategory,
  typeLabel: gearLabel(item.gearCategory),
  searchText: [
    item.name,
    "gear equipment",
    item.gearCategory.replace(/-/g, " "),
    item.cost && `${item.cost.quantity} ${item.cost.unit}`,
  ]
    .join(" ")
    .toLowerCase(),
}));

// Non-battle magic items: inert catalog entries that do nothing in combat and
// simply sit in a token's or character's inventory.
const MAGIC_ITEM_ITEMS = MAGIC_ITEMS.map((item) => ({
  ...item,
  kind: "magic-item",
  typeLabel: "Magic Item",
  category: item.rarity,
  searchText: [item.name, "magic item", item.rarity, item.itemCategory]
    .join(" ")
    .toLowerCase(),
}));

// Tier 1 functional magic items: worn accessories that grant flat combat
// bonuses (unlike the inert MAGIC_ITEMS above). Carried in the catalog so they
// can be bought/added like any other item; their bonuses live in magicBonuses.
const WORN_MAGIC_ITEM_ITEMS = WORN_MAGIC_ITEMS.map((item) => ({
  id: item.id,
  name: item.name,
  rarity: item.rarity,
  itemCategory: item.itemCategory,
  kind: "magic-item",
  typeLabel: "Magic Item",
  category: item.rarity,
  worn: true,
  searchText: [item.name, "magic item", item.rarity, item.itemCategory]
    .join(" ")
    .toLowerCase(),
}));

export const ITEM_CATALOG = [
  ...WEAPON_ITEMS,
  ...AMMUNITION_ITEMS,
  ...ARMOR_ITEMS,
  ...GEAR_ITEMS,
  ...MAGIC_ITEM_ITEMS,
  ...WORN_MAGIC_ITEM_ITEMS,
];

export const ITEM_TYPES = [
  { id: "all", label: "All items" },
  { id: "weapon", label: "Weapons" },
  { id: "ammunition", label: "Ammunition" },
  { id: "armor", label: "Armour" },
  { id: "gear", label: "Gear" },
  { id: "magic-item", label: "Magic Items" },
];

export function normalizeInventory(inventory = []) {
  const quantities = new Map();
  for (const entry of Array.isArray(inventory) ? inventory : []) {
    const itemId =
      typeof entry === "string" ? entry : entry?.itemId || entry?.id;
    if (!itemId) continue;
    const quantity =
      typeof entry === "string"
        ? 1
        : Math.max(1, Math.floor(Number(entry.quantity) || 1));
    quantities.set(itemId, (quantities.get(itemId) || 0) + quantity);
  }
  return [...quantities].map(([itemId, quantity]) => ({ itemId, quantity }));
}

export function inventoryQuantity(inventory, itemId) {
  return (
    normalizeInventory(inventory).find((entry) => entry.itemId === itemId)
      ?.quantity || 0
  );
}

export function changeInventoryQuantity(inventory, itemId, amount) {
  const normalized = normalizeInventory(inventory);
  const existing = normalized.find((entry) => entry.itemId === itemId);
  const nextQuantity = (existing?.quantity || 0) + amount;
  if (nextQuantity <= 0)
    return normalized.filter((entry) => entry.itemId !== itemId);
  if (existing)
    return normalized.map((entry) =>
      entry.itemId === itemId ? { ...entry, quantity: nextQuantity } : entry,
    );
  return [...normalized, { itemId, quantity: nextQuantity }];
}

export function removeInventoryItem(inventory, itemId) {
  return normalizeInventory(inventory).filter(
    (entry) => entry.itemId !== itemId,
  );
}

export function inventoryItemIds(inventory) {
  return normalizeInventory(inventory).map((entry) => entry.itemId);
}

/** Ammunition is bought and adjusted a bundle at a time; weapons step by one. */
export function bundleSize(itemId) {
  const item = ITEM_CATALOG.find((candidate) => candidate.id === itemId);
  return item?.kind === "ammunition" ? item.bundle : 1;
}

/** Filter option lists for the item catalog UI. */
export const WEAPON_CLASSES = ["Simple", "Martial"];
export const ARMOR_CLASSES = ["Light", "Medium", "Heavy", "Shield"];
// Distinct gear labels, in the catalog's natural category order.
export const GEAR_CLASSES = [
  ...new Set(GEAR_ITEMS.map((item) => item.typeLabel)),
];
// Magic items filter by rarity, in ascending order (only those present).
export const MAGIC_ITEM_CLASSES = [
  "Common",
  "Uncommon",
  "Rare",
  "Very Rare",
  "Legendary",
  "Artifact",
  "Varies",
].filter((rarity) =>
  [...MAGIC_ITEM_ITEMS, ...WORN_MAGIC_ITEM_ITEMS].some(
    (item) => item.rarity === rarity,
  ),
);
export const WEAPON_PROPERTIES = [
  ...new Set(WEAPONS.flatMap((weapon) => weapon.properties || [])),
].sort();
// Distinct weapon damage types, for the damage-type filter.
export const DAMAGE_TYPES = [
  ...new Set(WEAPONS.map((weapon) => weapon.damageType).filter(Boolean)),
].sort();
// Reach bands a weapon can be filtered by.
export const RANGE_BANDS = [
  { id: "melee", label: "Melee" },
  { id: "ranged", label: "Ranged" },
  { id: "thrown", label: "Thrown" },
];
export const SORT_OPTIONS = [
  { id: "name", label: "Name (A–Z)" },
  { id: "cost-asc", label: "Cost (low→high)" },
  { id: "cost-desc", label: "Cost (high→low)" },
];

/** A single currency unit in copper pieces, for cost comparisons. */
const COIN_IN_CP = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
const costInCopper = (item) =>
  item?.cost
    ? (Number(item.cost.quantity) || 0) * (COIN_IN_CP[item.cost.unit] || 0)
    : -1; // items without a listed cost (e.g. magic items) sort last/first cleanly

/** How a weapon can be reached with: melee, ranged, or thrown. */
const weaponRangeBand = (item) =>
  item.kind !== "weapon"
    ? null
    : (item.properties || []).includes("Thrown")
      ? "thrown"
      : item.rangeType === "ranged"
        ? "ranged"
        : "melee";

/** The class/category a catalog item belongs to, for filtering. */
const itemClass = (item) =>
  item.kind === "weapon"
    ? item.weaponCategory
    : item.kind === "armor"
      ? item.category
      : item.kind === "gear"
        ? item.typeLabel
        : item.kind === "magic-item"
          ? item.rarity
          : null;

export function filterCatalog(query = "", type = "all", filters = {}) {
  const needle = query.trim().toLowerCase();
  const {
    category = "all",
    property = "all",
    damageType = "all",
    range = "all",
    sort = "name",
  } = filters;
  const results = ITEM_CATALOG.filter((item) => {
    if (type !== "all" && item.kind !== type) return false;
    if (needle && !item.searchText.includes(needle)) return false;
    if (category !== "all" && itemClass(item) !== category) return false;
    if (property !== "all" && !(item.properties || []).includes(property))
      return false;
    if (damageType !== "all" && item.damageType !== damageType) return false;
    if (range !== "all" && weaponRangeBand(item) !== range) return false;
    return true;
  });
  if (sort === "cost-asc" || sort === "cost-desc") {
    const dir = sort === "cost-asc" ? 1 : -1;
    results.sort((a, b) => {
      const diff = costInCopper(a) - costInCopper(b);
      return diff !== 0 ? diff * dir : a.name.localeCompare(b.name);
    });
  } else if (sort === "name") {
    results.sort((a, b) => a.name.localeCompare(b.name));
  }
  return results;
}
