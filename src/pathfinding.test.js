import test from "node:test";
import assert from "node:assert/strict";
import { findPath } from "./pathfinding.js";

test("findPath returns a direct diagonal when nothing blocks", () => {
  const path = findPath({ x: 0, y: 0 }, { x: 3, y: 3 });
  assert.equal(path[0].x, 0);
  assert.deepEqual(path[path.length - 1], { x: 3, y: 3 });
  // 8-directional: a clear 3x3 diagonal is 3 steps (4 cells incl. start).
  assert.equal(path.length, 4);
});

test("findPath routes around a blocking wall of cells", () => {
  // A vertical barrier at x=2 for y in 0..4, with a gap missing at y=5 area.
  const blocked = new Set(["2,0", "2,1", "2,2", "2,3", "2,4"]);
  const passable = (_from, to) => !blocked.has(`${to.x},${to.y}`);
  const path = findPath({ x: 0, y: 2 }, { x: 4, y: 2 }, { passable });
  assert.ok(path, "a detour path should exist");
  assert.deepEqual(path[path.length - 1], { x: 4, y: 2 });
  // It must never step onto a blocked cell.
  assert.ok(path.every((c) => !blocked.has(`${c.x},${c.y}`)));
  // And it must be longer than the straight-line distance (it went around).
  assert.ok(path.length - 1 > 4);
});

test("findPath returns null when the goal is walled off", () => {
  // Fully enclose the goal cell.
  const blocked = new Set(["4,1", "4,3", "3,2", "5,2", "3,1", "5,1", "3,3", "5,3"]);
  const passable = (_from, to) => !blocked.has(`${to.x},${to.y}`);
  assert.equal(findPath({ x: 0, y: 2 }, { x: 4, y: 2 }, { passable }), null);
});

test("findPath returns just the start when already at the goal", () => {
  assert.deepEqual(findPath({ x: 1, y: 1 }, { x: 1, y: 1 }), [{ x: 1, y: 1 }]);
});
