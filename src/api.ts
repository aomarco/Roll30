// ---------------------------------------------------------------------------
// Data access layer. The UI ONLY talks to these functions — it never imports
// mock data directly. Each returns a Promise, exactly as a real network client
// would, so replacing the bodies with `fetch(...)` / Supabase calls later is a
// localized change with no UI churn.
// ---------------------------------------------------------------------------

import * as mock from "./mock/data";
import type {
  Campaign, Character, Enemy, Folder, Item, Media, NPC, Note, Scene, Shop, SessionLog,
} from "./types";

// Simulate a little latency so loading states are real and exercised.
const wait = <T>(v: T, ms = 180): Promise<T> =>
  new Promise((res) => setTimeout(() => res(structuredClone(v)), ms));

const inCampaign = <T extends { campaignId: string }>(rows: T[], id: string) =>
  rows.filter((r) => r.campaignId === id);

export const api = {
  campaigns: () => wait(mock.campaigns),
  campaign: (id: string) => wait(mock.campaigns.find((c) => c.id === id) ?? null),

  scenes: (campaignId: string): Promise<Scene[]> => wait(inCampaign(mock.scenes, campaignId)),
  scene: (id: string): Promise<Scene | null> => wait(mock.scenes.find((s) => s.id === id) ?? null),
  folders: (): Promise<Folder[]> => wait(mock.folders),

  characters: (campaignId: string): Promise<Character[]> => wait(inCampaign(mock.characters, campaignId)),
  character: (id: string): Promise<Character | null> => wait(mock.characters.find((c) => c.id === id) ?? null),

  npcs: (campaignId: string): Promise<NPC[]> => wait(inCampaign(mock.npcs, campaignId)),
  enemies: (campaignId: string): Promise<Enemy[]> => wait(inCampaign(mock.enemies, campaignId)),
  items: (campaignId: string): Promise<Item[]> => wait(inCampaign(mock.items, campaignId)),
  media: (campaignId: string): Promise<Media[]> => wait(inCampaign(mock.media, campaignId)),
  notes: (campaignId: string): Promise<Note[]> => wait(inCampaign(mock.notes, campaignId)),
  shops: (campaignId: string): Promise<Shop[]> => wait(inCampaign(mock.shops, campaignId)),
  shop: (id: string): Promise<Shop | null> => wait(mock.shops.find((s) => s.id === id) ?? null),
  sessionLogs: (campaignId: string): Promise<SessionLog[]> => wait(inCampaign(mock.sessionLogs, campaignId)),

  // --- Mutations (placeholders) ------------------------------------------
  // These resolve without persisting. Wire them to real writes later; the UI
  // already awaits them and can show optimistic/pending states.
  save: <T>(_entity: string, value: T): Promise<T> => wait(value, 120),
  remove: (_entity: string, _id: string): Promise<{ ok: true }> => wait({ ok: true } as const, 120),
} as const;

export type Api = typeof api;
