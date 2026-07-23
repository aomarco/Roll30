import test from "node:test";
import assert from "node:assert/strict";
import {
  activateDash,
  createTurnResources,
  movementMaximum,
  movementRemaining,
  resolveRollMode,
  spendAction,
  spendMovement,
} from "./combatRules.js";

test("turn resources begin fresh at the token's speed", () => {
  const resources = createTurnResources(30);
  assert.equal(movementMaximum(resources), 30);
  assert.equal(movementRemaining(resources), 30);
  assert.equal(resources.actionSpent, false);
  assert.equal(resources.bonusActionSpent, false);
});

test("movement helpers are safe before a battle has an active turn", () => {
  assert.equal(movementMaximum(null), 0);
  assert.equal(movementRemaining(null), 0);
});

test("movement is a currency that can be spent in separate moves", () => {
  const first = spendMovement(createTurnResources(30), 10);
  const second = spendMovement(first, 15);
  assert.equal(movementRemaining(second), 5);
  assert.equal(spendMovement(second, 10), null);
});

test("Dash spends the action and adds one speed to total movement", () => {
  const afterMovement = spendMovement(createTurnResources(30), 10);
  const dashed = activateDash(afterMovement);
  assert.equal(movementMaximum(dashed), 60);
  assert.equal(movementRemaining(dashed), 50);
  assert.equal(dashed.actionType, "dash");
  assert.equal(spendAction(dashed, "attack"), null);
});

test("an attack action prevents Dash", () => {
  const attacked = spendAction(createTurnResources(30), "attack");
  assert.equal(activateDash(attacked), null);
  assert.equal(movementRemaining(attacked), 30);
});

test("advantage and disadvantage sources cancel without stacking", () => {
  assert.equal(resolveRollMode(["hidden"], []), "advantage");
  assert.equal(resolveRollMode([], ["long-range"]), "disadvantage");
  assert.equal(resolveRollMode(["hidden", "helped"], ["long-range"]), "normal");
  assert.equal(resolveRollMode([], []), "normal");
});
