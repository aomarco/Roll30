// ---------------------------------------------------------------------------
// App-wide UI state: who is viewing (role), which campaign/scene is open, and
// whether the GM is in Build or Session mode. Kept deliberately small — domain
// data lives behind `api`, this is just navigation + viewer context.
// ---------------------------------------------------------------------------

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Role, SceneMode } from "./types";

export type View =
  | { name: "campaigns" }
  | { name: "dashboard" }
  | { name: "scenes" }
  | { name: "scene"; sceneId: string }
  | { name: "characters" }
  | { name: "character"; characterId: string }
  | { name: "npcs" }
  | { name: "enemies" }
  | { name: "items" }
  | { name: "shops" }
  | { name: "media" }
  | { name: "notes" }
  | { name: "templates" }
  | { name: "history" };

interface AppState {
  role: Role;
  setRole: (r: Role) => void;
  campaignId: string | null;
  openCampaign: (id: string) => void;
  leaveCampaign: () => void;
  view: View;
  go: (v: View) => void;
  mode: SceneMode;
  setMode: (m: SceneMode) => void;
  // The player currently being "seated" as, for role=player preview.
  seatCharacterId: string;
  setSeatCharacterId: (id: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("gm");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [view, setView] = useState<View>({ name: "campaigns" });
  const [mode, setMode] = useState<SceneMode>("build");
  const [seatCharacterId, setSeatCharacterId] = useState<string>("char_1");

  const openCampaign = (id: string) => {
    setCampaignId(id);
    setView({ name: "dashboard" });
  };
  const leaveCampaign = () => {
    setCampaignId(null);
    setView({ name: "campaigns" });
  };

  return (
    <Ctx.Provider
      value={{
        role, setRole, campaignId, openCampaign, leaveCampaign,
        view, go: setView, mode, setMode, seatCharacterId, setSeatCharacterId,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}
