// The 18 SRD skills and their governing ability, plus saving throws (one per
// ability). Display + data scaffolding only: there is no skill/save roller in
// combat yet — these exist so future spells/monsters can consume them.
import { modifier, proficiencyBonus } from "./weapons.js";
import { ABILITIES } from "./characterRules.js";

export const SKILLS = [
  { id: "acrobatics", name: "Acrobatics", ability: "dex" },
  { id: "animal-handling", name: "Animal Handling", ability: "wis" },
  { id: "arcana", name: "Arcana", ability: "int" },
  { id: "athletics", name: "Athletics", ability: "str" },
  { id: "deception", name: "Deception", ability: "cha" },
  { id: "history", name: "History", ability: "int" },
  { id: "insight", name: "Insight", ability: "wis" },
  { id: "intimidation", name: "Intimidation", ability: "cha" },
  { id: "investigation", name: "Investigation", ability: "int" },
  { id: "medicine", name: "Medicine", ability: "wis" },
  { id: "nature", name: "Nature", ability: "int" },
  { id: "perception", name: "Perception", ability: "wis" },
  { id: "performance", name: "Performance", ability: "cha" },
  { id: "persuasion", name: "Persuasion", ability: "cha" },
  { id: "religion", name: "Religion", ability: "int" },
  { id: "sleight-of-hand", name: "Sleight of Hand", ability: "dex" },
  { id: "stealth", name: "Stealth", ability: "dex" },
  { id: "survival", name: "Survival", ability: "wis" },
];

export const SAVING_THROWS = ABILITIES;

const SKILL_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill]));
export function skillById(id) {
  return SKILL_BY_ID.get(id) || null;
}

// Fighter (the only class) proficiencies per the 2014 SRD.
export const FIGHTER_SAVES = ["str", "con"];
export const FIGHTER_SKILL_OPTIONS = [
  "acrobatics",
  "animal-handling",
  "athletics",
  "history",
  "insight",
  "intimidation",
  "perception",
  "survival",
];
export const FIGHTER_SKILL_COUNT = 2;

/** Skill check modifier: ability modifier + proficiency bonus when proficient. */
export function skillModifier(finalAbilities, level, skillId, proficient) {
  const skill = skillById(skillId);
  if (!skill) return 0;
  return (
    modifier(finalAbilities[skill.ability]) +
    (proficient ? proficiencyBonus(level) : 0)
  );
}

/** Saving throw modifier: ability modifier + proficiency bonus when proficient. */
export function saveModifier(finalAbilities, level, ability, proficient) {
  return (
    modifier(finalAbilities[ability]) +
    (proficient ? proficiencyBonus(level) : 0)
  );
}
