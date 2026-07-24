import { computeArmorClass, effectiveSpeed } from "./combatRules.js";

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
export const POINT_BUY_COST = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};
export const POINT_BUY_TOTAL = 27;

export const modifier = (score) => Math.floor((score - 10) / 2);
export const formatModifier = (value) =>
  value >= 0 ? `+${value}` : `${value}`;
export const pointsSpent = (abilities) =>
  ABILITIES.reduce((total, key) => total + POINT_BUY_COST[abilities[key]], 0);

export function deriveCharacter(character) {
  const finalAbilities = Object.fromEntries(
    ABILITIES.map((key) => [key, character.abilities[key] + 1]),
  );
  const conModifier = modifier(finalAbilities.con);
  const dexModifier = modifier(finalAbilities.dex);
  const level = Math.max(1, Math.min(20, Number(character.level) || 1));
  const hp =
    Math.max(1, 10 + conModifier) +
    Math.max(0, level - 1) * Math.max(1, 6 + conModifier);
  return {
    finalAbilities,
    hp,
    ac: computeArmorClass({
      armor: character.armor,
      shield: character.shield,
      dexterity: finalAbilities.dex,
    }),
    initiative: dexModifier,
    speed: effectiveSpeed(30, {
      armor: character.armor,
      strength: finalAbilities.str,
    }),
  };
}

export function newCharacter() {
  return {
    id: Date.now().toString(),
    name: "New Character",
    className: "Fighter",
    level: 1,
    species: "Human",
    size: "medium",
    background: "Soldier",
    inventory: [],
    loadout: { mainHand: null, offHand: null },
    armor: null,
    shield: false,
    abilities: { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 },
  };
}
