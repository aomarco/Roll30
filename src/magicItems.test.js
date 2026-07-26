import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import { MAGIC_ITEMS, magicItemById } from "./magicItems.js";
import { filterCatalog } from "./items.js";

// The generated catalog must exactly match the unique indexes the classifier
// placed in the NON BATTLE folder.
const nonBattleDir = fileURLToPath(
  new URL("../DND 5E Data/NON BATTLE", import.meta.url),
);
const nonBattleIndexes = new Set();
for (const file of readdirSync(nonBattleDir).filter((f) => f.endsWith(".json"))) {
  const records = JSON.parse(readFileSync(`${nonBattleDir}/${file}`, "utf8"));
  for (const record of records) nonBattleIndexes.add(record.index);
}

test("magic items import exactly the unique NON BATTLE set", () => {
  assert.equal(MAGIC_ITEMS.length, nonBattleIndexes.size);
  assert.equal(MAGIC_ITEMS.length, 113);
  assert.deepEqual(
    new Set(MAGIC_ITEMS.map((item) => item.id)),
    nonBattleIndexes,
  );
});

test("a known magic item carries name, rarity, and category", () => {
  const bag = magicItemById("bag-of-holding");
  assert.equal(bag.name, "Bag of Holding");
  assert.equal(bag.rarity, "Uncommon");
  assert.equal(bag.itemCategory, "Wondrous Items");
});

test("magicItemById returns null for unknown ids", () => {
  assert.equal(magicItemById("nope"), null);
});

test("filterCatalog magic-item type returns only inert magic items", () => {
  const results = filterCatalog("", "magic-item");
  assert.equal(results.length, MAGIC_ITEMS.length);
  assert.ok(results.every((item) => item.kind === "magic-item"));
  // Inert: no combat fields that the attack/AC engines read.
  assert.ok(
    results.every(
      (item) =>
        item.damageDice === undefined &&
        item.acBase === undefined &&
        item.rangeFeet === undefined,
    ),
  );
});

test("a rarity class filter narrows magic items to one rarity", () => {
  const legendary = filterCatalog("", "magic-item", { category: "Legendary" });
  assert.ok(legendary.length > 0);
  assert.ok(legendary.every((item) => item.rarity === "Legendary"));
});
