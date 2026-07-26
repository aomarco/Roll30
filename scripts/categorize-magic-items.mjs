import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const dataDirectory = path.join(projectRoot, "DND 5E Data");
const sourcePath = path.join(dataDirectory, "5e-SRD-Magic-Items.json");
const battleDirectory = path.join(dataDirectory, "BATTLE");
const nonBattleDirectory = path.join(dataDirectory, "NON BATTLE");
const guidePath = path.join(dataDirectory, "MAGIC_ITEM_CATEGORY_GUIDE.txt");
const fileSystemPath = path.join(dataDirectory, "MAGIC_ITEM_FILE_SYSTEM.txt");

const battleDefinitions = [
  ["ITEM FORMS", "melee_weapons", "Weapons whose normal or signature delivery method is a close-range weapon attack."],
  ["ITEM FORMS", "ranged_and_thrown_weapons", "Weapons designed to attack at range or to be thrown as a meaningful part of their combat use."],
  ["ITEM FORMS", "ammunition", "Magical arrows, bolts, and other ammunition used to modify or deliver ranged attacks."],
  ["ITEM FORMS", "armor", "Body armor whose principal magical function improves protection or changes how incoming attacks affect the wearer."],
  ["ITEM FORMS", "shields", "Shields and shield-like defensive items used actively or passively during battle."],
  ["ITEM FORMS", "offensive_wands_staves_and_rods", "Wands, staves, and rods whose dependable primary functions attack, defend, disable, or otherwise influence battle."],
  ["ITEM FORMS", "combat_rings_and_wearables", "Rings, clothing, jewelry, and other worn items whose primary benefits apply during battle."],
  ["ITEM FORMS", "combat_potions_oils_and_dusts", "Consumable liquids, coatings, powders, and similar expendable items primarily used to prepare for or react to battle."],
  ["ITEM FORMS", "spell_scrolls_and_stored_spells", "Items that provide spell access or hold spells for later tactical use, including generic scroll records whose exact spell is unspecified."],

  ["OFFENSE", "attack_accuracy", "Items that directly increase attack-roll accuracy or otherwise make successful attacks more reliable."],
  ["OFFENSE", "bonus_damage", "Items that add damage to an existing attack rather than functioning only as a separate damaging effect."],
  ["OFFENSE", "direct_damage", "Items whose effects directly deal damage to one or more targets."],
  ["OFFENSE", "area_damage", "Items that damage an area, line, cone, radius, or multiple nearby targets."],
  ["OFFENSE", "elemental_damage", "Offensive items that deal acid, cold, fire, force, lightning, necrotic, poison, psychic, radiant, or thunder damage."],
  ["OFFENSE", "creature_type_specialists", "Items designed to be especially effective against a named creature family, alignment, size group, or supernatural type."],
  ["OFFENSE", "critical_hits_and_execution", "Items that improve critical hits, exploit exceptional attack rolls, sever targets, or provide finishing effects."],
  ["OFFENSE", "poison_life_drain_and_wounding", "Items that poison, drain vitality, reduce maximum health, prevent recovery, or inflict persistent wounds."],
  ["OFFENSE", "extra_attacks_and_action_economy", "Items that create additional attacks, free a hand or action, or move a combat function into a bonus action or reaction."],

  ["DEFENSE AND RECOVERY", "healing_and_hit_point_recovery", "Items primarily used during battle to restore lost hit points."],
  ["DEFENSE AND RECOVERY", "regeneration_and_death_prevention", "Items that provide ongoing regeneration, stabilization, exceptional survivability, or protection from dying."],
  ["DEFENSE AND RECOVERY", "armor_class_and_saving_throws", "Items that improve Armor Class, saving throws, or both."],
  ["DEFENSE AND RECOVERY", "damage_resistance_and_immunity", "Items that reduce, resist, absorb, or temporarily negate one or more damage types."],
  ["DEFENSE AND RECOVERY", "spell_defense_absorption_and_reflection", "Items that resist spells, absorb spell energy, turn magic back, or protect specifically against magical effects."],
  ["DEFENSE AND RECOVERY", "projectile_defense", "Items specialized in stopping, catching, redirecting, or weakening missiles and ranged attacks."],
  ["DEFENSE AND RECOVERY", "condition_immunity_and_recovery", "Items that prevent or remove debilitating combat conditions or maintain freedom of action."],
  ["DEFENSE AND RECOVERY", "combat_stealth_invisibility_and_evasion", "Items whose concealment, invisibility, displacement, or evasive movement is primarily valuable during battle."],

  ["CONTROL", "battlefield_control_and_restraint", "Items that restrain movement, create barriers, alter combat space, or hold targets in place."],
  ["CONTROL", "forced_movement_and_knockdown", "Items that push, pull, throw, or knock targets prone."],
  ["CONTROL", "fear_charm_and_domination", "Items that frighten, charm, command, or dominate creatures as a battle tactic."],
  ["CONTROL", "paralysis_blinding_and_other_debuffs", "Items that paralyze, blind, stun, weaken, confuse, or impose other battle disadvantages."],
  ["CONTROL", "summoning_and_combat_allies", "Items that call creatures, animate allies, or create independent forces expected to participate in battle."],
  ["CONTROL", "elemental_command_and_natural_forces", "Items that summon, command, or weaponize elementals and destructive natural forces during battle."],

  ["ENHANCEMENT AND TACTICS", "combat_mobility_speed_and_flight", "Items whose speed, flight, teleportation, or unusual movement is primarily tactical in battle."],
  ["ENHANCEMENT AND TACTICS", "initiative_detection_and_awareness", "Items that reveal enemies, prevent surprise, improve readiness, or enhance battle awareness."],
  ["ENHANCEMENT AND TACTICS", "strength_and_ability_enhancement", "Items that improve Strength or another ability primarily to increase combat performance."],
  ["ENHANCEMENT AND TACTICS", "spell_attack_and_spellcasting_enhancement", "Items that improve spell attacks, spell difficulty, caster defenses, or general battle spellcasting."],
  ["ENHANCEMENT AND TACTICS", "transformation_and_size_change", "Items that transform a combatant, change size, or assume a battle-relevant creature form."],
  ["ENHANCEMENT AND TACTICS", "cursed_and_high_risk_combat_items", "Battle items whose curse, dangerous drawback, unstable result, or severe risk is central to using them."],
  ["ENHANCEMENT AND TACTICS", "versatile_battle_magic", "Broad tactical items with several major battle functions that cannot be represented accurately by one narrower effect category."]
];

const nonBattleDefinitions = [
  ["STORAGE AND ITEM FORMS", "extradimensional_storage", "Containers and spaces that store contents in an extradimensional or spatially unusual location."],
  ["STORAGE AND ITEM FORMS", "equipment_storage_and_carrying", "Items that organize, carry, retrieve, or reduce the practical burden of adventuring equipment."],
  ["STORAGE AND ITEM FORMS", "utility_potions_oils_and_dusts", "Consumable liquids, coatings, and powders whose dominant purpose is exploration, interaction, travel, or another non-battle task."],
  ["STORAGE AND ITEM FORMS", "utility_rings_and_wearables", "Rings, clothing, jewelry, lenses, and other worn items whose dominant purpose is outside battle."],
  ["STORAGE AND ITEM FORMS", "utility_wands_staves_and_rods", "Wands, staves, and rods primarily used for discovery, access, social influence, safety, or general problem-solving."],
  ["STORAGE AND ITEM FORMS", "object_creation_and_deployment", "Items that create, unfold, place, or transform useful objects and terrain features."],
  ["STORAGE AND ITEM FORMS", "general_tools_and_convenience", "Practical magical tools whose primary benefit is broad utility and does not fit a more specialized task alone."],

  ["TRAVEL", "travel_and_transport", "General-purpose items that move creatures or supplies between locations."],
  ["TRAVEL", "flight_and_levitation", "Items primarily used to fly, hover, or levitate during travel and exploration."],
  ["TRAVEL", "teleportation_and_planar_travel", "Items used to teleport, cross planes, open dimensional routes, or reach distant destinations instantly."],
  ["TRAVEL", "climbing_jumping_and_overland_mobility", "Items that improve climbing, jumping, walking, running, or travel over difficult surfaces."],
  ["TRAVEL", "aquatic_travel_and_breathing", "Items that enable swimming, underwater travel, water walking, or breathing in aquatic environments."],
  ["TRAVEL", "vehicles_mounts_and_conveyances", "Magical vehicles, mounts, and rideable objects intended primarily to transport travelers."],
  ["TRAVEL", "shelter_structures_and_fortifications", "Items that provide refuge, temporary structures, secure resting places, or deployable shelter."],

  ["STEALTH AND INFORMATION", "stealth_and_concealment", "Items primarily used to remain unheard, unseen, hidden, or difficult to track outside direct battle."],
  ["STEALTH AND INFORMATION", "disguise_and_identity", "Items that change appearance, support impersonation, or conceal a creature's identity."],
  ["STEALTH AND INFORMATION", "illumination_and_darkvision", "Items that provide light, improve vision in darkness, or compensate for poor lighting."],
  ["STEALTH AND INFORMATION", "detection_revelation_and_secret_finding", "Items that detect magic, invisibility, hidden doors, traps, concealed objects, or other secrets."],
  ["STEALTH AND INFORMATION", "scrying_and_remote_viewing", "Items that observe distant places, creatures, or events without normal physical proximity."],
  ["STEALTH AND INFORMATION", "telepathy_mind_reading_and_communication", "Items that transmit thoughts, read minds, or enable communication beyond ordinary speech."],
  ["STEALTH AND INFORMATION", "languages_and_comprehension", "Items that translate, interpret, or grant understanding of languages."],
  ["STEALTH AND INFORMATION", "exploration_perception_and_investigation", "Items that improve careful observation, examination, reconnaissance, or environmental investigation."],
  ["STEALTH AND INFORMATION", "anti_divination_privacy_and_mind_protection", "Items that block divination, conceal thoughts, preserve privacy, or protect identity and location from supernatural discovery."],

  ["SOCIAL AND SURVIVAL", "social_influence_and_persuasion", "Items whose primary function influences attitudes, attraction, trust, authority, or social decisions."],
  ["SOCIAL AND SURVIVAL", "animal_influence_and_handling", "Items used to befriend, communicate with, command, or safely interact with animals."],
  ["SOCIAL AND SURVIVAL", "food_water_and_sustenance", "Items that provide food, water, nourishment, or freedom from ordinary eating and drinking needs."],
  ["SOCIAL AND SURVIVAL", "environmental_adaptation_and_survival", "Items that help creatures endure climate, altitude, air, temperature, pressure, or other environmental hazards."],
  ["SOCIAL AND SURVIVAL", "disease_poison_and_long_term_recovery", "Items primarily used outside battle to cure, prevent, or recover from disease, poison, and lasting injury."],
  ["SOCIAL AND SURVIVAL", "luck_fortune_and_probability", "Items that influence luck, fortune, uncertain outcomes, or broad tests of skill and fate."],
  ["SOCIAL AND SURVIVAL", "knowledge_and_mental_enhancement", "Items that increase knowledge, intellect, wisdom, memory, understanding, or other long-term mental capability."],
  ["SOCIAL AND SURVIVAL", "form_size_and_appearance_utility", "Items that alter form, size, substance, or appearance primarily for travel, infiltration, access, or creative utility."],

  ["CREATION AND UTILITY MAGIC", "crafting_creation_and_material_manipulation", "Items used to craft, construct, paint, bind, dissolve, reshape, or otherwise manipulate objects and materials."],
  ["CREATION AND UTILITY MAGIC", "permanent_ability_improvement", "Books and manuals whose defining function is a lasting increase to a creature's ability score or capacity."],
  ["CREATION AND UTILITY MAGIC", "utility_spellcasting_and_spell_resources", "Items that provide broad spell access or magical resources primarily for utility, travel, ritual, or flexible problem-solving."],
  ["CREATION AND UTILITY MAGIC", "helpers_companions_and_constructs", "Items that create or call helpers, companions, mounts, or constructs whose dominant purpose is not immediate battle."],
  ["CREATION AND UTILITY MAGIC", "environmental_and_elemental_control", "Items that safely shape or control earth, air, fire, water, plants, and other environmental features for utility."],
  ["CREATION AND UTILITY MAGIC", "weather_air_and_water_manipulation", "Items specifically used to create, remove, redirect, or otherwise manipulate air, weather, and water."],
  ["CREATION AND UTILITY MAGIC", "ritual_religious_and_alignment_magic", "Items centered on ritual use, devotion, alignment, sacred authority, or long-form magical preparation."],
  ["CREATION AND UTILITY MAGIC", "random_magic_wishes_and_reality_alteration", "Items whose defining use involves wishes, unpredictable outcomes, major reality changes, or chance-driven magic."],

  ["ACCESS, SAFETY, AND UNUSUAL MAGIC", "locks_opening_and_entry", "Items that open locks, bypass barriers, gain entry, or secure an access point."],
  ["ACCESS, SAFETY, AND UNUSUAL MAGIC", "restraint_imprisonment_and_security", "Items primarily used to secure creatures, objects, rooms, or locations outside active battle."],
  ["ACCESS, SAFETY, AND UNUSUAL MAGIC", "traps_containment_and_capture", "Items used to trap, contain, capture, or hold creatures and dangerous forces."],
  ["ACCESS, SAFETY, AND UNUSUAL MAGIC", "illusions_entertainment_and_trickery", "Items that produce illusions, spectacle, diversions, playful deception, or theatrical effects."],
  ["ACCESS, SAFETY, AND UNUSUAL MAGIC", "hazardous_cursed_and_deceptive_items", "Non-battle items that are cursed, imitate beneficial objects, produce dangerous surprises, or pose major risks to their users."]
];

const battleNames = [
  /^animated shield$/,
  /^armor of /,
  /^arrow-catching shield$/,
  /^bag of tricks$/,
  /^(gray|rust|tan) bag of tricks$/,
  /^bead of force$/,
  /^belt of .*giant strength$/,
  /^belt of giant strength$/,
  /^bracers of archery$/,
  /^bracers of defense$/,
  /^brooch of shielding$/,
  /^(brass|bronze|iron|silver) horn of valhalla$/,
  /^horn of valhalla$/,
  /^(air|earth|fire|water) elemental gem$/,
  /^elemental gem$/,
  /^(bowl|brazier|censer|stone) of (commanding|controlling) .*elementals$/,
  /^circlet of blasting$/,
  /^cloak of arachnida$/,
  /^cloak of displacement$/,
  /^cloak of protection$/,
  /^cube of force$/,
  /^dust of sneezing and choking$/,
  /^efreeti bottle$/,
  /^eversmoking bottle$/,
  /^gauntlets of ogre power$/,
  /^gem of brightness$/,
  /^gloves of missile snaring$/,
  /^golden lions figurine of wondrous power$/,
  /^bronze griffon figurine of wondrous power$/,
  /^ivory goats figurine of wondrous power$/,
  /^marble elephant figurine of wondrous power$/,
  /^obsidian steed figurine of wondrous power$/,
  /^onyx dog figurine of wondrous power$/,
  /^helm of brilliance$/,
  /^horn of blasting$/,
  /^instant fortress$/,
  /^ioun stone(?! of sustenance)/,
  /^iron bands of binding$/,
  /^iron flask$/,
  /^mantle of spell resistance$/,
  /^mirror of life trapping$/,
  /^necklace of fireballs$/,
  /^necklace of prayer beads$/,
  /^orb of dragonkind$/,
  /^pearl of power$/,
  /^periapt of wound closure$/,
  /^pipes of haunting$/,
  /^pipes of the sewers$/,
  /^robe of scintillating colors$/,
  /^robe of stars$/,
  /^robe of the archmagi$/,
  /^rope of entanglement$/,
  /^scarab of protection$/,
  /^sphere of annihilation$/,
  /^talisman of pure good$/,
  /^talisman of the sphere$/,
  /^talisman of ultimate evil$/,
  /^wind fan$/,
  /^amulet of health$/,
  /^boots of speed$/,
  /^belt of dwarvenkind$/,
  /^whip feather token$/
];

const battlePotionNames = [
  /^oil of sharpness$/,
  /^oil of slipperiness$/,
  /^potion of .*resistance$/,
  /^potion of resistance$/,
  /^potion of .*giant strength$/,
  /^potion of giant strength$/,
  /^potion of (greater |superior |supreme )?healing$/,
  /^potion of growth$/,
  /^potion of diminution$/,
  /^potion of heroism$/,
  /^potion of invisibility$/,
  /^potion of speed$/
];

const battleRingNames = [
  /^ring of .*resistance$/,
  /^ring of resistance$/,
  /^ring of .*elemental command$/,
  /^ring of elemental command$/,
  /^ring of djinni summoning$/,
  /^ring of evasion$/,
  /^ring of free action$/,
  /^ring of invisibility$/,
  /^ring of protection$/,
  /^ring of regeneration$/,
  /^ring of shooting stars$/,
  /^ring of spell storing$/,
  /^ring of spell turning$/,
  /^ring of telekinesis$/,
  /^ring of the ram$/
];

const battleRodNames = [
  /^rod of absorption$/,
  /^rod of alertness$/,
  /^rod of lordly might$/
];

const nonBattleWands = new Set(["Wand of Magic Detection", "Wand of Secrets"]);

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function classifyMain(item) {
  const itemType = item.equipment_category.name;
  const lowerName = item.name.toLowerCase();

  if (["Ammunition", "Armor", "Staff", "Weapon", "Scroll"].includes(itemType)) {
    return "BATTLE";
  }
  if (itemType === "Wand") {
    return nonBattleWands.has(item.name) ? "NON BATTLE" : "BATTLE";
  }
  if (itemType === "Rod") {
    return matchesAny(lowerName, battleRodNames) ? "BATTLE" : "NON BATTLE";
  }
  if (itemType === "Potion") {
    return matchesAny(lowerName, battlePotionNames) ? "BATTLE" : "NON BATTLE";
  }
  if (itemType === "Ring") {
    return matchesAny(lowerName, battleRingNames) ? "BATTLE" : "NON BATTLE";
  }
  if (matchesAny(lowerName, battleNames)) {
    return "BATTLE";
  }
  return "NON BATTLE";
}

function addWhen(tags, tag, condition) {
  if (condition) tags.add(tag);
}

function battleTags(item) {
  const tags = new Set();
  const name = item.name.toLowerCase();
  const description = item.desc.join(" ").toLowerCase();
  const itemType = item.equipment_category.name;
  const isWeapon = itemType === "Weapon";
  const isArmor = itemType === "Armor";
  const isShield = isArmor && name.includes("shield");
  const isAmmunition = itemType === "Ammunition";
  const isMagicImplement = ["Wand", "Staff", "Rod"].includes(itemType);
  const isDamageEffect = /takes? \d+d\d+|deals? \d+d\d+|extra \d+d\d+|damage equal to|damage on a hit|inflicts? damage/.test(description);

  addWhen(tags, "melee_weapons", isWeapon && !/^oathbow$/.test(name));
  addWhen(tags, "ranged_and_thrown_weapons", /oathbow|javelin|dwarven thrower|dancing sword/.test(name));
  addWhen(tags, "ammunition", isAmmunition);
  addWhen(tags, "armor", isArmor && !isShield);
  addWhen(tags, "shields", isShield);
  addWhen(tags, "offensive_wands_staves_and_rods", isMagicImplement);
  addWhen(tags, "combat_rings_and_wearables", itemType === "Ring" || /^(amulet|belt|boots|bracers|brooch|circlet|cloak|gauntlets|gloves|helm|ioun stone|mantle|necklace|periapt|robe|scarab|talisman)/.test(name));
  addWhen(tags, "combat_potions_oils_and_dusts", itemType === "Potion" || /^(dust|bead) /.test(name));
  addWhen(tags, "spell_scrolls_and_stored_spells", itemType === "Scroll" || /spell storing|ioun stone of reserve/.test(name));

  addWhen(tags, "attack_accuracy", (isWeapon || isAmmunition) && (/bonus to attack|advantage on attack/.test(description) || /weapon, \+\d|ammunition, \+\d/.test(name)) || /bracers of archery|wand of the war mage|robe of the archmagi/.test(name));
  addWhen(tags, "bonus_damage", (isWeapon || isAmmunition) && /bonus to attack and damage|extra \d+d\d+|additional \d+d\d+|bonus to damage/.test(description) || /oil of sharpness|bracers of archery/.test(name));
  addWhen(tags, "direct_damage", isWeapon || isAmmunition || isDamageEffect || /circlet of blasting|gem of brightness|necklace of fireballs|sphere of annihilation|talisman of (pure good|ultimate evil)|wand of (fireballs|lightning bolts|magic missiles)|staff of (fire|frost|striking|thunder and lightning|withering)|ring of (shooting stars|the ram)|whip feather token/.test(name));
  addWhen(tags, "area_damage", /bead of force|helm of brilliance|horn of blasting|instant fortress|javelin of lightning|necklace of fireballs|ring of shooting stars|staff of (fire|frost|power|the magi|thunder and lightning)|wand of (fireballs|lightning bolts|wonder)/.test(name));
  addWhen(tags, "elemental_damage", tags.has("direct_damage") && /(acid|cold|fire|force|lightning|necrotic|poison|psychic|radiant|thunder) damage/.test(description) || /flame tongue|frost brand|javelin of lightning|sun blade|circlet of blasting|necklace of fireballs|sphere of annihilation/.test(name));
  addWhen(tags, "creature_type_specialists", /slayer|mace of disruption|mace of smiting|holy avenger|talisman of pure good|talisman of ultimate evil|dragon scale mail|oathbow/.test(name));
  addWhen(tags, "critical_hits_and_execution", /vorpal sword|sword of sharpness|nine lives stealer|vicious weapon/.test(name) || isWeapon && /critical hit/.test(description));
  addWhen(tags, "poison_life_drain_and_wounding", /dagger of venom|sword of life stealing|sword of wounding|staff of withering|nine lives stealer|mace of disruption/.test(name));
  addWhen(tags, "extra_attacks_and_action_economy", /scimitar of speed|dancing sword|animated shield|staff of the python|whip feather token/.test(name));

  addWhen(tags, "healing_and_hit_point_recovery", /healing|necklace of prayer beads/.test(name) && !/potion of poison/.test(name));
  addWhen(tags, "regeneration_and_death_prevention", /regeneration|wound closure|armor of invulnerability|nine lives stealer/.test(name));
  addWhen(tags, "armor_class_and_saving_throws", isArmor || /cloak of protection|ring of protection|bracers of defense|ioun stone of protection|robe of the archmagi|defender|staff of power|staff of the magi/.test(name) || /bonus to (ac|armor class|saving throws)/.test(description));
  addWhen(tags, "damage_resistance_and_immunity", /armor of (invulnerability|resistance|vulnerability)|dragon scale mail|brooch of shielding|cloak of arachnida|frost brand|helm of brilliance|belt of dwarvenkind|mantle of spell resistance|potion of .*resistance|potion of resistance|ring of .*resistance|ring of resistance|ring of .*elemental command|ring of elemental command|robe of the archmagi|scarab of protection|staff of (fire|frost|power|the magi)/.test(name));
  addWhen(tags, "spell_defense_absorption_and_reflection", /absorption|spell turning|spellguard|spell resistance|scarab of protection|ioun stone of greater absorption|robe of the archmagi|staff of (power|the magi)|cube of force/.test(name));
  addWhen(tags, "projectile_defense", /arrow-catching shield|shield of missile attraction|gloves of missile snaring|brooch of shielding|cloak of displacement/.test(name));
  addWhen(tags, "condition_immunity_and_recovery", /ring of free action|potion of heroism|oil of slipperiness|staff of healing|necklace of prayer beads|scarab of protection/.test(name));
  addWhen(tags, "combat_stealth_invisibility_and_evasion", /invisibility|evasion|displacement|eversmoking|robe of scintillating colors|cloak of arachnida/.test(name));

  addWhen(tags, "battlefield_control_and_restraint", /binding|web|entanglement|iron bands|cube of force|mirror of life trapping|iron flask|sphere of annihilation|staff of swarming insects|staff of frost|ring of telekinesis|talisman of the sphere/.test(name));
  addWhen(tags, "forced_movement_and_knockdown", /ring of the ram|ring of telekinesis|wind fan|staff of thunder and lightning|hammer of thunderbolts|horn of blasting/.test(name));
  addWhen(tags, "fear_charm_and_domination", /charming|fear|terror|rulership|pipes of haunting|mace of terror|orb of dragonkind/.test(name));
  addWhen(tags, "paralysis_blinding_and_other_debuffs", /paralysis|dust of sneezing and choking|gem of brightness|robe of scintillating colors|dagger of venom|staff of withering|wand of wonder/.test(name));
  addWhen(tags, "summoning_and_combat_allies", /bag of tricks|horn of valhalla|elemental gem|commanding .*elementals|controlling .*elementals|djinni summoning|efreeti bottle|figurine of wondrous power|staff of the python|staff of the woodlands|pipes of the sewers|iron flask/.test(name));
  addWhen(tags, "elemental_command_and_natural_forces", /elemental|staff of (fire|frost|thunder and lightning)|wand of (fireballs|lightning bolts)|wind fan|javelin of lightning|ring of shooting stars/.test(name));

  addWhen(tags, "combat_mobility_speed_and_flight", /boots of speed|potion of speed|ring of evasion|ring of invisibility|cloak of arachnida|dancing sword|scimitar of speed|staff of the magi|rod of lordly might/.test(name));
  addWhen(tags, "initiative_detection_and_awareness", /rod of alertness|wand of enemy detection|ioun stone of awareness|weapon of warning/.test(name));
  addWhen(tags, "strength_and_ability_enhancement", /giant strength|gauntlets of ogre power|amulet of health|belt of dwarvenkind|ioun stone of (agility|fortitude|insight|intellect|leadership|mastery|strength)|potion of (growth|diminution)/.test(name));
  addWhen(tags, "spell_attack_and_spellcasting_enhancement", /wand of the war mage|robe of the archmagi|pearl of power|ioun stone of (mastery|reserve)|ring of spell storing|staff of (power|the magi)|candle of invocation|orb of dragonkind/.test(name) || itemType === "Scroll");
  addWhen(tags, "transformation_and_size_change", /potion of (growth|diminution)|wand of polymorph|staff of the python|cloak of arachnida|rod of lordly might/.test(name));
  addWhen(tags, "cursed_and_high_risk_combat_items", /berserker axe|armor of vulnerability|demon armor|efreeti bottle|wand of wonder|sphere of annihilation/.test(name));
  addWhen(tags, "versatile_battle_magic", /staff of (power|the magi|woodlands)|rod of lordly might|wand of wonder|orb of dragonkind|necklace of prayer beads|luck blade|candle of invocation/.test(name));

  if (tags.size === 0) {
    tags.add("versatile_battle_magic");
  }
  return tags;
}

function nonBattleTags(item) {
  const tags = new Set();
  const name = item.name.toLowerCase();
  const description = item.desc.join(" ").toLowerCase();
  const itemType = item.equipment_category.name;

  addWhen(tags, "extradimensional_storage", /bag of holding|handy haversack|portable hole/.test(name));
  addWhen(tags, "equipment_storage_and_carrying", /bag of holding|handy haversack|portable hole|efficient quiver/.test(name));
  addWhen(tags, "utility_potions_oils_and_dusts", itemType === "Potion" || /^(dust|philter|restorative ointment)/.test(name));
  addWhen(tags, "utility_rings_and_wearables", itemType === "Ring" || /^(amulet|belt|boots|cloak|eyes|gloves|goggles|hat|headband|helm|horseshoes|ioun stone|medallion|necklace|periapt|robe|slippers|stone of good luck|wings)/.test(name));
  addWhen(tags, "utility_wands_staves_and_rods", ["Wand", "Staff", "Rod"].includes(itemType));
  addWhen(tags, "object_creation_and_deployment", /feather token|folding boat|marvelous pigments|robe of useful items|decanter of endless water/.test(name));
  addWhen(tags, "general_tools_and_convenience", /immovable rod|chime of opening|rope of climbing|sovereign glue|universal solvent|robe of useful items|efficient quiver|stone of good luck/.test(name));

  addWhen(tags, "travel_and_transport", /amulet of the planes|apparatus of the crab|boots of levitation|boots of striding and springing|broom of flying|cape of the mountebank|carpet of flying|cloak of the bat|cubic gate|folding boat|helm of teleportation|horseshoes|well of many worlds|winged boots|wings of flying|potion of (climbing|flying|gaseous form|water breathing)|oil of etherealness|ring of feather falling/.test(name));
  addWhen(tags, "flight_and_levitation", /boots of levitation|broom of flying|carpet of flying|cloak of the bat|ebony fly|bronze griffon|potion of flying|winged boots|wings of flying|horseshoes of a zephyr/.test(name));
  addWhen(tags, "teleportation_and_planar_travel", /amulet of the planes|cape of the mountebank|cubic gate|helm of teleportation|well of many worlds|oil of etherealness|ring of three wishes/.test(name));
  addWhen(tags, "climbing_jumping_and_overland_mobility", /potion of climbing|boots of striding and springing|gloves of swimming and climbing|ring of jumping|rope of climbing|slippers of spider climbing|horseshoes of speed|horseshoes of a zephyr/.test(name));
  addWhen(tags, "aquatic_travel_and_breathing", /apparatus of the crab|cloak of the manta ray|gloves of swimming and climbing|potion of water breathing|ring of swimming|ring of water walking|folding boat|necklace of adaptation/.test(name));
  addWhen(tags, "vehicles_mounts_and_conveyances", /apparatus of the crab|broom of flying|carpet of flying|folding boat|horseshoes|ebony fly|bronze griffon|obsidian steed|swan boat/.test(name));
  addWhen(tags, "shelter_structures_and_fortifications", /rod of security|folding boat|tree feather token|marvelous pigments|robe of useful items/.test(name));

  addWhen(tags, "stealth_and_concealment", /boots of elvenkind|cloak of elvenkind|dust of disappearance|hat of disguise|amulet of proof against detection/.test(name));
  addWhen(tags, "disguise_and_identity", /hat of disguise|dust of disappearance|cloak of the bat|potion of gaseous form/.test(name));
  addWhen(tags, "illumination_and_darkvision", /goggles of night|lantern of revealing|robe of eyes/.test(name));
  addWhen(tags, "detection_revelation_and_secret_finding", /wand of magic detection|wand of secrets|lantern of revealing|gem of seeing|eyes of the eagle|eyes of minute seeing|robe of eyes|crystal ball|potion of clairvoyance|ring of x-ray vision|serpentine owl|onyx dog/.test(name));
  addWhen(tags, "scrying_and_remote_viewing", /crystal ball|potion of clairvoyance/.test(name));
  addWhen(tags, "telepathy_mind_reading_and_communication", /telepathy|mind reading|medallion of thoughts|helm of telepathy|ring of mind shielding|silver raven/.test(name));
  addWhen(tags, "languages_and_comprehension", /helm of comprehending languages/.test(name));
  addWhen(tags, "exploration_perception_and_investigation", /eyes of minute seeing|eyes of the eagle|gem of seeing|goggles of night|lantern of revealing|robe of eyes|ring of x-ray vision|wand of secrets|wand of magic detection|serpentine owl|onyx dog|crystal ball/.test(name));
  addWhen(tags, "anti_divination_privacy_and_mind_protection", /amulet of proof against detection|ring of mind shielding/.test(name));

  addWhen(tags, "social_influence_and_persuasion", /eyes of charming|philter of love|rod of rulership|ring of animal influence|potion of animal friendship|helm of telepathy|medallion of thoughts/.test(name));
  addWhen(tags, "animal_influence_and_handling", /animal influence|animal friendship/.test(name));
  addWhen(tags, "food_water_and_sustenance", /ioun stone of sustenance|decanter of endless water/.test(name));
  addWhen(tags, "environmental_adaptation_and_survival", /boots of the winterlands|ring of warmth|ring of feather falling|necklace of adaptation|potion of water breathing|ring of water walking|cloak of the manta ray|apparatus of the crab/.test(name));
  addWhen(tags, "disease_poison_and_long_term_recovery", /periapt of health|periapt of proof against poison|restorative ointment|potion of poison resistance/.test(name));
  addWhen(tags, "luck_fortune_and_probability", /stone of good luck|deck of many things|ring of three wishes|bag of beans/.test(name));
  addWhen(tags, "knowledge_and_mental_enhancement", /headband of intellect|tome of clear thought|tome of understanding|tome of leadership and influence|eyes of minute seeing|crystal ball|medallion of thoughts/.test(name));
  addWhen(tags, "form_size_and_appearance_utility", /hat of disguise|potion of gaseous form|oil of etherealness|cloak of the bat/.test(name));

  addWhen(tags, "crafting_creation_and_material_manipulation", /manual of .*golems|marvelous pigments|sovereign glue|universal solvent|dust of dryness|decanter of endless water|robe of useful items|tree feather token/.test(name));
  addWhen(tags, "permanent_ability_improvement", /manual of (bodily health|gainful exercise|quickness of action)|tome of (clear thought|leadership and influence|understanding)/.test(name));
  addWhen(tags, "utility_spellcasting_and_spell_resources", /amulet of the planes|candle of invocation|crystal ball|helm of teleportation|ring of three wishes|well of many worlds|rod of security/.test(name));
  addWhen(tags, "helpers_companions_and_constructs", /manual of .*golems|figurine of wondrous power|ebony fly|serpentine owl|silver raven|bronze griffon|onyx dog|feather token/.test(name));
  addWhen(tags, "environmental_and_elemental_control", /decanter of endless water|dust of dryness|fan feather token|tree feather token/.test(name));
  addWhen(tags, "weather_air_and_water_manipulation", /decanter of endless water|dust of dryness|fan feather token/.test(name));
  addWhen(tags, "ritual_religious_and_alignment_magic", /candle of invocation|manual of .*golems/.test(name));
  addWhen(tags, "random_magic_wishes_and_reality_alteration", /deck of many things|bag of beans|ring of three wishes|well of many worlds/.test(name));

  addWhen(tags, "locks_opening_and_entry", /chime of opening|immovable rod|sovereign glue|universal solvent|robe of useful items/.test(name));
  addWhen(tags, "restraint_imprisonment_and_security", /dimensional shackles|immovable rod|rod of security|sovereign glue/.test(name));
  addWhen(tags, "traps_containment_and_capture", /bag of devouring|dimensional shackles|sovereign glue/.test(name));
  addWhen(tags, "illusions_entertainment_and_trickery", /deck of illusions|hat of disguise|dust of disappearance|marvelous pigments|robe of useful items/.test(name));
  addWhen(tags, "hazardous_cursed_and_deceptive_items", /bag of devouring|deck of many things|potion of poison|bag of beans|sovereign glue/.test(name));

  if (tags.size === 0) {
    tags.add("general_tools_and_convenience");
  }
  return tags;
}

function titleFromSlug(value) {
  return value.replaceAll("_", " ").toUpperCase();
}

function writeJson(destination, value) {
  fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function generateGuide() {
  const lines = [
    "MAGIC ITEM CATEGORY GUIDE",
    "",
    "CLASSIFICATION LOGIC",
    "",
    "Every magic-item record belongs to exactly one main category. BATTLE contains items whose dependable, defining, or most likely use is to attack, defend, recover, control opponents, summon battle allies, or improve tactical performance. NON BATTLE contains items whose dominant purpose is travel, storage, exploration, information, social interaction, crafting, survival, security, or broad utility.",
    "",
    "A possible edge-case use does not decide the main category. The item's normal and reliable purpose does. Generic spell-scroll records are placed in BATTLE because the source data does not identify a specific utility spell and scrolls are commonly held as tactical spell resources.",
    "",
    "Subcategories are multi-label filters. An item can appear in several subcategory files inside its one main folder whenever it genuinely satisfies each definition. Repetition between subcategory files is intentional. No item may appear in both main folders, and every source record must appear in at least one subcategory.",
    "",
    "Variant records remain separate records because the source file treats them separately. Category files retain the original objects, source ordering, field ordering, indentation, line endings, and final newline style.",
    ""
  ];

  for (const [mainName, definitions] of [["BATTLE", battleDefinitions], ["NON BATTLE", nonBattleDefinitions]]) {
    lines.push(mainName, "");
    let currentGroup = "";
    for (const [group, slug, explanation] of definitions) {
      if (group !== currentGroup) {
        currentGroup = group;
        lines.push(group, "");
      }
      lines.push(titleFromSlug(slug), explanation, "");
    }
  }
  fs.writeFileSync(guidePath, `${lines.join("\n").trimEnd()}\n`, "utf8");
}

function generateFileSystem(categoryItems) {
  const lines = [];
  for (const [mainName, definitions] of [["BATTLE", battleDefinitions], ["NON BATTLE", nonBattleDefinitions]]) {
    lines.push(mainName);
    let currentGroup = "";
    for (const [group, slug] of definitions) {
      if (group !== currentGroup) {
        currentGroup = group;
        lines.push(` ${group}`);
      }
      lines.push(`  ${titleFromSlug(slug)}`);
      const uniqueNames = [...new Set(categoryItems[mainName][slug].map((item) => item.name))];
      for (const itemName of uniqueNames) {
        lines.push(`   ${itemName}`);
      }
    }
  }
  fs.writeFileSync(fileSystemPath, `${lines.join("\n")}\n`, "utf8");
}

const sourceText = fs.readFileSync(sourcePath, "utf8");
const items = JSON.parse(sourceText);
const sourceReformatted = `${JSON.stringify(items, null, 2)}\n`;
if (sourceText !== sourceReformatted) {
  throw new Error("The source formatting is not the expected two-space JSON format.");
}

const categoryItems = {
  BATTLE: Object.fromEntries(battleDefinitions.map(([, slug]) => [slug, []])),
  "NON BATTLE": Object.fromEntries(nonBattleDefinitions.map(([, slug]) => [slug, []]))
};
const mainByIndex = new Map();
const tagsByIndex = new Map();

for (const item of items) {
  const main = classifyMain(item);
  const tags = main === "BATTLE" ? battleTags(item) : nonBattleTags(item);
  const validTags = categoryItems[main];

  if (tags.size === 0) {
    throw new Error(`No subcategory was assigned to ${item.index}.`);
  }
  for (const tag of tags) {
    if (!(tag in validTags)) {
      throw new Error(`Unknown ${main} subcategory "${tag}" assigned to ${item.index}.`);
    }
    validTags[tag].push(item);
  }
  mainByIndex.set(item.index, main);
  tagsByIndex.set(item.index, [...tags]);
}

for (const [mainName, outputDirectory] of [["BATTLE", battleDirectory], ["NON BATTLE", nonBattleDirectory]]) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const expectedFiles = new Set(Object.keys(categoryItems[mainName]).map((slug) => `${slug}.json`));
  for (const existingName of fs.readdirSync(outputDirectory)) {
    if (existingName.endsWith(".json") && !expectedFiles.has(existingName)) {
      fs.unlinkSync(path.join(outputDirectory, existingName));
    }
  }
  for (const [slug, records] of Object.entries(categoryItems[mainName])) {
    if (records.length === 0) {
      throw new Error(`${mainName}/${slug}.json would be empty.`);
    }
    writeJson(path.join(outputDirectory, `${slug}.json`), records);
  }
}

generateGuide();
generateFileSystem(categoryItems);

const battleCount = [...mainByIndex.values()].filter((main) => main === "BATTLE").length;
const nonBattleCount = items.length - battleCount;
const assignmentCount = [...tagsByIndex.values()].reduce((total, tags) => total + tags.length, 0);

console.log(JSON.stringify({
  sourceRecords: items.length,
  battleRecords: battleCount,
  nonBattleRecords: nonBattleCount,
  battleFiles: battleDefinitions.length,
  nonBattleFiles: nonBattleDefinitions.length,
  totalSubcategoryAssignments: assignmentCount,
  guide: path.relative(projectRoot, guidePath),
  fileSystem: path.relative(projectRoot, fileSystemPath)
}, null, 2));
