import { AMMUNITION, ARMOR, WEAPONS } from "./weapons.js";

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

export const ITEM_CATALOG = [
  ...WEAPON_ITEMS,
  ...AMMUNITION_ITEMS,
  ...ARMOR_ITEMS,
];

export const ITEM_TYPES = [
  { id: "all", label: "All items" },
  { id: "weapon", label: "Weapons" },
  { id: "ammunition", label: "Ammunition" },
  { id: "armor", label: "Armour" },
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
export const WEAPON_PROPERTIES = [
  ...new Set(WEAPONS.flatMap((weapon) => weapon.properties || [])),
].sort();

/** The class/category a catalog item belongs to, for filtering. */
const itemClass = (item) =>
  item.kind === "weapon"
    ? item.weaponCategory
    : item.kind === "armor"
      ? item.category
      : null;

export function filterCatalog(query = "", type = "all", filters = {}) {
  const needle = query.trim().toLowerCase();
  const { category = "all", property = "all" } = filters;
  return ITEM_CATALOG.filter((item) => {
    if (type !== "all" && item.kind !== type) return false;
    if (needle && !item.searchText.includes(needle)) return false;
    if (category !== "all" && itemClass(item) !== category) return false;
    if (property !== "all" && !(item.properties || []).includes(property))
      return false;
    return true;
  });
}
