const safeSpeed = (speed) => Math.max(0, Math.floor(Number(speed) || 0));

export function createTurnResources(speed) {
  return {
    movementBase: safeSpeed(speed),
    movementSpent: 0,
    actionSpent: false,
    actionType: null,
    bonusActionSpent: false,
    bonusActionType: null,
    dashed: false,
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
  if (!resources || cost > movementRemaining(resources)) return null;
  return { ...resources, movementSpent: resources.movementSpent + cost };
}

export function spendAction(resources, actionType) {
  if (!resources || resources.actionSpent) return null;
  return { ...resources, actionSpent: true, actionType };
}

export function activateDash(resources) {
  const spent = spendAction(resources, "dash");
  return spent ? { ...spent, dashed: true } : null;
}

export function resolveRollMode(advantages = [], disadvantages = []) {
  const hasAdvantage = advantages.some(Boolean);
  const hasDisadvantage = disadvantages.some(Boolean);
  if (hasAdvantage === hasDisadvantage) return "normal";
  return hasAdvantage ? "advantage" : "disadvantage";
}
