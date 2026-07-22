/**
 * Generate affected grid offsets around an excluded origin square.
 * Levels are unbounded positive integers.
 */
export function patternCells(type, level) {
  const n = Math.max(1, Math.floor(Number(level) || 1));
  const cells = [];
  const add = (x, y) => cells.push({ x, y });

  if (type === "square") {
    for (let y = -n; y <= n; y++) {
      for (let x = -n; x <= n; x++) {
        if (x !== 0 || y !== 0) add(x, y);
      }
    }
  } else if (type === "diamond") {
    for (let y = -n; y <= n; y++) {
      for (let x = -n; x <= n; x++) {
        if ((x !== 0 || y !== 0) && Math.abs(x) + Math.abs(y) <= n) add(x, y);
      }
    }
  } else if (type === "plus") {
    const radius = n + 1;
    for (let distance = 1; distance <= radius; distance++) {
      add(-distance, 0);
      add(distance, 0);
      add(0, -distance);
      add(0, distance);
    }
  } else if (type === "star") {
    const radius = n + 1;
    for (let distance = 1; distance <= radius; distance++) {
      add(-distance, -distance);
      add(-distance, 0);
      add(-distance, distance);
      add(0, -distance);
      add(0, distance);
      add(distance, -distance);
      add(distance, 0);
      add(distance, distance);
    }
  } else {
    throw new Error(`Unknown attack pattern: ${type}`);
  }

  return cells;
}

export const SIMPLE_ATTACK = {
  range: 2,
  pattern: "diamond",
  size: 2,
  damage: 3,
};
