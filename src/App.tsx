import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { JsonView } from "./components/JsonView";

const BASE = import.meta.env.BASE_URL;

type Category = {
  file: string;
  name: string;
  slug: string;
  icon: string;
  count: number;
};

type Item = { index?: string; name?: string; [k: string]: unknown };

export default function App() {
  const [cats, setCats] = useState<Category[]>([]);
  const [active, setActive] = useState<Category | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Load the folder manifest once.
  useEffect(() => {
    fetch(`${BASE}data/manifest.json`)
      .then((r) => r.json())
      .then(setCats)
      .catch(() => setCats([]));
  }, []);

  // Load a folder's contents on open.
  function openFolder(cat: Category) {
    setActive(cat);
    setSelected(null);
    setItems(null);
    setQuery("");
    setLoading(true);
    fetch(`${BASE}data/${cat.file}`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : [data]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }

  function goHome() {
    setActive(null);
    setItems(null);
    setSelected(null);
    setQuery("");
  }

  const filteredCats = useMemo(() => {
    const q = query.toLowerCase();
    return active ? cats : cats.filter((c) => c.name.toLowerCase().includes(q));
  }, [cats, query, active]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    const q = query.toLowerCase();
    return items.filter((it) =>
      (it.name ?? it.index ?? "").toString().toLowerCase().includes(q)
    );
  }, [items, query]);

  const totalItems = cats.reduce((s, c) => s + c.count, 0);

  return (
    <>
      <div className="aurora" />
      <div className="grid-overlay" />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <button onClick={goHome} className="group text-left">
            <h1 className="neon-text text-4xl font-black tracking-tight sm:text-5xl">
              🎲 Roll30
            </h1>
            <p className="mono mt-1 text-xs text-white/40">
              D&amp;D 5e SRD · {cats.length} folders · {totalItems.toLocaleString()} entries
            </p>
          </button>

          {/* Search */}
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2">
            <span className="text-white/40">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={active ? `Search in ${active.name}…` : "Search folders…"}
              className="w-44 bg-transparent text-sm outline-none placeholder:text-white/30 sm:w-60"
            />
          </div>
        </header>

        {/* Breadcrumbs */}
        <nav className="mono mb-5 flex items-center gap-2 text-sm text-white/50">
          <button onClick={goHome} className="hover:text-cyan-300">~/roll30</button>
          {active && (
            <>
              <span className="text-white/25">/</span>
              <button
                onClick={() => openFolder(active)}
                className="hover:text-cyan-300"
              >
                {active.slug}
              </button>
            </>
          )}
          {selected && (
            <>
              <span className="text-white/25">/</span>
              <span className="text-fuchsia-300">
                {(selected.index ?? selected.name)?.toString()}.json
              </span>
            </>
          )}
        </nav>

        {/* Body */}
        <main className="flex-1">
          <AnimatePresence mode="wait">
            {/* ROOT: folders */}
            {!active && (
              <motion.div
                key="folders"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
              >
                {filteredCats.map((cat, i) => (
                  <motion.button
                    key={cat.slug}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.015 }}
                    whileHover={{ y: -4 }}
                    onClick={() => openFolder(cat)}
                    className="glass card-glow group flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition"
                  >
                    <span className="text-3xl transition group-hover:scale-110">
                      {cat.icon}
                    </span>
                    <span className="font-semibold leading-tight">{cat.name}</span>
                    <span className="mono text-xs text-white/40">
                      {cat.count} {cat.count === 1 ? "item" : "items"}
                    </span>
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* FOLDER: item list + detail */}
            {active && !selected && (
              <motion.div
                key="items"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
              >
                {loading && (
                  <p className="mono animate-pulse text-white/40">loading {active.name}…</p>
                )}
                {!loading && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredItems.map((it, i) => (
                      <motion.button
                        key={(it.index ?? i).toString()}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.004, 0.3) }}
                        onClick={() => setSelected(it)}
                        className="glass card-glow flex items-center gap-3 rounded-xl px-4 py-3 text-left transition"
                      >
                        <span className="text-white/30">📄</span>
                        <span className="truncate text-sm font-medium">
                          {(it.name ?? it.index)?.toString()}
                        </span>
                      </motion.button>
                    ))}
                    {filteredItems.length === 0 && (
                      <p className="mono text-white/40">no matches.</p>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* DETAIL: pretty JSON */}
            {active && selected && (
              <motion.div
                key="detail"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="glass rounded-2xl p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-2xl font-bold">
                    {active.icon} {(selected.name ?? selected.index)?.toString()}
                  </h2>
                  <button
                    onClick={() => setSelected(null)}
                    className="mono rounded-lg border border-white/10 px-3 py-1 text-xs hover:border-cyan-400/60 hover:text-cyan-300"
                  >
                    ← back
                  </button>
                </div>
                <div className="mono overflow-x-auto rounded-xl bg-black/40 p-4 text-sm">
                  <JsonView data={selected} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mono mt-8 text-center text-xs text-white/25">
          Roll30 · built with Vite + React + Tailwind + Framer Motion · data from the 5e SRD
        </footer>
      </div>
    </>
  );
}
