// Pure 2D geometry for walls and line-of-sight. Walls are polylines:
// { id, type: "full" | "half", points: [{x, y}, ...] }. Coordinates are in any
// single consistent space (the caller converts to world-local pixels before
// testing). No DOM.

const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);

/**
 * Proper segment intersection: true only when a–b and c–d strictly cross.
 * Collinear overlaps and bare endpoint touches count as non-crossing so walls
 * that merely graze a path/line don't falsely block.
 */
export function segmentsIntersect(a, b, c, d) {
  const d1 = ccw(c, d, a);
  const d2 = ccw(c, d, b);
  const d3 = ccw(a, b, c);
  const d4 = ccw(a, b, d);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/** Does segment p1→p2 cross any wall of each type? -> { full, half }. */
export function segmentHitsWalls(walls, p1, p2) {
  let full = false;
  let half = false;
  for (const wall of Array.isArray(walls) ? walls : []) {
    const points = wall?.points || [];
    for (let i = 0; i < points.length - 1; i += 1) {
      if (segmentsIntersect(p1, p2, points[i], points[i + 1])) {
        if (wall.type === "half") half = true;
        else full = true;
        break;
      }
    }
    if (full) break;
  }
  return { full, half };
}

/**
 * Line of sight for a ranged/thrown shot from `from` to `to`.
 * A full wall blocks entirely; otherwise a half wall imposes disadvantage.
 */
export function lineOfSight(walls, from, to) {
  const { full, half } = segmentHitsWalls(walls, from, to);
  return { blocked: full, disadvantage: half && !full };
}

/**
 * Count the unit grid cells a segment passes through (points given in cell
 * units). Grid DDA (Amanatides–Woo), 4-connected so it never cuts corners —
 * it counts every square the line actually crosses. Used by the ruler.
 */
export function cellsCrossed(p1, p2) {
  let cx = Math.floor(p1.x);
  let cy = Math.floor(p1.y);
  const ex = Math.floor(p2.x);
  const ey = Math.floor(p2.y);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const sx = dx > 0 ? 1 : -1;
  const sy = dy > 0 ? 1 : -1;
  let tMaxX = dx !== 0 ? ((sx > 0 ? cx + 1 : cx) - p1.x) / dx : Infinity;
  let tMaxY = dy !== 0 ? ((sy > 0 ? cy + 1 : cy) - p1.y) / dy : Infinity;
  const tDeltaX = dx !== 0 ? sx / dx : Infinity;
  const tDeltaY = dy !== 0 ? sy / dy : Infinity;
  let count = 1;
  let guard = 0;
  while ((cx !== ex || cy !== ey) && guard < 1e6) {
    if (tMaxX < tMaxY) {
      tMaxX += tDeltaX;
      cx += sx;
    } else {
      tMaxY += tDeltaY;
      cy += sy;
    }
    count += 1;
    guard += 1;
  }
  return count;
}
