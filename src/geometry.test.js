import test from "node:test";
import assert from "node:assert/strict";
import { lineOfSight, segmentHitsWalls, segmentsIntersect } from "./geometry.js";

test("segmentsIntersect detects a proper crossing and rejects near-misses", () => {
  // Clear X crossing.
  assert.equal(
    segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    true,
  );
  // Parallel, no crossing.
  assert.equal(
    segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }),
    false,
  );
  // Endpoint merely touching counts as non-crossing.
  assert.equal(
    segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }),
    false,
  );
});

const wallFull = { type: "full", points: [{ x: 5, y: 0 }, { x: 5, y: 10 }] };
const wallHalf = { type: "half", points: [{ x: 8, y: 0 }, { x: 8, y: 10 }] };

test("segmentHitsWalls reports which wall types a segment crosses", () => {
  assert.deepEqual(
    segmentHitsWalls([wallFull], { x: 0, y: 5 }, { x: 10, y: 5 }),
    { full: true, half: false },
  );
  assert.deepEqual(
    segmentHitsWalls([wallHalf], { x: 0, y: 5 }, { x: 10, y: 5 }),
    { full: false, half: true },
  );
  assert.deepEqual(
    segmentHitsWalls([wallFull, wallHalf], { x: 0, y: 5 }, { x: 3, y: 5 }),
    { full: false, half: false },
  );
});

test("lineOfSight blocks on a full wall and gives disadvantage on a half wall", () => {
  assert.deepEqual(lineOfSight([wallFull], { x: 0, y: 5 }, { x: 10, y: 5 }), {
    blocked: true,
    disadvantage: false,
  });
  assert.deepEqual(lineOfSight([wallHalf], { x: 0, y: 5 }, { x: 10, y: 5 }), {
    blocked: false,
    disadvantage: true,
  });
  // A full wall behind a half wall still just blocks (no double-count).
  assert.deepEqual(
    lineOfSight([wallFull, wallHalf], { x: 0, y: 5 }, { x: 10, y: 5 }),
    { blocked: true, disadvantage: false },
  );
  assert.deepEqual(lineOfSight([], { x: 0, y: 0 }, { x: 10, y: 10 }), {
    blocked: false,
    disadvantage: false,
  });
});
