// Pure grid pathfinding used to auto-route a token around walls. 8-directional
// (each step is one 5-ft cell, matching the drag model), A* with a Chebyshev
// heuristic, bounded by maxCells so it stays cheap on the infinite canvas. The
// caller injects `passable(from, to)` (wall + occupancy tests). No DOM.

const key = (c) => `${c.x},${c.y}`;
const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

const NEIGHBORS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

/**
 * Shortest cell path from start to goal, or null if unreachable within
 * maxCells explored. `passable(from, to)` reports whether a step between two
 * adjacent cells is allowed. Returns [start, ...steps, goal].
 */
export function findPath(start, goal, { passable = () => true, maxCells = 4000 } = {}) {
  if (start.x === goal.x && start.y === goal.y) return [start];
  const startKey = key(start);
  const goalKey = key(goal);
  const open = [{ cell: start, f: chebyshev(start, goal) }];
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  let explored = 0;

  while (open.length) {
    // Small frontier; a linear scan for the lowest f is fine and dependency-free.
    let bestIndex = 0;
    for (let i = 1; i < open.length; i += 1)
      if (open[i].f < open[bestIndex].f) bestIndex = i;
    const { cell } = open.splice(bestIndex, 1)[0];
    const cellKey = key(cell);
    if (cellKey === goalKey) {
      const path = [cell];
      let step = cellKey;
      while (cameFrom.has(step)) {
        const prev = cameFrom.get(step);
        path.unshift(prev.cell);
        step = key(prev.cell);
      }
      return path;
    }
    if (explored > maxCells) return null;
    explored += 1;
    for (const delta of NEIGHBORS) {
      const next = { x: cell.x + delta.x, y: cell.y + delta.y };
      if (!passable(cell, next)) continue;
      const nextKey = key(next);
      const tentative = (gScore.get(cellKey) ?? Infinity) + 1;
      if (tentative < (gScore.get(nextKey) ?? Infinity)) {
        cameFrom.set(nextKey, { cell });
        gScore.set(nextKey, tentative);
        const f = tentative + chebyshev(next, goal);
        const existing = open.find((node) => key(node.cell) === nextKey);
        if (existing) existing.f = f;
        else open.push({ cell: next, f });
      }
    }
  }
  return null;
}
