// Minimal 2014 SRD class data. Only the fields Roll30 currently derives from a
// class are modeled: the hit die (drives HP) and the two save proficiencies.
// Spellcasting is intentionally basic for now — a caster class is flagged with
// its spellcasting ability and "unlimited" slots/spells as a placeholder until
// the real spell list and slot economy are imported.
export const CLASSES = [
  {
    id: "fighter",
    name: "Fighter",
    hitDie: 10,
    saveProficiencies: ["str", "con"],
    spellcasting: null,
  },
  {
    id: "wizard",
    name: "Wizard",
    hitDie: 6,
    saveProficiencies: ["int", "wis"],
    // Placeholder spellcasting: unlimited until spells/slots are implemented.
    spellcasting: { ability: "int", slots: "unlimited" },
  },
];

// Characters store the class as its display name ("Fighter"), so match on either
// the id or the name and fall back to Fighter for unknown/legacy values.
export const classById = (key) =>
  CLASSES.find((cls) => cls.id === key || cls.name === key) || CLASSES[0];
