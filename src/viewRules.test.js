import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CAMERA,
  MAX_MAP_SCALE,
  MAX_ZOOM,
  MIN_MAP_SCALE,
  MIN_ZOOM,
  clampMapScale,
  clampZoom,
  panBy,
  zoomToPoint,
} from "./viewRules.js";

test("clampZoom keeps zoom within bounds", () => {
  assert.equal(clampZoom(1), 1);
  assert.equal(clampZoom(10), MAX_ZOOM);
  assert.equal(clampZoom(0.01), MIN_ZOOM);
  assert.equal(clampZoom(NaN), 1);
});

test("zoomToPoint keeps the world point under the cursor fixed", () => {
  const point = { x: 300, y: 200 };
  const before = zoomToPoint(DEFAULT_CAMERA, point, 2);
  // World coordinate under the cursor = (screen - pan) / zoom. It must be the
  // same before and after the zoom.
  const worldBefore = {
    x: (point.x - DEFAULT_CAMERA.x) / DEFAULT_CAMERA.zoom,
    y: (point.y - DEFAULT_CAMERA.y) / DEFAULT_CAMERA.zoom,
  };
  const worldAfter = {
    x: (point.x - before.x) / before.zoom,
    y: (point.y - before.y) / before.zoom,
  };
  assert.ok(Math.abs(worldBefore.x - worldAfter.x) < 1e-9);
  assert.ok(Math.abs(worldBefore.y - worldAfter.y) < 1e-9);
  assert.equal(before.zoom, 2);
});

test("zoomToPoint respects the zoom clamp", () => {
  const result = zoomToPoint({ x: 0, y: 0, zoom: 2.9 }, { x: 0, y: 0 }, 100);
  assert.equal(result.zoom, MAX_ZOOM);
});

test("panBy offsets the camera without touching zoom", () => {
  const moved = panBy({ x: 10, y: 20, zoom: 1.5 }, 5, -8);
  assert.deepEqual(moved, { x: 15, y: 12, zoom: 1.5 });
});

test("clampMapScale keeps the map scale within bounds", () => {
  assert.equal(clampMapScale(1), 1);
  assert.equal(clampMapScale(99), MAX_MAP_SCALE);
  assert.equal(clampMapScale(0), MIN_MAP_SCALE);
  assert.equal(clampMapScale(NaN), 1);
});
