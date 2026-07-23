import test from "node:test";
import assert from "node:assert/strict";
import {
  changeInventoryQuantity,
  filterCatalog,
  inventoryItemIds,
  normalizeInventory,
} from "./items.js";

test("legacy string inventories migrate and merge safely", () => {
  assert.deepEqual(
    normalizeInventory(["club", "club", { itemId: "dagger", quantity: 2 }]),
    [
      { itemId: "club", quantity: 2 },
      { itemId: "dagger", quantity: 2 },
    ],
  );
});

test("inventory quantities can grow and remove at zero", () => {
  const added = changeInventoryQuantity([], "club", 2);
  assert.deepEqual(added, [{ itemId: "club", quantity: 2 }]);
  assert.deepEqual(changeInventoryQuantity(added, "club", -2), []);
});

test("catalog search and inventory ids are generic", () => {
  assert.equal(filterCatalog("slashing", "weapon").length, 2);
  assert.deepEqual(inventoryItemIds([{ itemId: "shortbow", quantity: 3 }]), [
    "shortbow",
  ]);
});
