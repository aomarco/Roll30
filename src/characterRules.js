import { computeArmorClass, effectiveSpeed } from "./combatRules.js";
import { raceById, subraceById } from "./races.js";

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

/** Static 2014 SRD identity lists (no mechanical effect yet). */
export const ALIGNMENTS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
];
export const LANGUAGES = [
  "Common",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
  "Abyssal",
  "Celestial",
  "Draconic",
  "Deep Speech",
  "Infernal",
  "Primordial",
  "Sylvan",
  "Undercommon",
];
export const BACKGROUNDS = ["Acolyte", "Soldier"];
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
  const race = raceById(character.race) || raceById("human");
  const subrace = subraceById(character.race, character.subrace);
  const finalAbilities = Object.fromEntries(
    ABILITIES.map((key) => [
      key,
      character.abilities[key] +
        (race.abilityBonuses[key] || 0) +
        (subrace?.abilityBonuses[key] || 0),
    ]),
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
    baseSpeed: race.speed,
    speed: effectiveSpeed(race.speed, {
      armor: character.armor,
      strength: finalAbilities.str,
    }),
    size: race.size,
  };
}

export function newCharacter() {
  return {
    id: Date.now().toString(),
    name: "New Character",
    className: "Fighter",
    level: 1,
    race: "human",
    subrace: null,
    species: "Human",
    size: "medium",
    background: "Soldier",
    alignment: "Neutral",
    languages: ["Common"],
    inventory: [],
    loadout: { mainHand: null, offHand: null },
    armor: null,
    shield: false,
    abilities: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
  };
}
