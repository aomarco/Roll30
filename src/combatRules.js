import { patternCells } from "./patterns.js";
import { armorById, modifier, weaponById } from "./weapons.js";
import {
  attackerConditionModes,
  targetConditionModes,
} from "./conditions.js";

const safeSpeed = (speed) => Math.max(0, Math.floor(Number(speed) || 0));
const inventoryCounts = (inventory = []) => {
  const counts = new Map();
  for (const entry of Array.isArray(inventory) ? inventory : []) {
    const itemId =
      typeof entry === "string" ? entry : entry?.itemId || entry?.id;
    if (!itemId) continue;
    const quantity =
      typeof entry === "string"
        ? 1
        : Math.max(1, Math.floor(Number(entry.quantity) || 1));
    counts.set(itemId, (counts.get(itemId) || 0) + quantity);
  }
  return counts;
};

export function createTurnResources(speed) {
  return {
    movementBase: safeSpeed(speed),
    movementSpent: 0,
    actionSpent: false,
    actionType: null,
    bonusActionSpent: false,
    bonusActionType: null,
    dashed: false,
    swapped: false,
    swapChoice: null,
    mainWeaponAttacked: false,
    mainAttackWeaponId: null,
    offHandAttackAvailable: false,
    offHandWeaponId: null,
    offHandAttackHand: null,
  };
}

export function normalizeTurnResources(resources, speed = 0) {
  return {
    ...createTurnResources(speed),
    ...(resources || {}),
    movementBase: safeSpeed(resources?.movementBase ?? speed),
    movementSpent: Math.max(
      0,
      Math.floor(Number(resources?.movementSpent) || 0),
    ),
  };
}

export function movementMaximum(resources) {
  if (!resources) return 0;
  return resources.movementBase * (resources.dashed ? 2 : 1);
}

export function movementRemaining(resources) {
  if (!resources) return 0;
  return Math.max(0, movementMaximum(resources) - resources.movementSpent);
}

export function spendMovement(resources, feet) {
  const cost = Math.max(0, Math.floor(Number(feet) || 0));
  if (
    !resources ||
    resources.swapChoice === "attack" ||
    cost > movementRemaining(resources)
  )
    return null;
  return {
    ...resources,
    movementSpent: resources.movementSpent + cost,
    swapChoice: resources.swapped ? "movement" : resources.swapChoice,
  };
}

export function spendAction(resources, actionType) {
  if (!resources || resources.actionSpent) return null;
  return { ...resources, actionSpent: true, actionType };
}

export function canDash(resources) {
  return !!resources && !resources.actionSpent && !resources.swapped;
}

export function activateDash(resources) {
  if (!canDash(resources)) return null;
  const spent = spendAction(resources, "dash");
  return { ...spent, dashed: true };
}

export function resolveRollMode(advantages = [], disadvantages = []) {
  const hasAdvantage = advantages.some(Boolean);
  const hasDisadvantage = disadvantages.some(Boolean);
  if (hasAdvantage === hasDisadvantage) return "normal";
  return hasAdvantage ? "advantage" : "disadvantage";
}

export function loadoutProblem(inventory, loadout) {
  const mainHand = loadout?.mainHand || null;
  const offHand = loadout?.offHand || null;
  const counts = inventoryCounts(inventory);
  if (!mainHand && offHand) return "Choose a main-hand weapon first.";
  if (mainHand && !weaponById(mainHand)) return "Unknown main-hand weapon.";
  if (offHand && !weaponById(offHand)) return "Unknown off-hand weapon.";
  if (mainHand && !counts.get(mainHand))
    return "The main-hand weapon is not in inventory.";
  if (offHand && !counts.get(offHand))
    return "The off-hand weapon is not in inventory.";
  if (mainHand && offHand && mainHand === offHand && counts.get(mainHand) < 2)
    return "Two copies are required to equip this weapon in both hands.";
  const mainWeapon = weaponById(mainHand);
  const offWeapon = weaponById(offHand);
  if (offWeapon && mainWeapon?.hands === "two")
    return `${mainWeapon.name} requires both hands.`;
  if (offWeapon && offWeapon.hands === "two")
    return `${offWeapon.name} requires both hands.`;
  if (
    offWeapon &&
    (!mainWeapon?.properties.includes("Light") ||
      !offWeapon.properties.includes("Light") ||
      mainWeapon.rangeType !== "melee" ||
      offWeapon.rangeType !== "melee")
  )
    return "Dual wielding requires two Light melee weapons.";
  return null;
}

export function normalizeLoadout(inventory, loadout) {
  const counts = inventoryCounts(inventory);
  const firstWeapon =
    [...counts.keys()].find((itemId) => weaponById(itemId)) || null;
  const hasStoredMainHand =
    !!loadout && Object.prototype.hasOwnProperty.call(loadout, "mainHand");
  const candidate = {
    mainHand: hasStoredMainHand ? loadout.mainHand || null : firstWeapon,
    offHand: loadout?.offHand || null,
  };
  if (candidate.mainHand && !counts.get(candidate.mainHand))
    candidate.mainHand = firstWeapon;
  if (!counts.get(candidate.offHand)) candidate.offHand = null;
  if (loadoutProblem(inventory, candidate)) candidate.offHand = null;
  return candidate;
}

/**
 * Derive Armor Class from equipped body armor, a shield, and Dexterity.
 * Unarmored is 10 + Dex. Light adds full Dex, Medium caps Dex at its bonus,
 * Heavy ignores Dex. A shield adds a flat +2.
 */
export function computeArmorClass({ armor, shield, dexterity } = {}) {
  const dexMod = modifier(dexterity ?? 10);
  const body = armorById(armor);
  let base;
  if (!body || body.category === "Shield") {
    base = 10 + dexMod;
  } else if (body.acDex) {
    const cap = body.acMaxBonus == null ? dexMod : Math.min(dexMod, body.acMaxBonus);
    base = body.acBase + cap;
  } else {
    base = body.acBase;
  }
  return base + (shield ? 2 : 0);
}

/**
 * Effective speed after a heavy-armor Strength penalty: −10 ft when the wearer's
 * Strength is below the equipped armor's minimum, otherwise the base speed.
 */
export function effectiveSpeed(baseSpeed, { armor, strength } = {}) {
  const base = safeSpeed(baseSpeed);
  const body = armorById(armor);
  if (body && Number(strength ?? 10) < (body.strMinimum || 0))
    return Math.max(0, base - 10);
  return base;
}

/**
 * Full equipment legality: weapon loadout plus shield. A shield needs a free off
 * hand, so it is illegal with a truly two-handed weapon or while dual wielding.
 */
export function equipmentProblem(inventory, loadout, shield) {
  const weaponIssue = loadoutProblem(inventory, loadout);
  if (weaponIssue) return weaponIssue;
  if (!shield) return null;
  const mainWeapon = weaponById(loadout?.mainHand);
  if (mainWeapon?.hands === "two")
    return `${mainWeapon.name} needs both hands, leaving none for a shield.`;
  if (loadout?.offHand)
    return "A shield cannot be held while dual wielding.";
  return null;
}

/**
 * Clear equipped armor/shield that the entity does not own. Equipping requires
 * owning the item (like weapons); this is the armor analogue of normalizeLoadout.
 */
export function normalizeEquipment(inventory, { armor, shield } = {}) {
  const counts = inventoryCounts(inventory);
  return {
    armor: armor && counts.get(armor) ? armor : null,
    shield: shield && counts.get("shield") ? true : false,
  };
}

export function isDualWieldLoadout(inventory, loadout) {
  return (
    !!loadout?.mainHand &&
    !!loadout?.offHand &&
    !loadoutProblem(inventory, loadout)
  );
}

export function canSwapWeapons(resources) {
  return (
    !!resources &&
    !resources.swapped &&
    !resources.dashed &&
    !resources.actionSpent
  );
}

export function performWeaponSwap(resources) {
  if (!canSwapWeapons(resources)) return null;
  return {
    ...resources,
    swapped: true,
    swapChoice: resources.movementSpent > 0 ? "movement" : null,
  };
}

export function canUseAttackAction(resources) {
  if (!resources || resources.actionSpent || resources.dashed) return false;
  if (
    resources.swapped &&
    (resources.movementSpent > 0 || resources.swapChoice === "movement")
  )
    return false;
  return true;
}

export function spendAttackAction(
  resources,
  weaponId,
  availableOffHandWeaponId = null,
  availableOffHandAttackHand = null,
) {
  if (!canUseAttackAction(resources)) return null;
  return {
    ...resources,
    actionSpent: true,
    actionType: "attack",
    swapChoice: resources.swapped ? "attack" : resources.swapChoice,
    mainWeaponAttacked: true,
    mainAttackWeaponId: weaponId,
    offHandAttackAvailable: !!availableOffHandWeaponId,
    offHandWeaponId: availableOffHandWeaponId,
    offHandAttackHand: availableOffHandAttackHand,
  };
}

export function spendBonusAction(resources, actionType) {
  if (!resources || resources.bonusActionSpent) return null;
  return {
    ...resources,
    bonusActionSpent: true,
    bonusActionType: actionType,
    offHandAttackAvailable: false,
    offHandWeaponId: null,
    offHandAttackHand: null,
  };
}

export function offHandWeaponId(loadout, mainAttackWeaponId) {
  if (!loadout?.offHand) return null;
  if (loadout.mainHand === mainAttackWeaponId) return loadout.offHand;
  if (loadout.offHand === mainAttackWeaponId) return loadout.mainHand;
  return null;
}

export function distanceFeet(origin, target) {
  return (Math.abs(target.x - origin.x) + Math.abs(target.y - origin.y)) * 5;
}

export function weaponRangeBand(selectedWeapon, feet) {
  if (!selectedWeapon || feet <= 0) return null;
  const meleeRange = selectedWeapon.meleeRange || 5;
  if (selectedWeapon.thrown) {
    if (feet <= meleeRange)
      return { id: "melee", color: "green", disadvantage: false, feet };
    if (feet <= selectedWeapon.thrown.normalRange)
      return {
        id: "thrown-normal",
        color: "yellow",
        disadvantage: false,
        feet,
      };
    if (feet <= selectedWeapon.thrown.longRange)
      return { id: "thrown-long", color: "red", disadvantage: true, feet };
    return null;
  }
  if (selectedWeapon.rangeType === "ranged") {
    if (feet <= selectedWeapon.normalRange)
      return { id: "normal", color: "green", disadvantage: false, feet };
    if (feet <= selectedWeapon.longRange)
      return { id: "long", color: "yellow", disadvantage: true, feet };
    return null;
  }
  if (feet <= meleeRange)
    return { id: "melee", color: "green", disadvantage: false, feet };
  return null;
}

export function weaponRangeCells(selectedWeapon, maxRadius = Infinity) {
  if (!selectedWeapon) return [];
  const maximumFeet = selectedWeapon.thrown
    ? selectedWeapon.thrown.longRange
    : selectedWeapon.rangeType === "ranged"
      ? selectedWeapon.longRange
      : selectedWeapon.meleeRange || 5;
  // Long-range weapons cover thousands of squares; callers can cap generation
  // to the visible board so we never build cells that can't be seen.
  const radius = Math.max(1, Math.min(maximumFeet / 5, maxRadius));
  return patternCells("diamond", radius).map((cell) => ({
    ...cell,
    ...weaponRangeBand(
      selectedWeapon,
      (Math.abs(cell.x) + Math.abs(cell.y)) * 5,
    ),
  }));
}

export function attackRollMode({
  attacker,
  target,
  selectedWeapon,
  rangeBand,
  resources,
  advantages = [],
  disadvantages = [],
}) {
  const rangeType =
    selectedWeapon?.rangeType === "ranged" ||
    String(rangeBand?.id || "").startsWith("thrown-")
      ? "ranged"
      : "melee";
  const attackerModes = attackerConditionModes(attacker?.conditions);
  const targetModes = targetConditionModes(target?.conditions, rangeType);
  const advantageSources = [
    ...advantages,
    ...attackerModes.advantages,
    ...targetModes.advantages,
  ].filter(Boolean);
  const disadvantageSources = [
    ...disadvantages,
    ...attackerModes.disadvantages,
    ...targetModes.disadvantages,
    rangeBand?.disadvantage && rangeBand.id,
    selectedWeapon?.properties.includes("Heavy") &&
      String(attacker?.size).toLowerCase() === "small" &&
      "small-heavy",
    selectedWeapon?.id === "lance" && rangeBand?.feet <= 5 && "lance-close",
    resources?.swapped && resources.swapChoice !== "movement" && "weapon-swap",
  ].filter(Boolean);
  return {
    mode: resolveRollMode(advantageSources, disadvantageSources),
    advantages: advantageSources,
    disadvantages: disadvantageSources,
  };
}

export function retrievalRoll(token, random = Math.random) {
  const naturalRoll = Math.floor(random() * 20) + 1;
  const strengthModifier = modifier(token.strength ?? 10);
  const dexterityModifier = modifier(token.dexterity ?? 10);
  const total = naturalRoll + strengthModifier + dexterityModifier;
  return {
    naturalRoll,
    strengthModifier,
    dexterityModifier,
    total,
    dc: 15,
    success: total >= 15,
  };
}

export function isAdjacentOrSame(first, second) {
  return Math.abs(first.x - second.x) <= 1 && Math.abs(first.y - second.y) <= 1;
}

export function retrievalKind({ battleItem, actorCell, carrier, carrierCell }) {
  if (!battleItem || !actorCell) return null;
  if (
    battleItem.state === "ground" &&
    battleItem.cell &&
    isAdjacentOrSame(actorCell, battleItem.cell)
  )
    return "ground";
  if (
    battleItem.state === "embedded" &&
    carrier &&
    carrierCell &&
    isAdjacentOrSame(actorCell, carrierCell)
  )
    return carrier.hp <= 0 ? "corpse" : "embedded";
  return null;
}

export function chooseLandingCell(targetCell, occupiedCells = [], bounds = {}) {
  const occupied = new Set(occupiedCells.map((cell) => `${cell.x},${cell.y}`));
  const candidates = [
    { x: targetCell.x + 1, y: targetCell.y },
    { x: targetCell.x - 1, y: targetCell.y },
    { x: targetCell.x, y: targetCell.y + 1 },
    { x: targetCell.x, y: targetCell.y - 1 },
    { x: targetCell.x + 1, y: targetCell.y + 1 },
    { x: targetCell.x - 1, y: targetCell.y + 1 },
    { x: targetCell.x + 1, y: targetCell.y - 1 },
    { x: targetCell.x - 1, y: targetCell.y - 1 },
    targetCell,
  ];
  return (
    candidates.find(
      (cell) =>
        cell.x >= 0 &&
        cell.y >= 0 &&
        cell.x < (bounds.columns ?? Number.POSITIVE_INFINITY) &&
        cell.y < (bounds.rows ?? Number.POSITIVE_INFINITY) &&
        !occupied.has(`${cell.x},${cell.y}`),
    ) || targetCell
  );
}
