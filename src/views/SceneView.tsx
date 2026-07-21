import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { useApp } from "../state";
import { Icon } from "../ui/icons";
import { RoleSwitch } from "../ui/RoleSwitch";
import { Skeleton } from "../ui/primitives";
import { PlayingFieldScene } from "./PlayingField";
import { BattleFieldScene } from "./BattleField";
import { GMToolsPanel } from "./GMToolsPanel";

export function SceneView({ sceneId }: { sceneId: string }) {
  const { go, mode, setMode } = useApp();
  const { data: scene, loading } = useAsync(() => api.scene(sceneId), [sceneId]);
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Scene chrome */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-canvas)]/90 px-4 py-2.5 backdrop-blur">
        <button className="btn btn-ghost btn-sm" onClick={() => go({ name: "scenes" })}>
          <Icon name="back" size={15} /> Scenes
        </button>
        <div className="min-w-0 flex-1">
          {loading ? <Skeleton className="h-5 w-40" /> : (
            <div className="flex items-center gap-2">
              <Icon name={scene?.type === "battle-field" ? "sword" : "map"} size={15}
                className={scene?.type === "battle-field" ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"} />
              <span className="truncate font-bold">{scene?.name}</span>
            </div>
          )}
        </div>

        {/* Build / Session toggle (GM only concept) */}
        <div className="inline-flex rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] p-1">
          {(["build", "session"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`btn btn-sm gap-1.5 ${mode === m ? "btn-primary" : "btn-ghost border-transparent"}`}>
              <Icon name={m === "build" ? "build" : "play"} size={14} /> {m === "build" ? "Build" : "Session"}
            </button>
          ))}
        </div>

        <button className={`btn btn-sm ${toolsOpen ? "btn-primary" : "btn-subtle"}`} onClick={() => setToolsOpen((o) => !o)}>
          <Icon name="gm" size={14} /> GM Tools
        </button>
        <RoleSwitch compact />
      </header>

      <div className="flex flex-1">
        <div className="min-w-0 flex-1">
          {loading && <div className="p-6"><Skeleton className="h-[70vh] w-full" /></div>}
          {scene?.type === "playing-field" && <PlayingFieldScene scene={scene} />}
          {scene?.type === "battle-field" && <BattleFieldScene scene={scene} />}
        </div>
        {toolsOpen && <GMToolsPanel scene={scene ?? null} onClose={() => setToolsOpen(false)} />}
      </div>
    </div>
  );
}
