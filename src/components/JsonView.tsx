import { useState } from "react";

/** A small collapsible, syntax-coloured JSON tree viewer. */
export function JsonView({ data }: { data: unknown }) {
  return <Node value={data} name={null} depth={0} defaultOpen />;
}

function Node({
  value,
  name,
  depth,
  defaultOpen = false,
}: {
  value: unknown;
  name: string | null;
  depth: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || depth < 1);
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object";

  const key =
    name !== null ? <span className="text-cyan-300">{name}</span> : null;

  if (!isObject) {
    return (
      <div style={{ paddingLeft: depth * 14 }} className="leading-6">
        {key}
        {key && <span className="text-white/40">: </span>}
        <Leaf value={value} />
      </div>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  const bracket = isArray ? ["[", "]"] : ["{", "}"];

  return (
    <div style={{ paddingLeft: depth * 14 }} className="leading-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-left hover:text-fuchsia-300"
      >
        <span className="text-white/40">{open ? "▾" : "▸"} </span>
        {key}
        {key && <span className="text-white/40">: </span>}
        <span className="text-white/50">
          {bracket[0]}
          {!open && <span className="text-white/30"> {entries.length}… </span>}
          {!open && bracket[1]}
        </span>
      </button>
      {open && (
        <>
          {entries.map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} />
          ))}
          <div style={{ paddingLeft: depth * 14 }} className="text-white/50">
            {bracket[1]}
          </div>
        </>
      )}
    </div>
  );
}

function Leaf({ value }: { value: unknown }) {
  if (typeof value === "string")
    return <span className="text-emerald-300">"{value}"</span>;
  if (typeof value === "number")
    return <span className="text-amber-300">{value}</span>;
  if (typeof value === "boolean")
    return <span className="text-fuchsia-300">{String(value)}</span>;
  if (value === null) return <span className="text-white/30">null</span>;
  return <span>{String(value)}</span>;
}
