// Sourced from DND 5E Data/5e-SRD-Races.json + 5e-SRD-Subraces.json (2014 SRD).
// Numeric traits only: ability bonuses, base speed, size, and granted languages.
// Non-numeric racial traits (Darkvision, Breath Weapon, resistances, etc.) are
// deferred to a future feature/effect engine and are intentionally not modeled.

export const RACES = [
  {
    id: "dwarf",
    name: "Dwarf",
    abilityBonuses: { con: 2 },
    speed: 25,
    size: "medium",
    languages: ["Common", "Dwarvish"],
    subraces: [{ id: "hill-dwarf", name: "Hill Dwarf", abilityBonuses: { wis: 1 } }],
  },
  {
    id: "elf",
    name: "Elf",
    abilityBonuses: { dex: 2 },
    speed: 30,
    size: "medium",
    languages: ["Common", "Elvish"],
    subraces: [{ id: "high-elf", name: "High Elf", abilityBonuses: { int: 1 } }],
  },
  {
    id: "halfling",
    name: "Halfling",
    abilityBonuses: { dex: 2 },
    speed: 25,
    size: "small",
    languages: ["Common", "Halfling"],
    subraces: [
      {
        id: "lightfoot-halfling",
        name: "Lightfoot Halfling",
        abilityBonuses: { cha: 1 },
      },
    ],
  },
  {
    id: "human",
    name: "Human",
    abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    speed: 30,
    size: "medium",
    languages: ["Common"],
    subraces: [],
  },
  {
    id: "dragonborn",
    name: "Dragonborn",
    abilityBonuses: { str: 2, cha: 1 },
    speed: 30,
    size: "medium",
    languages: ["Common", "Draconic"],
    subraces: [],
  },
  {
    id: "gnome",
    name: "Gnome",
    abilityBonuses: { int: 2 },
    speed: 25,
    size: "small",
    languages: ["Common", "Gnomish"],
    subraces: [{ id: "rock-gnome", name: "Rock Gnome", abilityBonuses: { con: 1 } }],
  },
  {
    id: "half-elf",
    name: "Half-Elf",
    abilityBonuses: { cha: 2 },
    speed: 30,
    size: "medium",
    languages: ["Common", "Elvish"],
    subraces: [],
  },
  {
    id: "half-orc",
    name: "Half-Orc",
    abilityBonuses: { str: 2, con: 1 },
    speed: 30,
    size: "medium",
    languages: ["Common", "Orc"],
    subraces: [],
  },
  {
    id: "tiefling",
    name: "Tiefling",
    abilityBonuses: { int: 1, cha: 2 },
    speed: 30,
    size: "medium",
    languages: ["Common", "Infernal"],
    subraces: [],
  },
];

const RACE_BY_ID = new Map(RACES.map((race) => [race.id, race]));

export function raceById(id) {
  return RACE_BY_ID.get(id) || null;
}

export function subraceById(raceId, subraceId) {
  if (!subraceId) return null;
  const race = raceById(raceId);
  return race?.subraces.find((sub) => sub.id === subraceId) || null;
}

/** Short caption of the ability bonuses a race + subrace grant, for the UI. */
export function raceAbilitySummary(raceId, subraceId) {
  const race = raceById(raceId);
  if (!race) return "";
  const format = (bonuses) =>
    Object.entries(bonuses)
      .map(([ability, bonus]) => `+${bonus} ${ability.toUpperCase()}`)
      .join(", ");
  const parts = [`${race.name}: ${format(race.abilityBonuses)}`];
  const subrace = subraceById(raceId, subraceId);
  if (subrace) parts.push(`${subrace.name}: ${format(subrace.abilityBonuses)}`);
  return parts.join(" · ");
}
