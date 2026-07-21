import { useApp } from "../state";
import { Icon } from "./icons";

/** Toggle the viewer between GM and Player. Demonstrates the two experiences
 *  the concept doc describes. In a real deployment the role would come from
 *  the authenticated user, not a toggle. */
export function RoleSwitch({ compact = false }: { compact?: boolean }) {
  const { role, setRole } = useApp();
  return (
    <div
      className="inline-flex items-center rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] p-1"
      role="tablist" aria-label="Viewing role"
    >
      {(["gm", "player"] as const).map((r) => (
        <button
          key={r}
          role="tab"
          aria-selected={role === r}
          onClick={() => setRole(r)}
          className={`btn btn-sm gap-1.5 ${role === r ? "btn-primary" : "btn-ghost border-transparent"}`}
        >
          <Icon name={r === "gm" ? "gm" : "player"} size={14} />
          {!compact && (r === "gm" ? "Game Master" : "Player")}
        </button>
      ))}
    </div>
  );
}
