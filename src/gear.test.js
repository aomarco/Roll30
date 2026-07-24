import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GEAR, gearById } from "./gear.js";
import { filterCatalog } from "./items.js";

const srd = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../DND 5E Data/5e-SRD-Equipment.json", import.meta.url)),
    "utf8",
  ),
);

test("gear imports every non-weapon/armor SRD item except imported ammunition", () => {
  const expected = srd.filter(
    (item) =>
      !["weapon", "armor"].includes(item.equipment_category.index) &&
      !["arrow", "crossbow-bolt", "sling-bullet", "blowgun-needle"].includes(
        item.index,
      ),
  );
  assert.equal(GEAR.length, expected.length);
  assert.equal(GEAR.length, 183);
});

test("a known gear item matches the SRD source", () => {
  const abacus = gearById("abacus");
  assert.equal(abacus.name, "Abacus");
  assert.equal(abacus.gearCategory, "standard-gear");
  assert.deepEqual(abacus.cost, { quantity: 2, unit: "gp" });
  assert.equal(abacus.weight, 2);
});

test("mounts derive gearCategory from equipment_category", () => {
  const camel = gearById("camel");
  assert.equal(camel.gearCategory, "mounts-and-vehicles");
});

test("gearById returns null for unknown ids", () => {
  assert.equal(gearById("nope"), null);
});

test("filterCatalog gear type returns only gear", () => {
  const results = filterCatalog("", "gear");
  assert.equal(results.length, GEAR.length);
  assert.ok(results.every((item) => item.kind === "gear"));
});

test("a gear class filter narrows results to one category label", () => {
  const tools = filterCatalog("", "gear", { category: "Tool" });
  assert.ok(tools.length > 0);
  assert.ok(tools.every((item) => item.gearCategory === "tools"));
});
