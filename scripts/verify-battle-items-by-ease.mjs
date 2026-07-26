import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const dataDirectory = path.join(projectRoot, "DND 5E Data");
const battleDirectory = path.join(dataDirectory, "BATTLE");
const easeDirectory = path.join(battleDirectory, "Ease");
const sourcePath = path.join(easeDirectory, "all_battle_items.json");
const outputRoot = path.join(easeDirectory, "BATTLE_BY_EASE");
const guidePath = path.join(outputRoot, "MAGIC_ITEM_EASE_GUIDE.txt");
const fileSystemPath = path.join(outputRoot, "MAGIC_ITEM_EASE_FILE_SYSTEM.txt");

const tierFiles = [
  ["1_TRIVIAL", "tier_1_trivial_items.json"],
  ["2_EASY", "tier_2_easy_items.json"],
  ["3_MODERATE", "tier_3_moderate_items.json"],
  ["4_HARD_DYNAMIC", "tier_4_hard_dynamic_items.json"]
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalJsonText(records) {
  return `${JSON.stringify(records, null, 2)}\n`;
}

const sourceText = fs.readFileSync(sourcePath, "utf8");
const sourceItems = JSON.parse(sourceText);
assert(sourceItems.length === 249, `The Ease source has ${sourceItems.length} records instead of 249.`);
assert(sourceText === canonicalJsonText(sourceItems), "The Ease source JSON formatting is not canonical.");

const sourceByIndex = new Map(sourceItems.map((item) => [item.index, item]));
assert(sourceByIndex.size === sourceItems.length, "The Ease source contains duplicate indexes.");

const immediateBattleJsonFiles = fs.readdirSync(battleDirectory).filter((name) => name.endsWith(".json"));
assert(immediateBattleJsonFiles.length === 40, "One or more pre-existing BATTLE JSON category files were removed.");

const nonBattleIndexes = new Set();
for (const fileName of fs.readdirSync(path.join(dataDirectory, "NON BATTLE")).filter((name) => name.endsWith(".json"))) {
  const records = JSON.parse(fs.readFileSync(path.join(dataDirectory, "NON BATTLE", fileName), "utf8"));
  for (const item of records) nonBattleIndexes.add(item.index);
}

const assignedTierByIndex = new Map();
const recordsByTier = new Map();
const tierCounts = {};

for (const [tierDirectoryName, fileName] of tierFiles) {
  const tierDirectory = path.join(outputRoot, tierDirectoryName);
  const actualJsonFiles = fs.readdirSync(tierDirectory).filter((name) => name.endsWith(".json"));
  assert(actualJsonFiles.length === 1 && actualJsonFiles[0] === fileName, `${tierDirectoryName} does not contain exactly its expected JSON file.`);

  const filePath = path.join(tierDirectory, fileName);
  const fileText = fs.readFileSync(filePath, "utf8");
  const records = JSON.parse(fileText);
  assert(Array.isArray(records), `${tierDirectoryName}/${fileName} is not a JSON array.`);
  assert(records.length > 0, `${tierDirectoryName}/${fileName} is empty.`);
  assert(fileText === canonicalJsonText(records), `${tierDirectoryName}/${fileName} does not preserve canonical JSON formatting.`);

  const expectedSourceOrder = sourceItems.filter((item) => records.some((record) => record.index === item.index));
  assert(
    expectedSourceOrder.every((item, position) => records[position]?.index === item.index),
    `${tierDirectoryName}/${fileName} does not preserve original BATTLE source order.`
  );

  for (const item of records) {
    assert(sourceByIndex.has(item.index), `${tierDirectoryName} contains an item absent from the 249 BATTLE source: ${item.index}.`);
    assert(!nonBattleIndexes.has(item.index), `${tierDirectoryName} contains NON BATTLE item ${item.index}.`);
    assert(!assignedTierByIndex.has(item.index), `${item.index} appears in both ${assignedTierByIndex.get(item.index)} and ${tierDirectoryName}.`);
    assert(JSON.stringify(item) === JSON.stringify(sourceByIndex.get(item.index)), `${tierDirectoryName} changes source record ${item.index}.`);
    assignedTierByIndex.set(item.index, tierDirectoryName);
  }

  recordsByTier.set(tierDirectoryName, records);
  tierCounts[tierDirectoryName] = records.length;
}

const missingItems = sourceItems.filter((item) => !assignedTierByIndex.has(item.index));
assert(missingItems.length === 0, `BATTLE records missing from all Ease tiers: ${missingItems.map((item) => item.index).join(", ")}`);
assert(assignedTierByIndex.size === 249, `The Ease tiers contain ${assignedTierByIndex.size} unique records instead of 249.`);

const guideText = fs.readFileSync(guidePath, "utf8");
assert(guideText.endsWith("\n"), "MAGIC_ITEM_EASE_GUIDE.txt has no final newline.");
assert(guideText.includes("The single most-demanding effect decides the tier."), "The guide omits the most-demanding-effect rule.");
const tierDefinitionFragments = ["TRIVIAL", "EASY", "MODERATE", "HARD / DYNAMIC"];
for (const [position, [tierDirectoryName]] of tierFiles.entries()) {
  assert(guideText.includes(tierDefinitionFragments[position]), `The guide omits the definition for ${tierDirectoryName}.`);
}

const guideLines = guideText.split("\n");
for (const [tierDirectoryName] of tierFiles) {
  const records = recordsByTier.get(tierDirectoryName);
  const expectedNameCounts = new Map();
  for (const item of records) expectedNameCounts.set(item.name, (expectedNameCounts.get(item.name) ?? 0) + 1);
  for (const [itemName, expectedCount] of expectedNameCounts) {
    const actualCount = guideLines.filter((line) => line.startsWith(`${itemName} - `)).length;
    assert(actualCount === expectedCount, `The guide has ${actualCount} reason lines for ${itemName}; expected ${expectedCount}.`);
  }
}
const guideReasonLineCount = guideLines.filter((line) => sourceItems.some((item) => line.startsWith(`${item.name} - `))).length;
assert(guideReasonLineCount === 249, `The guide contains ${guideReasonLineCount} per-item reason lines instead of 249.`);

const fileSystemText = fs.readFileSync(fileSystemPath, "utf8");
assert(fileSystemText.endsWith("\n"), "MAGIC_ITEM_EASE_FILE_SYSTEM.txt has no final newline.");
assert(!fileSystemText.includes("\n\n"), "The Ease file-system tree contains unnecessary blank lines.");
assert(!fileSystemText.includes("\t"), "The Ease file-system tree contains tabs.");

const fileSystemLines = fileSystemText.split("\n").filter(Boolean);
const allowedTreeLines = new Set([
  "BATTLE_BY_EASE",
  ...tierFiles.flatMap(([tierDirectoryName, fileName]) => [tierDirectoryName, fileName]),
  ...sourceItems.map((item) => item.name)
]);
for (const line of fileSystemLines) {
  assert(allowedTreeLines.has(line.trim()), `Unexpected text in compact Ease file-system tree: ${line.trim()}`);
}
for (const [tierDirectoryName, fileName] of tierFiles) {
  assert(fileSystemLines.some((line) => line.trim() === tierDirectoryName), `File-system tree omits ${tierDirectoryName}.`);
  assert(fileSystemLines.some((line) => line.trim() === fileName), `File-system tree omits ${fileName}.`);
}
for (const item of sourceItems) {
  const expectedCount = sourceItems.filter((candidate) => candidate.name === item.name).length;
  const actualCount = fileSystemLines.filter((line) => line.trim() === item.name).length;
  assert(actualCount === expectedCount, `File-system tree has ${actualCount} entries for ${item.name}; expected ${expectedCount}.`);
}

console.log(JSON.stringify({
  tierCounts,
  grandTotal: assignedTierByIndex.size,
  missingBattleRecords: missingItems.length,
  duplicateAcrossTiers: 0,
  nonBattleLeakage: 0,
  preservedBattleCategoryFiles: immediateBattleJsonFiles.length,
  objectIdentity: "verified",
  jsonFormatting: "verified",
  guideReasonLines: guideReasonLineCount,
  compactTree: "verified"
}, null, 2));
