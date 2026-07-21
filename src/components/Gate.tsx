import { useEffect, useState } from "react";
import { authorize, getMyIp, isIpAuthorized } from "../gate";

type Phase = "checking" | "prompt" | "granted";

export function Gate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [ip, setIp] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  // On load: grab our IP and auto-admit if it's already been authorized.
  useEffect(() => {
    (async () => {
      const myIp = await getMyIp();
      setIp(myIp);
      if (myIp && (await isIpAuthorized(myIp))) {
        setPhase("granted");
      } else {
        setPhase("prompt");
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const ok = await authorize(password, ip);
    setBusy(false);
    if (ok) {
      setPhase("granted");
    } else {
      setError(true);
      setPassword("");
    }
  }

  if (phase === "granted") return <>{children}</>;
  if (phase === "checking") return null;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          style={{ padding: 8, fontSize: 16 }}
        />
        <button type="submit" disabled={busy || !password} style={{ padding: 8, fontSize: 16 }}>
          {busy ? "…" : "Enter"}
        </button>
        {error && <span style={{ color: "crimson", fontSize: 13 }}>wrong password</span>}
      </form>
    </div>
  );
}
