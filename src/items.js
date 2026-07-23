import { WEAPONS } from "./weapons.js";

/** Generic catalog shape. More SRD equipment can be appended without changing inventory UI. */
export const ITEM_CATALOG = WEAPONS.map((weapon) => ({
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

export const ITEM_TYPES = [
  { id: "all", label: "All items" },
  { id: "weapon", label: "Weapons" },
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

export function filterCatalog(query = "", type = "all") {
  const needle = query.trim().toLowerCase();
  return ITEM_CATALOG.filter(
    (item) =>
      (type === "all" || item.kind === type) &&
      (!needle || item.searchText.includes(needle)),
  );
}
