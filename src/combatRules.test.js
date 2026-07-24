import test from "node:test";
import assert from "node:assert/strict";
import {
  activateDash,
  attackRollMode,
  canSwapWeapons,
  canUseAttackAction,
  chooseLandingCell,
  computeArmorClass,
  createTurnResources,
  effectiveSpeed,
  equipmentProblem,
  isDualWieldLoadout,
  loadoutProblem,
  movementMaximum,
  movementRemaining,
  normalizeLoadout,
  performWeaponSwap,
  retrievalKind,
  retrievalRoll,
  resolveRollMode,
  spendAttackAction,
  spendAction,
  spendBonusAction,
  spendMovement,
  weaponRangeBand,
  weaponRangeCells,
} from "./combatRules.js";
import { weaponById } from "./weapons.js";

test("armor class derives from armor category, Dex, and shield", () => {
  // Unarmored: 10 + Dex.
  assert.equal(computeArmorClass({ dexterity: 16 }), 13);
  // Light (leather 11) adds full Dex.
  assert.equal(computeArmorClass({ armor: "leather-armor", dexterity: 16 }), 14);
  // Medium (hide 12) caps Dex at +2.
  assert.equal(computeArmorClass({ armor: "hide-armor", dexterity: 18 }), 14);
  // Heavy (plate 18) ignores Dex; shield adds +2.
  assert.equal(
    computeArmorClass({ armor: "plate-armor", dexterity: 18, shield: true }),
    20,
  );
  assert.equal(computeArmorClass({ dexterity: 14, shield: true }), 14);
});

test("heavy armor below its Strength minimum reduces speed by 10", () => {
  assert.equal(effectiveSpeed(30, { armor: "chain-mail", strength: 10 }), 20);
  assert.equal(effectiveSpeed(30, { armor: "chain-mail", strength: 13 }), 30);
  assert.equal(effectiveSpeed(30, { armor: "leather-armor", strength: 8 }), 30);
  assert.equal(effectiveSpeed(30, {}), 30);
});

test("a shield needs a free off hand", () => {
  const inventory = [
    { itemId: "longsword", quantity: 1 },
    { itemId: "greatsword", quantity: 1 },
    { itemId: "scimitar", quantity: 2 },
  ];
  // One-handed / versatile main hand + shield is legal.
  assert.equal(
    equipmentProblem(inventory, { mainHand: "longsword" }, true),
    null,
  );
  // Two-handed weapon + shield is illegal.
  assert.ok(equipmentProblem(inventory, { mainHand: "greatsword" }, true));
  // Dual-wield + shield is illegal.
  assert.ok(
    equipmentProblem(inventory, { mainHand: "scimitar", offHand: "scimitar" }, true),
  );
  // No shield leaves the weapon-only rules intact.
  assert.equal(
    equipmentProblem(inventory, { mainHand: "greatsword" }, false),
    null,
  );
});

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

test("legacy inventory receives a safe first-weapon loadout", () => {
  const inventory = [
    { itemId: "club", quantity: 1 },
    { itemId: "rapier", quantity: 1 },
  ];
  assert.deepEqual(normalizeLoadout(inventory), {
    mainHand: "club",
    offHand: null,
  });
  assert.deepEqual(
    normalizeLoadout(inventory, { mainHand: null, offHand: null }),
    { mainHand: null, offHand: null },
  );
});

test("loadouts enforce ownership, quantities, Light, and Two-Handed rules", () => {
  assert.match(
    loadoutProblem([{ itemId: "greatsword", quantity: 1 }], {
      mainHand: "greatsword",
      offHand: "club",
    }),
    /not in inventory|both hands/,
  );
  assert.match(
    loadoutProblem(
      [
        { itemId: "rapier", quantity: 1 },
        { itemId: "club", quantity: 1 },
      ],
      { mainHand: "rapier", offHand: "club" },
    ),
    /Light melee/,
  );
  assert.match(
    loadoutProblem([{ itemId: "club", quantity: 1 }], {
      mainHand: "club",
      offHand: "club",
    }),
    /Two copies/,
  );
  assert.equal(
    loadoutProblem(
      [
        { itemId: "club", quantity: 1 },
        { itemId: "scimitar", quantity: 1 },
      ],
      { mainHand: "club", offHand: "scimitar" },
    ),
    null,
  );
  assert.equal(
    isDualWieldLoadout(
      [
        { itemId: "club", quantity: 1 },
        { itemId: "scimitar", quantity: 1 },
      ],
      { mainHand: "club", offHand: "scimitar" },
    ),
    true,
  );
});

test("Swap branches correctly into attack or movement", () => {
  const swapped = performWeaponSwap(createTurnResources(30));
  assert.equal(canSwapWeapons(swapped), false);
  assert.equal(canUseAttackAction(swapped), true);
  assert.equal(activateDash(swapped), null);

  const swappedAttack = spendAttackAction(swapped, "club");
  assert.equal(swappedAttack.swapChoice, "attack");
  assert.equal(spendMovement(swappedAttack, 5), null);

  const swappedMove = spendMovement(
    performWeaponSwap(createTurnResources(30)),
    5,
  );
  assert.equal(swappedMove.swapChoice, "movement");
  assert.equal(canUseAttackAction(swappedMove), false);

  const movedThenSwapped = performWeaponSwap(
    spendMovement(createTurnResources(30), 5),
  );
  assert.equal(movedThenSwapped.swapChoice, "movement");
  assert.equal(canUseAttackAction(movedThenSwapped), false);
});

test("main attacks unlock one off-hand Bonus Action", () => {
  const attacked = spendAttackAction(
    createTurnResources(30),
    "scimitar",
    "shortsword",
    "offHand",
  );
  assert.equal(attacked.offHandAttackAvailable, true);
  assert.equal(attacked.offHandWeaponId, "shortsword");
  assert.equal(attacked.offHandAttackHand, "offHand");
  const bonus = spendBonusAction(attacked, "off-hand-attack");
  assert.equal(bonus.bonusActionSpent, true);
  assert.equal(bonus.offHandAttackAvailable, false);
  assert.equal(spendBonusAction(bonus, "retrieve-ground"), null);
});

test("weapon range bands use the agreed colour rules and stop at maximum", () => {
  const dagger = weaponById("dagger");
  assert.deepEqual(weaponRangeBand(dagger, 5).color, "green");
  assert.deepEqual(weaponRangeBand(dagger, 20).color, "yellow");
  assert.deepEqual(weaponRangeBand(dagger, 25).color, "red");
  assert.equal(weaponRangeBand(dagger, 60).disadvantage, true);
  assert.equal(weaponRangeBand(dagger, 65), null);

  const longbow = {
    rangeType: "ranged",
    normalRange: 150,
    longRange: 600,
  };
  assert.equal(weaponRangeBand(longbow, 150).color, "green");
  assert.equal(weaponRangeBand(longbow, 155).color, "yellow");
  assert.equal(weaponRangeBand(longbow, 605), null);
  assert.equal(
    Math.max(...weaponRangeCells(weaponById("whip")).map((cell) => cell.feet)),
    10,
  );
});

test("Heavy, Lance, long range, and Swap feed disadvantage", () => {
  assert.equal(
    attackRollMode({
      attacker: { size: "small" },
      selectedWeapon: weaponById("greatsword"),
      rangeBand: weaponRangeBand(weaponById("greatsword"), 5),
      resources: createTurnResources(30),
    }).mode,
    "disadvantage",
  );
  assert.equal(
    attackRollMode({
      attacker: { size: "medium" },
      selectedWeapon: weaponById("lance"),
      rangeBand: weaponRangeBand(weaponById("lance"), 5),
      resources: createTurnResources(30),
    }).mode,
    "disadvantage",
  );
  assert.equal(
    attackRollMode({
      attacker: { size: "medium" },
      selectedWeapon: weaponById("lance"),
      rangeBand: weaponRangeBand(weaponById("lance"), 10),
      resources: createTurnResources(30),
    }).mode,
    "normal",
  );
  assert.equal(
    attackRollMode({
      attacker: { size: "medium" },
      selectedWeapon: weaponById("dagger"),
      rangeBand: weaponRangeBand(weaponById("dagger"), 60),
      resources: performWeaponSwap(createTurnResources(30)),
    }).mode,
    "disadvantage",
  );
});

test("retrieval uses d20 + STR + DEX against DC 15", () => {
  const roll = retrievalRoll({ strength: 14, dexterity: 16 }, () => 0.49);
  assert.equal(roll.naturalRoll, 10);
  assert.equal(roll.strengthModifier, 2);
  assert.equal(roll.dexterityModifier, 3);
  assert.equal(roll.total, 15);
  assert.equal(roll.success, true);
});

test("retrieval adjacency and nearby landing squares are deterministic", () => {
  assert.equal(
    retrievalKind({
      battleItem: { state: "ground", cell: { x: 4, y: 4 } },
      actorCell: { x: 5, y: 5 },
    }),
    "ground",
  );
  assert.equal(
    retrievalKind({
      battleItem: { state: "embedded" },
      actorCell: { x: 2, y: 2 },
      carrier: { hp: 0 },
      carrierCell: { x: 3, y: 2 },
    }),
    "corpse",
  );
  assert.deepEqual(
    chooseLandingCell({ x: 4, y: 4 }, [{ x: 5, y: 4 }], {
      columns: 10,
      rows: 10,
    }),
    { x: 3, y: 4 },
  );
});
