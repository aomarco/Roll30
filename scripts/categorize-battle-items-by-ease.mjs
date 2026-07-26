import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const easeDirectory = path.join(projectRoot, "DND 5E Data", "BATTLE", "Ease");
const sourcePath = path.join(easeDirectory, "all_battle_items.json");
const outputRoot = path.join(easeDirectory, "BATTLE_BY_EASE");
const guidePath = path.join(outputRoot, "MAGIC_ITEM_EASE_GUIDE.txt");
const fileSystemPath = path.join(outputRoot, "MAGIC_ITEM_EASE_FILE_SYSTEM.txt");

const tiers = [
  {
    number: 1,
    key: "1_TRIVIAL",
    label: "TIER 1 - TRIVIAL",
    fileName: "tier_1_trivial_items.json",
    definition: "A constant is added to a formula Roll30 already has: weapon attack, weapon damage, Armor Class, saving-throw storage, ability-check storage, or proficiency."
  },
  {
    number: 2,
    key: "2_EASY",
    label: "TIER 2 - EASY",
    fileName: "tier_2_easy_items.json",
    definition: "The item needs one small, self-contained mechanic such as an unconditional damage rider, ability-score override, simple healing, static damage mitigation, or a self-buff that reuses advantage, disadvantage, or an existing condition."
  },
  {
    number: 3,
    key: "3_MODERATE",
    label: "TIER 3 - MODERATE",
    fileName: "tier_3_moderate_items.json",
    definition: "The item needs a bounded subsystem or unavailable target data, including charges, recharge, reactions, extra attacks, conditional creature-type effects, target saving throws, forced movement, or persistent state."
  },
  {
    number: 4,
    key: "4_HARD_DYNAMIC",
    label: "TIER 4 - HARD / DYNAMIC",
    fileName: "tier_4_hard_dynamic_items.json",
    definition: "The item depends on a major missing engine or combines several major mechanics: spellcasting, summoning, dynamic areas, spell absorption or reflection, transformation, autonomous entities, or toolbox-style behavior."
  }
];

function rule(pattern, reason) {
  return { pattern, reason };
}

const tier4Rules = [
  rule(/^spell-scroll/, "The record represents spell casting, and Roll30 has no spell engine."),
  rule(/^wand-of-the-war-mage/, "Its bonus applies to spell attacks, which cannot function until Roll30 has a spell engine."),
  rule(/^wand-(?!of-enemy-detection$)/, "The wand casts spells or reproduces spell effects, requiring the missing spell engine."),

  rule(/^staff-of-(power|the-magi)$/, "It is a multi-function spellcasting toolbox with charges, defenses, several spells, and major dynamic effects."),
  rule(/^staff-of-the-python$/, "It transforms into an autonomous creature with its own statistics and behavior."),
  rule(/^staff-of-thunder-and-lightning$/, "It bundles several effects including line or area damage, saving throws, conditions, and limited-use state."),
  rule(/^staff-(?!of-striking$|of-withering$)/, "The staff casts spells, summons creatures, or bundles spell-driven effects that need the missing spell engine."),

  rule(/^rod-of-absorption$/, "It absorbs spells and converts spell energy, requiring spell interception and spell-slot systems."),
  rule(/^rod-of-alertness$/, "Its spellcasting and protective aura require spell effects, area handling, and several coordinated systems."),
  rule(/^rod-of-lordly-might$/, "It is a large toolbox of weapon forms, transformation, healing, paralysis, fear, navigation, and target saves."),

  rule(/^bag-of-tricks(?:-(gray|rust|tan))?$/, "It creates creatures that need stat blocks, placement, turns, and independent combat behavior."),
  rule(/^(bowl-of-commanding-water-elementals|brazier-of-commanding-fire-elementals|censer-of-controlling-air-elementals)$/, "It summons and controls an elemental creature, requiring creature and turn systems."),
  rule(/^efreeti-bottle$/, "It releases an autonomous creature with branching behavior and powerful spell-like outcomes."),
  rule(/^elemental-gem(?:-(air|earth|fire|water))?$/, "It summons an elemental creature with its own statistics and turns."),
  rule(/^figurine-of-wondrous-power-/, "It creates a creature or mount with independent statistics, duration, and behavior."),
  rule(/^horn-of-valhalla(?:-(silver|brass|bronze|iron))?$/, "It summons multiple autonomous warriors with their own statistics and turns."),
  rule(/^iron-flask$/, "It captures, releases, and controls extraplanar creatures, requiring saving throws, creature storage, and autonomous turns."),
  rule(/^mirror-of-life-trapping$/, "It dynamically traps multiple creatures in extradimensional cells and manages release, copies, and persistent state."),
  rule(/^pipes-of-the-sewers$/, "It summons and controls creature swarms with their own statistics and combat behavior."),
  rule(/^stone-of-controlling-earth-elementals$/, "It summons and controls an elemental creature with its own statistics and turns."),
  rule(/^feather-token-whip$/, "It creates an independently attacking magical object that needs placement, attack behavior, and persistent turns."),

  rule(/^bead-of-force$/, "It combines radius damage, a target save, forced containment, movement, and timed area state."),
  rule(/^dust-of-sneezing-and-choking$/, "It applies a multi-target area effect with saving throws, incapacitation, and repeated suffocation state."),
  rule(/^eversmoking-bottle$/, "It creates an expanding persistent area that changes visibility and reacts dynamically to wind."),
  rule(/^gem-of-brightness$/, "Its charges can create rays and a cone affecting multiple targets with saving throws and blindness."),
  rule(/^hammer-of-thunderbolts$/, "It combines prerequisite equipment, ability changes, charges, area effects, saving throws, and target conditions."),
  rule(/^helm-of-brilliance$/, "It stores several spell effects and charges, including area spells, saving throws, and destructive edge cases."),
  rule(/^horn-of-blasting$/, "It resolves cone targeting, multi-target damage, saving throws, object damage, and a destruction risk."),
  rule(/^instant-fortress$/, "It deploys a structure with its own statistics and resolves area damage and saving throws around it."),
  rule(/^javelin-of-lightning$/, "It requires line targeting, multiple targets, damage resolution, and saving throws."),
  rule(/^mace-of-terror$/, "Its charge creates a multi-target radius condition with saving throws and repeated condition logic."),
  rule(/^necklace-of-fireballs$/, "It casts scalable area fire effects with multi-target saving throws."),
  rule(/^pipes-of-haunting$/, "It uses charges to impose a saving-throw-based condition on multiple creatures in an area."),
  rule(/^robe-of-scintillating-colors$/, "It combines charges, a dynamic radius, target saving throws, incapacitation, and attack modifiers."),
  rule(/^sphere-of-annihilation$/, "It requires a movable map entity, contested control, contact resolution, saves, and destruction rules."),
  rule(/^talisman-of-(pure-good|ultimate-evil|the-sphere)$/, "It depends on major alignment, spell, planar-fissure, or Sphere of Annihilation systems."),

  rule(/^potion-of-(growth|diminution)$/, "It changes size and derived combat statistics, requiring a transformation and size system."),
  rule(/^oil-of-slipperiness$/, "It reproduces spell effects that include area placement, target saves, conditions, and timed freedom of movement."),
  rule(/^plate-armor-of-etherealness$/, "It activates an ethereal-state spell effect that changes movement, targeting, and world interaction."),

  rule(/^ring-of-djinni-summoning$/, "It summons and commands an autonomous spellcasting creature."),
  rule(/^ring-of-elemental-command(?:-(air|earth|fire|water))?$/, "It is a charged elemental toolbox that casts several spells and changes behavior after a creature-specific event."),
  rule(/^ring-of-shooting-stars$/, "It uses charges for several spell effects, including multi-target and area damage."),
  rule(/^ring-of-spell-storing$/, "It requires spell casting, spell levels, stored spell metadata, and later spell execution."),
  rule(/^ring-of-spell-turning$/, "It reflects spells and therefore needs spell targeting, spell resolution, and reaction-like interception."),
  rule(/^ring-of-telekinesis$/, "It continuously reproduces a spell that moves creatures and objects through contested checks."),

  rule(/^robe-of-stars$/, "It casts spells and grants planar movement, requiring spell and ethereal-state systems."),
  rule(/^robe-of-the-archmagi$/, "Its primary bonuses depend on spell attacks, spell saves, and spell resistance, all absent from Roll30."),
  rule(/^brooch-of-shielding$/, "Its signature protection includes immunity to a specific spell, which requires spell identification and resolution."),
  rule(/^circlet-of-blasting$/, "It directly casts a spell attack, requiring the missing spell engine."),
  rule(/^cloak-of-arachnida$/, "It combines movement changes and poison resistance with an area control spell."),
  rule(/^cube-of-force$/, "Its charged barriers have many spell, creature, object, and area interaction modes."),
  rule(/^holy-avenger$/, "It combines creature-type damage with a dynamic allied aura protecting against spells and magical effects."),
  rule(/^ioun-stone$/, "The umbrella record bundles many distinct variants, including spell absorption and stored spells."),
  rule(/^ioun-stone-of-(absorption|greater-absorption|reserve)$/, "It absorbs or stores spells, requiring spell interception, spell levels, and spell execution."),
  rule(/^luck-blade$/, "It is a multi-function weapon with rerolls, saving-throw bonuses, charges, and wish spellcasting."),
  rule(/^mantle-of-spell-resistance$/, "Its defining mechanic is spell resistance, which requires a functioning spell-resolution system."),
  rule(/^necklace-of-prayer-beads$/, "It stores multiple spell effects and charge-like bead state, requiring spellcasting and effect systems."),
  rule(/^orb-of-dragonkind$/, "It is a charged multi-function artifact with spells, creature control, sensing, random properties, and severe drawbacks."),
  rule(/^pearl-of-power$/, "It restores a spell slot, and Roll30 has no spell-slot or spellcasting engine."),
  rule(/^scarab-of-protection$/, "It intercepts hostile spell and undead effects with limited charges and automatic save replacement."),
  rule(/^spellguard-shield$/, "It changes attacks and saves specifically against spells and magical effects, requiring spell-aware combat resolution."),
  rule(/^trident-of-fish-command$/, "It spends charges to cast creature-control spells that require creature typing and spell resolution."),
  rule(/^wind-fan$/, "It casts a line-based spell with forced movement and repeated saving throws.")
];

const tier3Rules = [
  rule(/^armor-of-invulnerability$/, "Its once-per-rest immunity mode needs limited-use state and reset handling beyond static resistance."),
  rule(/^animated-shield$/, "It changes hand and action economy by animating independently after a bonus action."),
  rule(/^arrow-catching-shield$/, "Its reaction redirects another creature's ranged attack and changes target and Armor Class resolution."),
  rule(/^arrow-of-slaying$/, "Its effect requires creature-type data and a target saving throw before applying conditional damage."),
  rule(/^berserker-axe$/, "Its curse requires a target event, a saving throw, forced behavior, and persistent rage state."),
  rule(/^boots-of-speed$/, "It uses bonus-action activation, limited accumulated duration, movement changes, attack modifiers, and exhaustion."),
  rule(/^dagger-of-venom$/, "It has a limited-use activation followed by a target saving throw, poison damage, and a condition."),
  rule(/^dancing-sword$/, "It creates repeated bonus-action attacks from a separately positioned weapon and tracks a limited attack sequence."),
  rule(/^defender$/, "It dynamically reallocates its attack bonus into Armor Class each turn based on the user's choice."),
  rule(/^demon-armor$/, "It combines armor, altered natural attacks, a curse, creature-type checks, and saving-throw-driven behavior."),
  rule(/^dragon-scale-mail(?:-(black|blue|brass|bronze|copper|gold|green|red|silver|white))?$/, "It combines resistance with dragon-specific sensing and saving-throw benefits requiring creature and effect data."),
  rule(/^dragon-slayer$/, "Its extra damage depends on dragon creature-type data that Roll30 does not have."),
  rule(/^dwarven-plate$/, "Its forced-movement reduction requires reaction handling and grid movement interception."),
  rule(/^dwarven-thrower$/, "It needs returning-weapon behavior and creature-type checks for its conditional giant damage."),
  rule(/^giant-slayer$/, "Its damage and knockdown depend on creature-type or size data and a target saving throw."),
  rule(/^gloves-of-missile-snaring$/, "It requires a reaction that intercepts ranged damage, reduces it, and may create a return projectile."),
  rule(/^ioun-stone-of-regeneration$/, "It needs timed healing, missing-body-part state, and long-duration regeneration tracking."),
  rule(/^iron-bands-of-binding$/, "It makes a target save, applies restraint, tracks escape attempts, and manages the bands as a damageable object."),
  rule(/^mace-of-disruption$/, "It requires creature-type data, conditional damage, a target save, destruction, and frightened-state handling."),
  rule(/^mace-of-smiting$/, "Its enhanced critical and destruction effects depend on construct creature-type data."),
  rule(/^nine-lives-stealer$/, "It tracks limited charges and uses a target saving throw for a conditional execution effect."),
  rule(/^oathbow$/, "It tracks a chosen enemy and applies range, advantage, disadvantage, and conditional damage rules."),
  rule(/^periapt-of-wound-closure$/, "It requires dying-state stabilization, timed wound handling, and interaction with rest-based healing dice."),
  rule(/^potion-of-speed$/, "It changes action economy, speed, Armor Class, saving throws, and applies a delayed lethargy state."),
  rule(/^ring-of-evasion$/, "It spends charges after failed Dexterity saves, requiring save resolution, choice timing, and recharge."),
  rule(/^ring-of-regeneration$/, "It requires recurring timed healing and long-duration missing-body-part regeneration."),
  rule(/^ring-of-the-ram$/, "It spends charges on a target attack with forced movement, knockdown, and size-dependent saves."),
  rule(/^rope-of-entanglement$/, "It requires a target saving throw, restraint, repeated escape checks, and damageable-object state."),
  rule(/^scimitar-of-speed$/, "It adds a bonus-action weapon attack and therefore changes Roll30's attack action economy."),
  rule(/^shield-of-missile-attraction$/, "Its curse redirects ranged attacks across targets while also applying conditional damage resistance."),
  rule(/^staff-of-striking$/, "It spends variable charges on hit, adds scalable damage dice, and needs daily recharge state."),
  rule(/^staff-of-withering$/, "It spends charges on hit and uses a target saving throw to apply a lasting combat debuff."),
  rule(/^sun-blade$/, "Its conditional damage requires undead creature-type data, alongside stateful blade activation."),
  rule(/^sword-of-life-stealing$/, "Its critical effect grants temporary hit points and excludes creature types Roll30 cannot identify."),
  rule(/^sword-of-sharpness$/, "Its critical effect requires target anatomy, limb-loss state, and exceptional natural-20 handling."),
  rule(/^sword-of-wounding$/, "It creates persistent wounds, repeated saves, healing suppression, and changing maximum hit points."),
  rule(/^vorpal-sword$/, "Its natural-20 effect requires anatomy, creature traits, conditional decapitation, and fallback damage."),
  rule(/^wand-of-enemy-detection$/, "It uses charges and continuously searches for hostile creatures through range and obstruction rules.")
];

const tier2Rules = [
  rule(/^adamantine-armor$/, "It reuses the existing natural-20 critical system and converts an incoming critical hit into a normal hit."),
  rule(/^amulet-of-health$/, "It sets Constitution to a fixed value and only needs ability override and derived-stat recalculation."),
  rule(/^armor-of-resistance$/, "It adds one static named damage resistance to the damage-application step."),
  rule(/^armor-of-vulnerability$/, "Its static resistance and vulnerability can be handled by one localized damage-modifier mechanic."),
  rule(/^belt-of-dwarvenkind$/, "It combines a bounded ability increase with static resistance and existing roll-mode benefits."),
  rule(/^belt-of-giant-strength(?:-(hill|stone|frost|fire|cloud|storm))?$/, "It sets Strength to a fixed value and needs only ability override and derived-stat recalculation."),
  rule(/^cloak-of-displacement$/, "It applies disadvantage to attacks against the wearer using Roll30's existing roll mode."),
  rule(/^elven-chain$/, "It needs a small armor eligibility exception plus a constant Armor Class bonus."),
  rule(/^flame-tongue$/, "It adds unconditional extra damage dice to ordinary weapon hits."),
  rule(/^frost-brand$/, "Its main combat behavior is an unconditional damage rider plus one static damage resistance."),
  rule(/^gauntlets-of-ogre-power$/, "It sets Strength to a fixed value and needs only ability override and derived-stat recalculation."),
  rule(/^glamoured-studded-leather-armor$/, "Its combat effect is a constant Armor Class bonus; its appearance toggle is a small self-contained state."),
  rule(/^ioun-stone-of-(agility|fortitude|insight|intellect|leadership|strength)$/, "It applies one bounded ability-score increase and recomputes derived values."),
  rule(/^ioun-stone-of-awareness$/, "It adds one small self-buff preventing surprise without target saves or dynamic targeting."),
  rule(/^mithral-armor$/, "It removes armor-based Strength and disadvantage restrictions using existing roll-mode behavior."),
  rule(/^oil-of-sharpness$/, "It applies a timed constant attack-and-damage bonus to one existing weapon formula."),
  rule(/^potion-of-giant-strength(?:-(hill|frost|stone|fire|cloud|storm))?$/, "It temporarily sets Strength and needs one ability override with derived-stat recalculation."),
  rule(/^potion-of-healing(?:-(common|greater|superior|supreme))?$/, "It needs one simple item-use action that restores hit points."),
  rule(/^potion-of-heroism$/, "It needs bounded temporary hit points and a simple attack-and-save roll bonus."),
  rule(/^potion-of-invisibility$/, "It applies a self-only existing visibility condition without a target save or area resolution."),
  rule(/^potion-of-resistance(?:-(acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder))?$/, "It adds one temporary named damage resistance to the damage-application step."),
  rule(/^ring-of-free-action$/, "It reuses existing movement and condition handling to prevent a bounded set of restrictions."),
  rule(/^ring-of-invisibility$/, "It applies a self-only visibility state without target saves, areas, or autonomous entities."),
  rule(/^ring-of-resistance(?:-(acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder))?$/, "It adds one static named damage resistance to the damage-application step."),
  rule(/^vicious-weapon$/, "It reuses the existing natural-20 check and adds a fixed amount of damage.")
];

const tier1Rules = [
  rule(/^ammunition(?:-[123])?$/, "It adds a constant bonus to existing attack and damage formulas."),
  rule(/^armor(?:-[123])?$/, "It adds a constant bonus to the existing Armor Class formula."),
  rule(/^bracers-of-archery$/, "Its defining combat bonus is a constant addition to existing ranged-weapon damage."),
  rule(/^bracers-of-defense$/, "It adds a constant Armor Class bonus when its equipment condition is met."),
  rule(/^cloak-of-protection$/, "It adds constant bonuses to Armor Class and stored saving-throw formulas."),
  rule(/^ioun-stone-of-mastery$/, "It adds one constant to the proficiency value already used by weapon attacks."),
  rule(/^ioun-stone-of-protection$/, "It adds a constant bonus to the existing Armor Class formula."),
  rule(/^ring-of-protection$/, "It adds constant bonuses to Armor Class and stored saving-throw formulas."),
  rule(/^weapon(?:-[123])?$/, "It adds a constant bonus to existing attack and damage formulas.")
];

const rulesByTier = new Map([
  [4, tier4Rules],
  [3, tier3Rules],
  [2, tier2Rules],
  [1, tier1Rules]
]);

function classify(item) {
  for (const tierNumber of [4, 3, 2, 1]) {
    for (const candidate of rulesByTier.get(tierNumber)) {
      if (candidate.pattern.test(item.index)) {
        return { tierNumber, reason: candidate.reason };
      }
    }
  }
  throw new Error(`No Ease tier rule matched ${item.index} (${item.name}).`);
}

function writeJson(filePath, records) {
  fs.writeFileSync(filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

const sourceText = fs.readFileSync(sourcePath, "utf8");
const items = JSON.parse(sourceText);
if (sourceText !== `${JSON.stringify(items, null, 2)}\n`) {
  throw new Error("The consolidated BATTLE source does not use the expected original JSON formatting.");
}

const assignments = new Map();
const recordsByTier = new Map(tiers.map((tier) => [tier.number, []]));
for (const item of items) {
  const classification = classify(item);
  assignments.set(item.index, classification);
  recordsByTier.get(classification.tierNumber).push(item);
}

fs.mkdirSync(outputRoot, { recursive: true });
for (const tier of tiers) {
  const tierDirectory = path.join(outputRoot, tier.key);
  fs.mkdirSync(tierDirectory, { recursive: true });
  writeJson(path.join(tierDirectory, tier.fileName), recordsByTier.get(tier.number));
}

const guideLines = [
  "MAGIC ITEM EASE GUIDE",
  "",
  "CLASSIFICATION RULE",
  "",
  "Every existing BATTLE record is assigned to exactly one Ease tier. The single most-demanding effect decides the tier. Easier secondary effects never lower an item, and ambiguous cases are assigned to the harder plausible tier.",
  "",
  "Ease measures reuse of Roll30's current combat engine, not an item's D&D rarity or power. A simple attunement label does not automatically raise an item because the supplied Tier 2 examples include attuned items; a tier increase occurs when active behavior requires a missing limit, recharge, reaction, spell, creature, area, transformation, or other subsystem.",
  "",
  "TIER DEFINITIONS",
  ""
];

for (const tier of tiers) {
  guideLines.push(
    `${tier.label} - ${recordsByTier.get(tier.number).length} ITEMS`,
    tier.definition,
    ""
  );
}

guideLines.push("PER-ITEM REASONS", "");
for (const tier of tiers) {
  guideLines.push(`${tier.label} - ${recordsByTier.get(tier.number).length} ITEMS`, "");
  for (const item of recordsByTier.get(tier.number)) {
    guideLines.push(`${item.name} - ${assignments.get(item.index).reason}`);
  }
  guideLines.push("");
}
fs.writeFileSync(guidePath, `${guideLines.join("\n").trimEnd()}\n`, "utf8");

const fileSystemLines = ["BATTLE_BY_EASE"];
for (const tier of tiers) {
  fileSystemLines.push(` ${tier.key}`, `  ${tier.fileName}`);
  for (const item of recordsByTier.get(tier.number)) {
    fileSystemLines.push(`   ${item.name}`);
  }
}
fs.writeFileSync(fileSystemPath, `${fileSystemLines.join("\n")}\n`, "utf8");

const counts = Object.fromEntries(tiers.map((tier) => [tier.key, recordsByTier.get(tier.number).length]));
console.log(JSON.stringify({
  outputRoot: path.relative(projectRoot, outputRoot),
  counts,
  grandTotal: items.length
}, null, 2));
