/**
 * 2014 SRD conditions. Backend-first: each condition carries structured
 * mechanical flags so any future system (spells, monster abilities, feats)
 * can apply a condition by id and have the combat engine react automatically.
 *
 * Flags:
 *   selfAttack     "advantage" | "disadvantage" | null — the afflicted
 *                  creature's own attack rolls.
 *   vsMelee        modifier applied to melee attack rolls AGAINST the creature.
 *   vsRanged       modifier applied to ranged attack rolls AGAINST the creature.
 *   incapacitated  true → cannot take actions, bonus actions, or reactions.
 *   immobile       true → speed becomes 0 (cannot move).
 *   autoCritMelee  true → a melee hit from within 5 ft against it is a crit.
 *
 * Conditions with no combat flags (charmed, deafened, exhaustion, …) still
 * exist so they can be tracked and shown; they simply have no roll effect yet.
 */
const condition = ({
  id,
  name,
  abbr,
  color,
  selfAttack = null,
  vsMelee = null,
  vsRanged = null,
  incapacitated = false,
  immobile = false,
  autoCritMelee = false,
  note = "",
}) => ({
  id,
  name,
  abbr,
  color,
  selfAttack,
  vsMelee,
  vsRanged,
  incapacitated,
  immobile,
  autoCritMelee,
  note,
});

export const CONDITIONS = [
  condition({
    id: "blinded",
    name: "Blinded",
    abbr: "BL",
    color: "#5b6472",
    selfAttack: "disadvantage",
    vsMelee: "advantage",
    vsRanged: "advantage",
    note: "Can't see; auto-fails sight checks.",
  }),
  condition({
    id: "charmed",
    name: "Charmed",
    abbr: "CH",
    color: "#c86fb0",
    note: "Can't attack the charmer; charmer has social advantage.",
  }),
  condition({
    id: "deafened",
    name: "Deafened",
    abbr: "DF",
    color: "#6b7280",
    note: "Can't hear; auto-fails hearing checks.",
  }),
  condition({
    id: "frightened",
    name: "Frightened",
    abbr: "FR",
    color: "#b06f3a",
    selfAttack: "disadvantage",
    note: "Disadvantage on attacks while the fear source is in sight.",
  }),
  condition({
    id: "grappled",
    name: "Grappled",
    abbr: "GR",
    color: "#7a6a4f",
    immobile: true,
    note: "Speed becomes 0.",
  }),
  condition({
    id: "incapacitated",
    name: "Incapacitated",
    abbr: "IN",
    color: "#8a5a5a",
    incapacitated: true,
    note: "Can't take actions or reactions.",
  }),
  condition({
    id: "invisible",
    name: "Invisible",
    abbr: "IV",
    color: "#4f7fa8",
    selfAttack: "advantage",
    vsMelee: "disadvantage",
    vsRanged: "disadvantage",
    note: "Can't be seen without magic or special senses.",
  }),
  condition({
    id: "paralyzed",
    name: "Paralyzed",
    abbr: "PA",
    color: "#8455b8",
    incapacitated: true,
    immobile: true,
    vsMelee: "advantage",
    vsRanged: "advantage",
    autoCritMelee: true,
    note: "Incapacitated; auto-fails STR/DEX saves; melee hits crit.",
  }),
  condition({
    id: "petrified",
    name: "Petrified",
    abbr: "PE",
    color: "#6d7d6d",
    incapacitated: true,
    immobile: true,
    vsMelee: "advantage",
    vsRanged: "advantage",
    note: "Turned to stone; incapacitated; resistant to damage.",
  }),
  condition({
    id: "poisoned",
    name: "Poisoned",
    abbr: "PO",
    color: "#5f9e5f",
    selfAttack: "disadvantage",
    note: "Disadvantage on attacks and ability checks.",
  }),
  condition({
    id: "prone",
    name: "Prone",
    abbr: "PR",
    color: "#a88a3a",
    selfAttack: "disadvantage",
    vsMelee: "advantage",
    vsRanged: "disadvantage",
    note: "Melee attacks against it have advantage; ranged have disadvantage.",
  }),
  condition({
    id: "restrained",
    name: "Restrained",
    abbr: "RS",
    color: "#a85a4f",
    selfAttack: "disadvantage",
    vsMelee: "advantage",
    vsRanged: "advantage",
    immobile: true,
    note: "Speed 0; disadvantage on DEX saves.",
  }),
  condition({
    id: "stunned",
    name: "Stunned",
    abbr: "ST",
    color: "#b8973a",
    incapacitated: true,
    immobile: true,
    vsMelee: "advantage",
    vsRanged: "advantage",
    note: "Incapacitated; auto-fails STR/DEX saves.",
  }),
  condition({
    id: "unconscious",
    name: "Unconscious",
    abbr: "UN",
    color: "#4a4a55",
    incapacitated: true,
    immobile: true,
    vsMelee: "advantage",
    vsRanged: "advantage",
    autoCritMelee: true,
    note: "Incapacitated; drops everything; melee hits crit.",
  }),
  condition({
    id: "exhaustion",
    name: "Exhaustion",
    abbr: "EX",
    color: "#7a5a3a",
    note: "Escalating six-level penalty track (not yet enforced).",
  }),
];

export const conditionById = (id) =>
  CONDITIONS.find((candidate) => candidate.id === id) || null;

const list = (conditions) => (Array.isArray(conditions) ? conditions : []);

/** Keep only known condition ids, de-duplicated. */
export function normalizeConditions(conditions) {
  const seen = new Set();
  const result = [];
  for (const id of list(conditions)) {
    if (conditionById(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

/** Cannot take actions, bonus actions, or reactions. */
export function isIncapacitated(conditions) {
  return list(conditions).some((id) => conditionById(id)?.incapacitated);
}

/** Speed becomes 0; the creature cannot move. */
export function isImmobilized(conditions) {
  return list(conditions).some((id) => conditionById(id)?.immobile);
}

/** Roll-mode sources from the ATTACKER's own conditions. */
export function attackerConditionModes(conditions) {
  const advantages = [];
  const disadvantages = [];
  for (const id of list(conditions)) {
    const c = conditionById(id);
    if (c?.selfAttack === "advantage") advantages.push(id);
    if (c?.selfAttack === "disadvantage") disadvantages.push(id);
  }
  return { advantages, disadvantages };
}

/** Roll-mode sources from the TARGET's conditions, by incoming attack range. */
export function targetConditionModes(conditions, rangeType = "melee") {
  const key = rangeType === "ranged" ? "vsRanged" : "vsMelee";
  const advantages = [];
  const disadvantages = [];
  for (const id of list(conditions)) {
    const effect = conditionById(id)?.[key];
    if (effect === "advantage") advantages.push(`${id}-target`);
    if (effect === "disadvantage") disadvantages.push(`${id}-target`);
  }
  return { advantages, disadvantages };
}

/** A melee hit against a creature in this state is an automatic critical. */
export function targetAutoCrit(conditions, rangeType = "melee") {
  return (
    rangeType !== "ranged" &&
    list(conditions).some((id) => conditionById(id)?.autoCritMelee)
  );
}
