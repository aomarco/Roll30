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
