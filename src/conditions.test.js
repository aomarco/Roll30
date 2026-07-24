import test from "node:test";
import assert from "node:assert/strict";
import {
  CONDITIONS,
  attackerConditionModes,
  isImmobilized,
  isIncapacitated,
  normalizeConditions,
  targetAutoCrit,
  targetConditionModes,
} from "./conditions.js";
import { attackRollMode } from "./combatRules.js";
import { WEAPONS, resolveWeaponAttack } from "./weapons.js";

test("the 15 SRD conditions are present", () => {
  assert.equal(CONDITIONS.length, 15);
});

test("normalizeConditions drops unknown ids and duplicates", () => {
  assert.deepEqual(
    normalizeConditions(["prone", "prone", "made-up", "poisoned"]),
    ["prone", "poisoned"],
  );
  assert.deepEqual(normalizeConditions(null), []);
});

test("incapacitating and immobilizing conditions are detected", () => {
  assert.equal(isIncapacitated(["stunned"]), true);
  assert.equal(isIncapacitated(["prone"]), false);
  assert.equal(isImmobilized(["grappled"]), true);
  assert.equal(isImmobilized(["poisoned"]), false);
  // Generic "incapacitated" stops actions but not movement.
  assert.equal(isIncapacitated(["incapacitated"]), true);
  assert.equal(isImmobilized(["incapacitated"]), false);
});

test("attacker conditions bias its own attack roll", () => {
  assert.deepEqual(attackerConditionModes(["poisoned"]).disadvantages, [
    "poisoned",
  ]);
  assert.deepEqual(attackerConditionModes(["invisible"]).advantages, [
    "invisible",
  ]);
});

test("target conditions bias incoming attacks by range", () => {
  // Prone: melee attackers gain advantage, ranged attackers suffer disadvantage.
  assert.deepEqual(targetConditionModes(["prone"], "melee").advantages, [
    "prone-target",
  ]);
  assert.deepEqual(targetConditionModes(["prone"], "ranged").disadvantages, [
    "prone-target",
  ]);
  // Restrained grants advantage to all attackers.
  assert.deepEqual(targetConditionModes(["restrained"], "ranged").advantages, [
    "restrained-target",
  ]);
});

test("attackRollMode folds in attacker and target conditions", () => {
  const club = WEAPONS.find((w) => w.id === "club");
  // Attacker poisoned (disadvantage) vs prone target in melee (advantage) cancels.
  const canceled = attackRollMode({
    attacker: { conditions: ["poisoned"] },
    target: { conditions: ["prone"] },
    selectedWeapon: club,
    rangeBand: { id: "melee", feet: 5 },
  });
  assert.equal(canceled.mode, "normal");
  // Restrained target, healthy attacker → advantage.
  const adv = attackRollMode({
    attacker: { conditions: [] },
    target: { conditions: ["restrained"] },
    selectedWeapon: club,
    rangeBand: { id: "melee", feet: 5 },
  });
  assert.equal(adv.mode, "advantage");
});

test("melee hits against paralyzed or unconscious targets auto-crit", () => {
  assert.equal(targetAutoCrit(["unconscious"], "melee"), true);
  assert.equal(targetAutoCrit(["unconscious"], "ranged"), false);
  assert.equal(targetAutoCrit(["prone"], "melee"), false);
  const club = WEAPONS.find((w) => w.id === "club");
  // A mid-range roll that hits becomes a critical via autoCritical.
  const result = resolveWeaponAttack(
    { strength: 10, level: 1 },
    { ac: 5 },
    club,
    () => 0.5,
    { autoCritical: true },
  );
  assert.equal(result.hit, true);
  assert.equal(result.critical, true);
  assert.equal(result.damage.rolls.length, 2);
});
