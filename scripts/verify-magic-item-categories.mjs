import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const dataDirectory = path.join(projectRoot, "DND 5E Data");
const sourcePath = path.join(dataDirectory, "5e-SRD-Magic-Items.json");
const guidePath = path.join(dataDirectory, "MAGIC_ITEM_CATEGORY_GUIDE.txt");
const fileSystemPath = path.join(dataDirectory, "MAGIC_ITEM_FILE_SYSTEM.txt");

const expectedFileCounts = {
  BATTLE: 39,
  "NON BATTLE": 44
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function jsonFiles(directory) {
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort();
}

const sourceText = fs.readFileSync(sourcePath, "utf8");
const sourceItems = JSON.parse(sourceText);
assert(sourceText === `${JSON.stringify(sourceItems, null, 2)}\n`, "Source JSON formatting changed or is invalid.");

const sourceByIndex = new Map(sourceItems.map((item) => [item.index, item]));
assert(sourceByIndex.size === sourceItems.length, "Source indexes are not unique.");

const unionByMain = {
  BATTLE: new Set(),
  "NON BATTLE": new Set()
};
const allCategoryNames = new Set();
let totalAssignments = 0;
let totalFiles = 0;

for (const main of ["BATTLE", "NON BATTLE"]) {
  const directory = path.join(dataDirectory, main);
  const files = jsonFiles(directory);
  assert(files.length === expectedFileCounts[main], `${main} has ${files.length} JSON files instead of ${expectedFileCounts[main]}.`);
  totalFiles += files.length;

  for (const fileName of files) {
    const categoryName = path.basename(fileName, ".json");
    allCategoryNames.add(categoryName.replaceAll("_", " ").toUpperCase());
    const filePath = path.join(directory, fileName);
    const fileText = fs.readFileSync(filePath, "utf8");
    const records = JSON.parse(fileText);

    assert(Array.isArray(records), `${main}/${fileName} is not a JSON array.`);
    assert(records.length > 0, `${main}/${fileName} is empty.`);
    assert(fileText === `${JSON.stringify(records, null, 2)}\n`, `${main}/${fileName} does not match source JSON formatting.`);

    const indexesInFile = new Set();
    for (const record of records) {
      assert(sourceByIndex.has(record.index), `${main}/${fileName} contains unknown index ${record.index}.`);
      assert(!indexesInFile.has(record.index), `${main}/${fileName} repeats index ${record.index}.`);
      assert(
        JSON.stringify(record) === JSON.stringify(sourceByIndex.get(record.index)),
        `${main}/${fileName} changes source object ${record.index}.`
      );
      indexesInFile.add(record.index);
      unionByMain[main].add(record.index);
      totalAssignments += 1;
    }
  }
}

const crossMainIndexes = [...unionByMain.BATTLE].filter((index) => unionByMain["NON BATTLE"].has(index));
assert(crossMainIndexes.length === 0, `Indexes occur in both main folders: ${crossMainIndexes.join(", ")}`);

const coveredIndexes = new Set([...unionByMain.BATTLE, ...unionByMain["NON BATTLE"]]);
const missingIndexes = sourceItems.filter((item) => !coveredIndexes.has(item.index)).map((item) => item.index);
assert(missingIndexes.length === 0, `Source indexes missing from all categories: ${missingIndexes.join(", ")}`);
assert(coveredIndexes.size === sourceItems.length, "Category coverage does not equal source coverage.");

const guideText = fs.readFileSync(guidePath, "utf8");
assert(guideText.endsWith("\n"), "The category guide has no final newline.");
const guideLines = new Set(guideText.split("\n"));
for (const categoryTitle of allCategoryNames) {
  assert(guideLines.has(categoryTitle), `The category guide does not explain ${categoryTitle}.`);
}
for (const item of sourceItems) {
  assert(!guideLines.has(item.name), `The category guide contains an item-list entry for ${item.name}.`);
}

const fileSystemText = fs.readFileSync(fileSystemPath, "utf8");
assert(fileSystemText.endsWith("\n"), "The item-location tree has no final newline.");
assert(!fileSystemText.includes("\t"), "The item-location tree contains tabs instead of compact spaces.");
assert(!fileSystemText.includes("\n\n"), "The item-location tree contains unnecessary blank lines.");

const fileSystemTrimmedLines = new Set(fileSystemText.split("\n").map((line) => line.trim()).filter(Boolean));
for (const main of ["BATTLE", "NON BATTLE"]) {
  assert(fileSystemTrimmedLines.has(main), `The item-location tree is missing ${main}.`);
}
for (const categoryTitle of allCategoryNames) {
  assert(fileSystemTrimmedLines.has(categoryTitle), `The item-location tree is missing category ${categoryTitle}.`);
}
for (const item of sourceItems) {
  assert(fileSystemTrimmedLines.has(item.name), `The item-location tree is missing item name ${item.name}.`);
}

const allowedGroupNames = new Set([
  "ITEM FORMS",
  "OFFENSE",
  "DEFENSE AND RECOVERY",
  "CONTROL",
  "ENHANCEMENT AND TACTICS",
  "STORAGE AND ITEM FORMS",
  "TRAVEL",
  "STEALTH AND INFORMATION",
  "SOCIAL AND SURVIVAL",
  "CREATION AND UTILITY MAGIC",
  "ACCESS, SAFETY, AND UNUSUAL MAGIC"
]);
const allowedTreeContent = new Set([
  "BATTLE",
  "NON BATTLE",
  ...allowedGroupNames,
  ...allCategoryNames,
  ...sourceItems.map((item) => item.name)
]);
for (const line of fileSystemText.split("\n").filter(Boolean)) {
  assert(allowedTreeContent.has(line.trim()), `Unexpected text in compact item-location tree: ${line.trim()}`);
}

console.log(JSON.stringify({
  sourceRecords: sourceItems.length,
  battleRecords: unionByMain.BATTLE.size,
  nonBattleRecords: unionByMain["NON BATTLE"].size,
  categoryFiles: totalFiles,
  totalSubcategoryAssignments: totalAssignments,
  crossMainRecords: crossMainIndexes.length,
  missingSourceRecords: missingIndexes.length,
  objectIdentity: "verified",
  jsonFormatting: "verified",
  guideCoverage: "verified",
  compactTreeCoverage: "verified"
}, null, 2));
