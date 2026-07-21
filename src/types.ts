// ---------------------------------------------------------------------------
// Roll30 domain model.
//
// These types describe every entity in the product concept. They are the
// contract between the UI and the data layer. Right now the data is served
// from `src/mock/data.ts` through `src/api.ts`; swapping in a real backend
// means implementing the same shapes — the UI does not change.
// ---------------------------------------------------------------------------

export type ID = string;

export type Role = "gm" | "player";

/** GM edits the world in "build"; runs it live in "session". */
export type SceneMode = "build" | "session";

export type SceneType = "playing-field" | "battle-field";

// --- Campaign -------------------------------------------------------------

export interface Campaign {
  id: ID;
  name: string;
  tagline: string;
  system: string; // e.g. "D&D 5e"
  coverColor: string; // token gradient key
  code: string; // join code players use
  lastPlayed: string; // ISO date
  sessionCount: number;
  playerIds: ID[];
  activeSceneId: ID | null;
}

// --- Folders / organisation ----------------------------------------------

export type FolderKind =
  | "locations"
  | "chapters"
  | "encounters"
  | "characters"
  | "monsters"
  | "items"
  | "unused"
  | "completed";

export interface Folder {
  id: ID;
  name: string;
  kind: FolderKind;
  sceneIds: ID[];
}

// --- Scenes ---------------------------------------------------------------

export interface SceneBase {
  id: ID;
  campaignId: ID;
  name: string;
  type: SceneType;
  summary: string;
  thumbnailColor: string;
  isTemplate: boolean;
  updatedAt: string;
  folderId: ID | null;
  tokens: Token[];
}

export interface PlayingField extends SceneBase {
  type: "playing-field";
  ambience: {
    music: string | null;
    timeOfDay: "dawn" | "day" | "dusk" | "night";
    weather: "clear" | "rain" | "storm" | "snow" | "fog";
  };
  shopIds: ID[];
  prompts: ScenePrompt[];
}

export interface BattleField extends SceneBase {
  type: "battle-field";
  grid: { cols: number; rows: number };
  visionEnabled: boolean;
  initiative: InitiativeEntry[];
  round: number;
  interactives: Interactive[];
  triggers: Trigger[];
}

export type Scene = PlayingField | BattleField;

export interface ScenePrompt {
  id: ID;
  label: string; // "Inspect the statue"
  visibleTo: ID[] | "all";
}

// --- Tokens ---------------------------------------------------------------

export type TokenKind = "player" | "npc" | "enemy" | "object";

export interface Token {
  id: ID;
  refId: ID; // points at a Character / NPC / Enemy / Interactive
  kind: TokenKind;
  name: string;
  x: number; // grid cell / relative position 0..1
  y: number;
  color: string;
  hidden: boolean; // hidden from players
  hp?: { current: number; max: number };
  conditions?: string[];
}

// --- Initiative -----------------------------------------------------------

export interface InitiativeEntry {
  id: ID;
  tokenId: ID;
  name: string;
  initiative: number;
  isActive: boolean;
  kind: TokenKind;
}

// --- Interactive environment objects -------------------------------------

export type InteractiveState = "on" | "off" | "open" | "closed" | "broken" | "hidden";

export interface Interactive {
  id: ID;
  name: string; // "Iron Lever", "Pressure Plate"
  icon: string;
  state: InteractiveState;
  x: number;
  y: number;
  requires?: string; // "Iron Key", "DC 15 Athletics"
  note?: string;
}

// --- Trigger / effect logic ----------------------------------------------

export interface Trigger {
  id: ID;
  name: string;
  when: string; // "Lever pulled"
  conditions: string[]; // ["Party is inside", "Round >= 2"]
  effects: TriggerEffect[];
  enabled: boolean;
}

export interface TriggerEffect {
  id: ID;
  action: string; // "Open Gate"
  delayRounds: number;
}

// --- Shops ----------------------------------------------------------------

export type ShopMode = "automatic" | "approval" | "manual";

export interface Shop {
  id: ID;
  campaignId: ID;
  name: string;
  keeper: string;
  mode: ShopMode;
  allowSelling: boolean;
  requiresCheck: string | null; // "DC 12 Persuasion"
  items: ShopItem[];
}

export interface ShopItem {
  id: ID;
  itemId: ID;
  name: string;
  price: number; // in gold
  stock: number | null; // null = unlimited
  hidden: boolean;
  requirement: string | null; // "Str 13"
  meetsRequirement: boolean;
}

// --- Resources: characters, npcs, enemies, items, media, notes -----------

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface Attack {
  id: ID;
  name: string;
  bonus: number;
  damage: string; // "1d8+3 slashing"
  range: string; // "5 ft" / "80/320 ft"
}

export interface Spell {
  id: ID;
  name: string;
  level: number;
  school: string;
}

export interface Feature {
  id: ID;
  name: string;
  source: string; // "Class: Fighter"
  description: string;
}

export interface InventoryItem {
  id: ID;
  name: string;
  qty: number;
  equipped: boolean;
}

export interface Character {
  id: ID;
  campaignId: ID;
  name: string;
  playerName: string;
  ancestry: string;
  className: string;
  level: number;
  portraitColor: string;
  abilities: AbilityScores;
  hp: { current: number; max: number; temp: number };
  ac: number;
  speed: number;
  proficiencyBonus: number;
  skills: { name: string; ability: keyof AbilityScores; proficient: boolean }[];
  saves: { ability: keyof AbilityScores; proficient: boolean }[];
  attacks: Attack[];
  spells: Spell[];
  spellSlots: { level: number; current: number; max: number }[];
  features: Feature[];
  conditions: string[];
  inventory: InventoryItem[];
  currency: { cp: number; sp: number; gp: number; pp: number };
  traits: { personality: string; ideals: string; bonds: string; flaws: string };
}

export interface NPC {
  id: ID;
  campaignId: ID;
  name: string;
  role: string; // "Tavern Keeper"
  portraitColor: string;
  isShop: boolean;
  shopId: ID | null;
  disposition: "friendly" | "neutral" | "hostile";
  notes: string;
}

export interface Enemy {
  id: ID;
  campaignId: ID;
  name: string;
  type: string; // "Undead", "Beast"
  cr: string;
  hp: number;
  ac: number;
  portraitColor: string;
  attacks: Attack[];
  notes: string;
}

export interface Item {
  id: ID;
  campaignId: ID;
  name: string;
  category: string; // "Weapon", "Potion", "Wondrous"
  rarity: "common" | "uncommon" | "rare" | "very-rare" | "legendary";
  value: number; // gold
  weight: number;
  description: string;
}

export type MediaKind = "image" | "music" | "sfx";

export interface Media {
  id: ID;
  campaignId: ID;
  name: string;
  kind: MediaKind;
  color: string;
  tag: string; // "battle", "tavern"
  durationSec?: number;
}

export interface Note {
  id: ID;
  campaignId: ID;
  title: string;
  category: "lore" | "handout" | "rule" | "session" | "idea";
  body: string;
  secret: boolean; // hidden from players
  updatedAt: string;
}

export interface SessionLog {
  id: ID;
  campaignId: ID;
  date: string;
  title: string;
  summary: string;
  durationMin: number;
}
