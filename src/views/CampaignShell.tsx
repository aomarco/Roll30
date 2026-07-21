import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { useApp, type View } from "../state";
import { Icon, type IconName } from "../ui/icons";
import { RoleSwitch } from "../ui/RoleSwitch";
import { DashboardView } from "./DashboardView";
import { ScenesView } from "./ScenesView";
import { SceneView } from "./SceneView";
import { CharactersView, CharacterSheetView } from "./CharactersView";
import { ResourceView } from "./ResourceView";
import { ShopsView } from "./ShopsView";
import { NotesView } from "./NotesView";
import { TemplatesView } from "./TemplatesView";
import { HistoryView } from "./HistoryView";

const NAV: { view: View["name"]; label: string; icon: IconName }[] = [
  { view: "dashboard", label: "Overview", icon: "dashboard" },
  { view: "scenes", label: "Scenes", icon: "scenes" },
  { view: "characters", label: "Characters", icon: "characters" },
  { view: "npcs", label: "NPCs", icon: "npc" },
  { view: "enemies", label: "Enemies", icon: "enemy" },
  { view: "items", label: "Items", icon: "item" },
  { view: "shops", label: "Shops", icon: "shop" },
  { view: "media", label: "Media", icon: "media" },
  { view: "notes", label: "Notes & Lore", icon: "note" },
  { view: "templates", label: "Templates", icon: "template" },
  { view: "history", label: "Session History", icon: "history" },
];

export function CampaignShell() {
  const { campaignId, view, go, leaveCampaign } = useApp();
  const { data: campaign } = useAsync(() => api.campaign(campaignId!), [campaignId]);
  const [navOpen, setNavOpen] = useState(false);

  // Scene editor takes over the full frame (its own chrome).
  if (view.name === "scene") return <SceneView sceneId={view.sceneId} />;

  const activeGroup: string =
    view.name === "character" ? "characters" : view.name;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-[var(--color-line)] bg-[var(--color-surface)] transition-transform lg:static lg:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-full flex-col">
          <button onClick={leaveCampaign} className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-4 text-left hover:bg-[var(--color-surface-2)]">
            <Icon name="back" size={16} className="text-[var(--color-ink-faint)]" />
            <div className="min-w-0">
              <p className="truncate font-bold leading-tight">{campaign?.name ?? "…"}</p>
              <p className="mono text-xs text-[var(--color-ink-faint)]">{campaign?.code}</p>
            </div>
          </button>

          <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {NAV.map((n) => (
              <button
                key={n.view}
                onClick={() => { go({ name: n.view } as View); setNavOpen(false); }}
                aria-current={activeGroup === n.view ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeGroup === n.view
                    ? "bg-[var(--color-accent)]/15 text-[var(--color-accent-soft)]"
                    : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
                }`}
              >
                <Icon name={n.icon} size={17} /> {n.label}
              </button>
            ))}
          </nav>

          <div className="border-t border-[var(--color-line)] p-3">
            <RoleSwitch compact />
            <p className="mt-2 px-1 text-[10px] leading-tight text-[var(--color-ink-faint)]">
              Preview the player experience with the toggle above.
            </p>
          </div>
        </div>
      </aside>

      {navOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setNavOpen(false)} />}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-canvas)]/85 px-4 py-3 backdrop-blur lg:hidden">
          <button className="btn btn-ghost btn-icon" onClick={() => setNavOpen(true)} aria-label="Open menu"><Icon name="menu" size={18} /></button>
          <span className="font-bold">{campaign?.name}</span>
        </header>

        <main className="mx-auto max-w-6xl px-5 py-8">
          <div key={view.name} className="fadein">
            {view.name === "dashboard" && <DashboardView />}
            {view.name === "scenes" && <ScenesView />}
            {view.name === "characters" && <CharactersView />}
            {view.name === "character" && <CharacterSheetView characterId={view.characterId} />}
            {view.name === "npcs" && <ResourceView kind="npcs" />}
            {view.name === "enemies" && <ResourceView kind="enemies" />}
            {view.name === "items" && <ResourceView kind="items" />}
            {view.name === "media" && <ResourceView kind="media" />}
            {view.name === "shops" && <ShopsView />}
            {view.name === "notes" && <NotesView />}
            {view.name === "templates" && <TemplatesView />}
            {view.name === "history" && <HistoryView />}
          </div>
        </main>
      </div>
    </div>
  );
}
