import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authorize, getMyIp, isIpAuthorized } from "../gate";

type Phase = "checking" | "prompt" | "granted";

export function Gate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [ip, setIp] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  // On load: grab our IP and see if it's already been authorized.
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

  return (
    <>
      <div className="aurora" />
      <div className="grid-overlay" />
      <div className="flex min-h-screen items-center justify-center px-4">
        <AnimatePresence mode="wait">
          {phase === "checking" ? (
            <motion.p
              key="checking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mono animate-pulse text-white/50"
            >
              checking access…
            </motion.p>
          ) : (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="glass w-full max-w-sm rounded-3xl p-8 text-center"
            >
              <div className="mb-2 text-5xl">🔒</div>
              <h1 className="neon-text mb-1 text-3xl font-black">Roll30</h1>
              <p className="mono mb-6 text-xs text-white/40">
                enter the password to continue
              </p>

              <form onSubmit={submit} className="space-y-3">
                <motion.input
                  animate={error ? { x: [-8, 8, -6, 6, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  className={`mono w-full rounded-xl border bg-black/40 px-4 py-3 text-center outline-none transition ${
                    error
                      ? "border-rose-500/70 text-rose-300"
                      : "border-white/10 focus:border-cyan-400/60"
                  }`}
                />
                <button
                  type="submit"
                  disabled={busy || !password}
                  className="w-full rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 px-4 py-3 font-semibold transition hover:brightness-110 disabled:opacity-40"
                >
                  {busy ? "checking…" : "Enter"}
                </button>
              </form>

              {error && (
                <p className="mono mt-3 text-xs text-rose-400">
                  wrong password — try again
                </p>
              )}
              <p className="mono mt-6 text-[10px] leading-relaxed text-white/25">
                once correct, this device's network is remembered so you skip
                the password next time.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
