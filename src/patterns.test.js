import test from "node:test";
import assert from "node:assert/strict";
import { patternCells } from "./patterns.js";

const atCenter = (type, level) => patternCells(type, level)
  .map(({ x, y }) => `${x + 5},${y + 5}`)
  .sort();
const expected = (coordinates) => coordinates.map(([x, y]) => `${x},${y}`).sort();

const cases = [
  ["square", 1, [[4,4],[4,5],[4,6],[5,4],[5,6],[6,4],[6,5],[6,6]]],
  ["square", 2, [[3,3],[3,4],[3,5],[3,6],[3,7],[4,3],[4,4],[4,5],[4,6],[4,7],[5,3],[5,4],[5,6],[5,7],[6,3],[6,4],[6,5],[6,6],[6,7],[7,3],[7,4],[7,5],[7,6],[7,7]]],
  ["diamond", 1, [[4,5],[5,4],[5,6],[6,5]]],
  ["diamond", 2, [[3,5],[4,4],[4,5],[4,6],[5,3],[5,4],[5,6],[5,7],[6,4],[6,5],[6,6],[7,5]]],
  ["plus", 1, [[3,5],[4,5],[5,3],[5,4],[5,6],[5,7],[6,5],[7,5]]],
  ["plus", 2, [[2,5],[3,5],[4,5],[5,2],[5,3],[5,4],[5,6],[5,7],[5,8],[6,5],[7,5],[8,5]]],
  ["star", 1, [[3,3],[3,5],[3,7],[4,4],[4,5],[4,6],[5,3],[5,4],[5,6],[5,7],[6,4],[6,5],[6,6],[7,3],[7,5],[7,7]]],
  ["star", 2, [[2,2],[2,5],[2,8],[3,3],[3,5],[3,7],[4,4],[4,5],[4,6],[5,2],[5,3],[5,4],[5,6],[5,7],[5,8],[6,4],[6,5],[6,6],[7,3],[7,5],[7,7],[8,2],[8,5],[8,8]]],
];

for (const [type, level, coordinates] of cases) {
  test(`${type}:${level} matches supplied coordinates`, () => {
    assert.deepEqual(atCenter(type, level), expected(coordinates));
  });
}
