// ---------------------------------------------------------------------------
// Placeholder data. Everything here is fake but plausible. This is the ONLY
// file that fabricates content — replace `src/api.ts`'s internals with real
// network calls and this file can be deleted.
// ---------------------------------------------------------------------------

import type {
  Campaign, Character, NPC, Enemy, Item, Media, Note, Scene, Shop, SessionLog, Folder,
} from "../types";

const uid = (p: string, n: number) => `${p}_${n}`;

// --- Campaigns ------------------------------------------------------------

export const campaigns: Campaign[] = [
  {
    id: "camp_1", name: "The Hollow Crown",
    tagline: "A kingdom rots from the throne outward.",
    system: "D&D 5e", coverColor: "aurora-indigo", code: "HOLLOW-4471",
    lastPlayed: "2026-07-18", sessionCount: 12,
    playerIds: ["char_1", "char_2", "char_3", "char_4"], activeSceneId: "scene_tavern",
  },
  {
    id: "camp_2", name: "Salt & Cinder",
    tagline: "Pirates, storms, and a debt that will not drown.",
    system: "D&D 5e", coverColor: "aurora-teal", code: "SALT-9920",
    lastPlayed: "2026-06-30", sessionCount: 5,
    playerIds: [], activeSceneId: null,
  },
  {
    id: "camp_3", name: "The Frostward Expedition",
    tagline: "Something waits beneath the ice.",
    system: "D&D 5e", coverColor: "aurora-rose", code: "FROST-1188",
    lastPlayed: "2026-05-11", sessionCount: 3,
    playerIds: [], activeSceneId: null,
  },
];

// --- Folders --------------------------------------------------------------

export const folders: Folder[] = [
  { id: "fold_1", name: "Chapter 1 — Emberfall", kind: "chapters", sceneIds: ["scene_tavern", "scene_market"] },
  { id: "fold_2", name: "Encounters", kind: "encounters", sceneIds: ["scene_ambush", "scene_crypt"] },
  { id: "fold_3", name: "Unused ideas", kind: "unused", sceneIds: [] },
];

// --- Scenes ---------------------------------------------------------------

export const scenes: Scene[] = [
  {
    id: "scene_tavern", campaignId: "camp_1", name: "The Gilded Tankard",
    type: "playing-field", summary: "A warm, crowded tavern in Emberfall's lower ward.",
    thumbnailColor: "aurora-amber", isTemplate: false, updatedAt: "2026-07-18", folderId: "fold_1",
    ambience: { music: "media_m1", timeOfDay: "night", weather: "clear" },
    shopIds: ["shop_1"],
    prompts: [
      { id: "pr_1", label: "Ask the barkeep about the missing caravan", visibleTo: "all" },
      { id: "pr_2", label: "Inspect the notice board", visibleTo: "all" },
    ],
    tokens: [
      { id: "tok_1", refId: "char_1", kind: "player", name: "Kira", x: 0.3, y: 0.6, color: "#6366f1", hidden: false },
      { id: "tok_2", refId: "char_2", kind: "player", name: "Bram", x: 0.42, y: 0.62, color: "#10b981", hidden: false },
      { id: "tok_3", refId: "npc_1", kind: "npc", name: "Old Hettie", x: 0.7, y: 0.4, color: "#f59e0b", hidden: false },
    ],
  },
  {
    id: "scene_market", campaignId: "camp_1", name: "Emberfall Market",
    type: "playing-field", summary: "Stalls, hawkers, and a suspicious spice merchant.",
    thumbnailColor: "aurora-teal", isTemplate: false, updatedAt: "2026-07-12", folderId: "fold_1",
    ambience: { music: null, timeOfDay: "day", weather: "clear" },
    shopIds: ["shop_2"], prompts: [], tokens: [],
  },
  {
    id: "scene_ambush", campaignId: "camp_1", name: "Forest Ambush",
    type: "battle-field", summary: "Bandits strike on the Emberfall road.",
    thumbnailColor: "aurora-rose", isTemplate: false, updatedAt: "2026-07-18", folderId: "fold_2",
    grid: { cols: 20, rows: 14 }, visionEnabled: true, round: 2,
    initiative: [
      { id: "ini_1", tokenId: "tok_1", name: "Kira", initiative: 19, isActive: true, kind: "player" },
      { id: "ini_2", tokenId: "tok_e1", name: "Bandit Captain", initiative: 15, isActive: false, kind: "enemy" },
      { id: "ini_3", tokenId: "tok_2", name: "Bram", initiative: 12, isActive: false, kind: "player" },
      { id: "ini_4", tokenId: "tok_e2", name: "Bandit", initiative: 8, isActive: false, kind: "enemy" },
    ],
    interactives: [
      { id: "int_1", name: "Rope Bridge", icon: "🌉", state: "closed", x: 0.5, y: 0.25, note: "Collapses after 10 damage." },
      { id: "int_2", name: "Signal Horn", icon: "📯", state: "off", x: 0.8, y: 0.7, requires: "Bandit action", note: "Summons reinforcements." },
    ],
    triggers: [
      {
        id: "trg_1", name: "Reinforcement horn", when: "Signal Horn sounded",
        conditions: ["Round >= 2"], enabled: true,
        effects: [{ id: "ef_1", action: "Spawn 2 Bandits at east edge", delayRounds: 2 }],
      },
    ],
    tokens: [
      { id: "tok_1", refId: "char_1", kind: "player", name: "Kira", x: 6, y: 7, color: "#6366f1", hidden: false, hp: { current: 22, max: 28 } },
      { id: "tok_2", refId: "char_2", kind: "player", name: "Bram", x: 5, y: 9, color: "#10b981", hidden: false, hp: { current: 31, max: 34 } },
      { id: "tok_e1", refId: "enemy_1", kind: "enemy", name: "Bandit Captain", x: 13, y: 6, color: "#ef4444", hidden: false, hp: { current: 52, max: 65 }, conditions: ["Frightened"] },
      { id: "tok_e2", refId: "enemy_2", kind: "enemy", name: "Bandit", x: 14, y: 9, color: "#f97316", hidden: false, hp: { current: 11, max: 11 } },
      { id: "tok_e3", refId: "enemy_2", kind: "enemy", name: "Bandit (hidden)", x: 17, y: 3, color: "#f97316", hidden: true, hp: { current: 11, max: 11 } },
    ],
  },
  {
    id: "scene_crypt", campaignId: "camp_1", name: "The Sunken Crypt",
    type: "battle-field", summary: "Flooded tomb with a lever-gated inner sanctum.",
    thumbnailColor: "aurora-indigo", isTemplate: true, updatedAt: "2026-06-20", folderId: "fold_2",
    grid: { cols: 24, rows: 18 }, visionEnabled: true, round: 0,
    initiative: [], tokens: [],
    interactives: [
      { id: "int_3", name: "Iron Lever", icon: "🔧", state: "off", x: 0.2, y: 0.5, note: "Opens the sanctum gate." },
      { id: "int_4", name: "Sanctum Gate", icon: "🚪", state: "closed", x: 0.6, y: 0.3, requires: "Iron Lever" },
      { id: "int_5", name: "Brazier", icon: "🔥", state: "on", x: 0.4, y: 0.8 },
    ],
    triggers: [
      {
        id: "trg_2", name: "Open the sanctum", when: "Iron Lever pulled",
        conditions: [], enabled: true,
        effects: [
          { id: "ef_2", action: "Open Sanctum Gate", delayRounds: 0 },
          { id: "ef_3", action: "Sound alarm", delayRounds: 0 },
          { id: "ef_4", action: "Spawn 3 Skeletons", delayRounds: 2 },
        ],
      },
    ],
  },
];

// --- Characters -----------------------------------------------------------

const skills = (): Character["skills"] => [
  { name: "Acrobatics", ability: "dex", proficient: true },
  { name: "Athletics", ability: "str", proficient: false },
  { name: "Insight", ability: "wis", proficient: true },
  { name: "Perception", ability: "wis", proficient: true },
  { name: "Persuasion", ability: "cha", proficient: false },
  { name: "Stealth", ability: "dex", proficient: true },
];

export const characters: Character[] = [
  {
    id: "char_1", campaignId: "camp_1", name: "Kira Ashdown", playerName: "Marcelo",
    ancestry: "Half-Elf", className: "Rogue", level: 5, portraitColor: "#6366f1",
    abilities: { str: 10, dex: 18, con: 14, int: 12, wis: 13, cha: 15 },
    hp: { current: 22, max: 28, temp: 0 }, ac: 15, speed: 30, proficiencyBonus: 3,
    skills: skills(), saves: [{ ability: "dex", proficient: true }, { ability: "int", proficient: true }],
    attacks: [
      { id: "atk_1", name: "Rapier", bonus: 7, damage: "1d8+4 piercing", range: "5 ft" },
      { id: "atk_2", name: "Shortbow", bonus: 7, damage: "1d6+4 piercing", range: "80/320 ft" },
      { id: "atk_3", name: "Sneak Attack", bonus: 7, damage: "+3d6", range: "—" },
    ],
    spells: [], spellSlots: [],
    features: [
      { id: "feat_1", name: "Sneak Attack", source: "Class: Rogue", description: "Extra 3d6 when you have advantage or an ally is adjacent." },
      { id: "feat_2", name: "Cunning Action", source: "Class: Rogue", description: "Dash, Disengage, or Hide as a bonus action." },
    ],
    conditions: [],
    inventory: [
      { id: "inv_1", name: "Thieves' Tools", qty: 1, equipped: true },
      { id: "inv_2", name: "Healing Potion", qty: 2, equipped: false },
      { id: "inv_3", name: "Rope (50 ft)", qty: 1, equipped: false },
    ],
    currency: { cp: 40, sp: 12, gp: 85, pp: 1 },
    traits: {
      personality: "Never draws a blade she doesn't intend to use.",
      ideals: "Freedom. Cages are for other people.",
      bonds: "Owes a life-debt to the caravan master.",
      flaws: "Cannot resist a locked door.",
    },
  },
  {
    id: "char_2", campaignId: "camp_1", name: "Bram Stoneheart", playerName: "Alex",
    ancestry: "Mountain Dwarf", className: "Paladin", level: 5, portraitColor: "#10b981",
    abilities: { str: 17, dex: 10, con: 16, int: 8, wis: 12, cha: 14 },
    hp: { current: 31, max: 34, temp: 5 }, ac: 18, speed: 25, proficiencyBonus: 3,
    skills: skills(), saves: [{ ability: "wis", proficient: true }, { ability: "cha", proficient: true }],
    attacks: [
      { id: "atk_4", name: "Warhammer", bonus: 6, damage: "1d8+3 bludgeoning", range: "5 ft" },
      { id: "atk_5", name: "Divine Smite", bonus: 6, damage: "+2d8 radiant", range: "5 ft" },
    ],
    spells: [
      { id: "sp_1", name: "Bless", level: 1, school: "Enchantment" },
      { id: "sp_2", name: "Cure Wounds", level: 1, school: "Evocation" },
      { id: "sp_3", name: "Lay on Hands", level: 0, school: "—" },
    ],
    spellSlots: [{ level: 1, current: 3, max: 4 }, { level: 2, current: 2, max: 2 }],
    features: [
      { id: "feat_3", name: "Divine Smite", source: "Class: Paladin", description: "Expend a spell slot to deal radiant damage on a hit." },
      { id: "feat_4", name: "Aura of Protection", source: "Class: Paladin", description: "Allies within 10 ft add your Cha to saves." },
    ],
    conditions: [],
    inventory: [
      { id: "inv_4", name: "Shield", qty: 1, equipped: true },
      { id: "inv_5", name: "Holy Symbol", qty: 1, equipped: true },
      { id: "inv_6", name: "Rations", qty: 5, equipped: false },
    ],
    currency: { cp: 0, sp: 30, gp: 120, pp: 0 },
    traits: {
      personality: "Speaks little, means every word.",
      ideals: "Duty above comfort.",
      bonds: "Sworn to restore his clan's lost forge.",
      flaws: "Distrusts magic he cannot see.",
    },
  },
  {
    id: "char_3", campaignId: "camp_1", name: "Sable Vex", playerName: "Priya",
    ancestry: "Tiefling", className: "Warlock", level: 5, portraitColor: "#a855f7",
    abilities: { str: 8, dex: 14, con: 13, int: 12, wis: 11, cha: 18 },
    hp: { current: 27, max: 32, temp: 0 }, ac: 13, speed: 30, proficiencyBonus: 3,
    skills: skills(), saves: [{ ability: "wis", proficient: true }, { ability: "cha", proficient: true }],
    attacks: [{ id: "atk_6", name: "Eldritch Blast", bonus: 7, damage: "1d10+4 force", range: "120 ft" }],
    spells: [
      { id: "sp_4", name: "Hex", level: 1, school: "Enchantment" },
      { id: "sp_5", name: "Darkness", level: 2, school: "Evocation" },
      { id: "sp_6", name: "Misty Step", level: 2, school: "Conjuration" },
    ],
    spellSlots: [{ level: 3, current: 2, max: 2 }],
    features: [{ id: "feat_5", name: "Pact of the Tome", source: "Class: Warlock", description: "Access to extra cantrips." }],
    conditions: ["Blessed"],
    inventory: [{ id: "inv_7", name: "Book of Shadows", qty: 1, equipped: true }],
    currency: { cp: 10, sp: 5, gp: 60, pp: 0 },
    traits: { personality: "Curious to a fault.", ideals: "Knowledge is power owed to no one.", bonds: "Bound to a patron she has never seen.", flaws: "Bargains she cannot afford." },
  },
  {
    id: "char_4", campaignId: "camp_1", name: "Fenn Willowbrook", playerName: "Sam",
    ancestry: "Halfling", className: "Druid", level: 5, portraitColor: "#22c55e",
    abilities: { str: 9, dex: 14, con: 14, int: 11, wis: 17, cha: 12 },
    hp: { current: 30, max: 33, temp: 0 }, ac: 14, speed: 25, proficiencyBonus: 3,
    skills: skills(), saves: [{ ability: "int", proficient: true }, { ability: "wis", proficient: true }],
    attacks: [{ id: "atk_7", name: "Quarterstaff", bonus: 5, damage: "1d6+2 bludgeoning", range: "5 ft" }],
    spells: [
      { id: "sp_7", name: "Entangle", level: 1, school: "Conjuration" },
      { id: "sp_8", name: "Moonbeam", level: 2, school: "Evocation" },
    ],
    spellSlots: [{ level: 1, current: 4, max: 4 }, { level: 2, current: 3, max: 3 }],
    features: [{ id: "feat_6", name: "Wild Shape", source: "Class: Druid", description: "Transform into a beast you have seen." }],
    conditions: [],
    inventory: [{ id: "inv_8", name: "Herbalism Kit", qty: 1, equipped: true }],
    currency: { cp: 22, sp: 8, gp: 45, pp: 0 },
    traits: { personality: "Calm as still water.", ideals: "Balance in all things.", bonds: "Guardian of the Emberwood.", flaws: "Slow to trust city folk." },
  },
];

// --- NPCs -----------------------------------------------------------------

export const npcs: NPC[] = [
  { id: "npc_1", campaignId: "camp_1", name: "Old Hettie", role: "Tavern Keeper", portraitColor: "#f59e0b", isShop: true, shopId: "shop_1", disposition: "friendly", notes: "Knows every rumor in Emberfall. Trades gossip for coin." },
  { id: "npc_2", campaignId: "camp_1", name: "Corvin Ashe", role: "Spice Merchant", portraitColor: "#84cc16", isShop: true, shopId: "shop_2", disposition: "neutral", notes: "Smuggles more than spice. Requires persuasion for the good stock." },
  { id: "npc_3", campaignId: "camp_1", name: "Captain Meret", role: "City Watch", portraitColor: "#0ea5e9", isShop: false, shopId: null, disposition: "neutral", notes: "Suspicious of the party. Can be swayed with proof of the caravan plot." },
];

// --- Enemies --------------------------------------------------------------

export const enemies: Enemy[] = [
  {
    id: "enemy_1", campaignId: "camp_1", name: "Bandit Captain", type: "Humanoid", cr: "2",
    hp: 65, ac: 15, portraitColor: "#ef4444",
    attacks: [
      { id: "eatk_1", name: "Scimitar", bonus: 5, damage: "1d6+3 slashing", range: "5 ft" },
      { id: "eatk_2", name: "Dagger (thrown)", bonus: 5, damage: "1d4+3 piercing", range: "20/60 ft" },
    ],
    notes: "Commands lesser bandits. Flees if reduced below 15 HP.",
  },
  {
    id: "enemy_2", campaignId: "camp_1", name: "Bandit", type: "Humanoid", cr: "1/8",
    hp: 11, ac: 12, portraitColor: "#f97316",
    attacks: [{ id: "eatk_3", name: "Scimitar", bonus: 3, damage: "1d6+1 slashing", range: "5 ft" }],
    notes: "Cowardly in isolation, bold in numbers.",
  },
  {
    id: "enemy_3", campaignId: "camp_1", name: "Skeleton", type: "Undead", cr: "1/4",
    hp: 13, ac: 13, portraitColor: "#94a3b8",
    attacks: [{ id: "eatk_4", name: "Shortsword", bonus: 4, damage: "1d6+2 piercing", range: "5 ft" }],
    notes: "Vulnerable to bludgeoning. Reforms if not destroyed.",
  },
];

// --- Items ----------------------------------------------------------------

export const items: Item[] = [
  { id: "item_1", campaignId: "camp_1", name: "Healing Potion", category: "Potion", rarity: "common", value: 50, weight: 0.5, description: "Restores 2d4+2 hit points when consumed." },
  { id: "item_2", campaignId: "camp_1", name: "Rope of Climbing", category: "Wondrous", rarity: "uncommon", value: 400, weight: 3, description: "60 ft of rope that obeys spoken commands." },
  { id: "item_3", campaignId: "camp_1", name: "Silvered Dagger", category: "Weapon", rarity: "common", value: 110, weight: 1, description: "Effective against creatures resistant to nonmagical weapons." },
  { id: "item_4", campaignId: "camp_1", name: "Cloak of Elvenkind", category: "Wondrous", rarity: "uncommon", value: 500, weight: 1, description: "Advantage on Stealth; disadvantage for others to perceive you." },
  { id: "item_5", campaignId: "camp_1", name: "Emberfall Spice", category: "Trade Good", rarity: "common", value: 15, weight: 0.2, description: "A pungent red spice. Somebody wants it very badly." },
  { id: "item_6", campaignId: "camp_1", name: "Flametongue Scimitar", category: "Weapon", rarity: "rare", value: 5000, weight: 3, description: "Bursts into flame on command for +2d6 fire damage." },
];

// --- Shops ----------------------------------------------------------------

export const shops: Shop[] = [
  {
    id: "shop_1", campaignId: "camp_1", name: "The Gilded Tankard — Supplies", keeper: "Old Hettie",
    mode: "automatic", allowSelling: true, requiresCheck: null,
    items: [
      { id: "si_1", itemId: "item_1", name: "Healing Potion", price: 50, stock: 6, hidden: false, requirement: null, meetsRequirement: true },
      { id: "si_2", itemId: "item_3", name: "Silvered Dagger", price: 110, stock: 2, hidden: false, requirement: null, meetsRequirement: true },
      { id: "si_3", itemId: "item_2", name: "Rope of Climbing", price: 400, stock: 1, hidden: false, requirement: null, meetsRequirement: true },
    ],
  },
  {
    id: "shop_2", campaignId: "camp_1", name: "Corvin's Curiosities", keeper: "Corvin Ashe",
    mode: "approval", allowSelling: false, requiresCheck: "DC 14 Persuasion",
    items: [
      { id: "si_4", itemId: "item_4", name: "Cloak of Elvenkind", price: 500, stock: 1, hidden: false, requirement: null, meetsRequirement: true },
      { id: "si_5", itemId: "item_6", name: "Flametongue Scimitar", price: 5000, stock: 1, hidden: true, requirement: "Str 13", meetsRequirement: false },
    ],
  },
];

// --- Media ----------------------------------------------------------------

export const media: Media[] = [
  { id: "media_m1", campaignId: "camp_1", name: "Tavern Warmth", kind: "music", color: "#f59e0b", tag: "tavern", durationSec: 214 },
  { id: "media_m2", campaignId: "camp_1", name: "Ambush!", kind: "music", color: "#ef4444", tag: "battle", durationSec: 178 },
  { id: "media_m3", campaignId: "camp_1", name: "Crypt Dread", kind: "music", color: "#6366f1", tag: "dungeon", durationSec: 305 },
  { id: "media_s1", campaignId: "camp_1", name: "Sword Clash", kind: "sfx", color: "#94a3b8", tag: "combat", durationSec: 2 },
  { id: "media_s2", campaignId: "camp_1", name: "Gate Grind", kind: "sfx", color: "#64748b", tag: "mechanism", durationSec: 4 },
  { id: "media_i1", campaignId: "camp_1", name: "Emberfall Skyline", kind: "image", color: "#0ea5e9", tag: "location" },
  { id: "media_i2", campaignId: "camp_1", name: "Tavern Interior", kind: "image", color: "#f59e0b", tag: "location" },
  { id: "media_i3", campaignId: "camp_1", name: "Bandit Captain", kind: "image", color: "#ef4444", tag: "portrait" },
];

// --- Notes ----------------------------------------------------------------

export const notes: Note[] = [
  { id: "note_1", campaignId: "camp_1", title: "The Caravan Conspiracy", category: "lore", body: "The missing caravans are being intercepted by the Ashen Hand, who smuggle Emberfall Spice to fund a coup against the crown.", secret: true, updatedAt: "2026-07-15" },
  { id: "note_2", campaignId: "camp_1", title: "Emberfall — Player Handout", category: "handout", body: "Welcome to Emberfall, a river city built on trade and old debts. The lower ward smells of smoke and opportunity.", secret: false, updatedAt: "2026-07-01" },
  { id: "note_3", campaignId: "camp_1", title: "House rule: Flanking", category: "rule", body: "Flanking grants advantage, not +2. Applies to melee only.", secret: false, updatedAt: "2026-06-28" },
  { id: "note_4", campaignId: "camp_1", title: "Session 12 recap", category: "session", body: "The party cornered a bandit scout, learned of the horn signal, and camped before the road ambush.", secret: false, updatedAt: "2026-07-18" },
  { id: "note_5", campaignId: "camp_1", title: "Idea: a talking crypt door", category: "idea", body: "Riddle-locked door that insults wrong answers. Maybe too silly — keep in reserve.", secret: true, updatedAt: "2026-06-10" },
];

// --- Session history ------------------------------------------------------

export const sessionLogs: SessionLog[] = [
  { id: "log_1", campaignId: "camp_1", date: "2026-07-18", title: "The Road to Ashes", summary: "Ambush on the Emberfall road. Bandit Captain fled.", durationMin: 195 },
  { id: "log_2", campaignId: "camp_1", date: "2026-07-11", title: "Rumors and Rope", summary: "Investigated the market. Bought supplies from Corvin.", durationMin: 168 },
  { id: "log_3", campaignId: "camp_1", date: "2026-07-04", title: "The Gilded Tankard", summary: "Party met at the tavern and took the caravan job.", durationMin: 142 },
];

export const CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated",
  "Invisible", "Paralyzed", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious", "Blessed",
];
