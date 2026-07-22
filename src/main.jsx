import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Footprints,
  Grid3X3,
  ImageUp,
  Plus,
  SkipForward,
  Swords,
  Trash2,
} from "lucide-react";
import "./styles.css";
import "./movement.css";

const makeToken = (id) => ({
  id,
  name: "Token",
  x: 50,
  y: 50,
  hp: 10,
  maxHp: 10,
  ac: 10,
  speed: 30,
  color: ["#c96d58", "#769b79", "#7e83ba", "#bd9a52"][id % 4],
});
const cellsBetween = (a, b) => {
  const cells = [];
  let [x, y] = [a.x, a.y],
    dx = Math.abs(b.x - x),
    sx = x < b.x ? 1 : -1,
    dy = -Math.abs(b.y - y),
    sy = y < b.y ? 1 : -1,
    err = dx + dy;
  while (true) {
    cells.push({ x, y });
    if (x === b.x && y === b.y) break;
    const e = 2 * err;
    if (e >= dy) {
      err += dy;
      x += sx;
    }
    if (e <= dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
};
const pointInPolygon = (x, y, polygon) =>
  polygon.reduce((inside, point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return point.y > y !== next.y > y &&
      x < ((next.x - point.x) * (y - point.y)) / (next.y - point.y) + point.x
      ? !inside
      : inside;
  }, false);
const patternCells = (type, size) => {
  const n = Math.max(1, Math.floor(size)),
    cells = [];
  if (type === "diamond")
    for (let y = -n; y <= n; y++)
      for (let x = -n; x <= n; x++)
        if (Math.abs(x) + Math.abs(y) <= n) cells.push({ x, y });
  if (type === "square")
    for (let y = -n; y <= n; y++)
      for (let x = -n; x <= n; x++) cells.push({ x, y });
  if (type === "plus")
    for (let i = -n; i <= n; i++) {
      cells.push({ x: i, y: 0 });
      if (i) cells.push({ x: 0, y: i });
    }
  if (type === "star") {
    const points = Array.from({ length: 10 }, (_, i) => {
      const radius = i % 2 ? n * 0.9 : n * 2;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
    for (let y = -n * 2; y <= n * 2; y++)
      for (let x = -n * 2; x <= n * 2; x++)
        if (pointInPolygon(x, y, points) || (x === 0 && y === 0))
          cells.push({ x, y });
  }
  return cells;
};
const SIMPLE_ATTACK = { range: 2, pattern: "star", size: 2, damage: 3 };

function App() {
  const [map, setMap] = useState(null),
    [noMap, setNoMap] = useState(false),
    [mode, setMode] = useState("play"),
    [gridSize, setGridSize] = useState(48),
    [tokens, setTokens] = useState([]),
    [selectedId, setSelectedId] = useState(null),
    [drag, setDrag] = useState(null),
    [stat, setStat] = useState("hp"),
    [adjustment, setAdjustment] = useState(""),
    [battle, setBattle] = useState(null),
    [attackMode, setAttackMode] = useState(false),
    [attackTarget, setAttackTarget] = useState(null),
    [attackMessage, setAttackMessage] = useState(""),
    [moveMode, setMoveMode] = useState(false);
  const boardRef = useRef(null);
  const selected = tokens.find((t) => t.id === selectedId),
    activeId = battle?.order[battle.turn],
    active = tokens.find((t) => t.id === activeId);
  useEffect(() => {
    setBattle((b) => (b ? { ...b, dashReady: moveMode } : b));
  }, [moveMode]);
  const snap = (event, rect) => {
    const px = Math.max(
        gridSize / 2,
        Math.min(
          rect.width - gridSize / 2,
          Math.round((event.clientX - rect.left - gridSize / 2) / gridSize) *
            gridSize +
            gridSize / 2,
        ),
      ),
      py = Math.max(
        gridSize / 2,
        Math.min(
          rect.height - gridSize / 2,
          Math.round((event.clientY - rect.top - gridSize / 2) / gridSize) *
            gridSize +
            gridSize / 2,
        ),
      );
    return {
      x: (px / rect.width) * 100,
      y: (py / rect.height) * 100,
      cell: { x: Math.floor(px / gridSize), y: Math.floor(py / gridSize) },
    };
  };
  const cell = (token, rect) => ({
    x: Math.floor(((token.x / 100) * rect.width) / gridSize),
    y: Math.floor(((token.y / 100) * rect.height) / gridSize),
  });
  useEffect(() => {
    const move = (e) => {
      if (!drag || !boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      if (drag.battle) {
        const next = snap(e, rect),
          path = cellsBetween(drag.originCell, next.cell);
        setDrag((d) => ({ ...d, path, target: next }));
      } else {
        const x = Math.max(
            3,
            Math.min(97, ((e.clientX - rect.left) / rect.width) * 100),
          ),
          y = Math.max(
            3,
            Math.min(97, ((e.clientY - rect.top) / rect.height) * 100),
          );
        setTokens((items) =>
          items.map((t) => (t.id === drag.id ? { ...t, x, y } : t)),
        );
      }
    };
    const up = () => {
      if (!drag) return;
      if (drag.battle) {
        const speed = Math.floor(drag.speed / 5),
          distance = (drag.path?.length ?? 1) - 1,
          allowance = speed * (battle?.dashReady ? 2 : 1),
          usedDash = !!battle?.dashReady && distance > speed;
        if (distance <= allowance && distance > 0) {
          setTokens((items) =>
            items.map((t) =>
              t.id === drag.id
                ? { ...t, x: drag.target.x, y: drag.target.y }
                : t,
            ),
          );
          setBattle((b) => ({
            ...b,
            moved: true,
            dashed: usedDash,
            dashReady: false,
            log: `${active?.name} moved ${distance * 5} ft.`,
          }));
        } else if (distance === 0)
          setBattle((b) => ({ ...b, dashReady: false }));
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, active, battle]);
  const reset = () => {
    setBattle(null);
    setAttackMode(false);
  };
  const add = () => {
    const t = makeToken(Date.now());
    setTokens((x) => [...x, t]);
    setSelectedId(t.id);
    reset();
  };
  const start = () => {
    if (tokens.length < 2 || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect(),
      snapped = tokens.map((t) => {
        const cx = Math.max(
            0,
            Math.floor(((t.x / 100) * rect.width) / gridSize),
          ),
          cy = Math.max(0, Math.floor(((t.y / 100) * rect.height) / gridSize));
        return {
          ...t,
          x: ((cx * gridSize + gridSize / 2) / rect.width) * 100,
          y: ((cy * gridSize + gridSize / 2) / rect.height) * 100,
          initiative: Math.floor(Math.random() * 20) + 1,
        };
      }),
      order = [...snapped].sort((a, b) => b.initiative - a.initiative);
    setTokens(snapped);
    setBattle({
      order: order.map((t) => t.id),
      initiatives: Object.fromEntries(order.map((t) => [t.id, t.initiative])),
      turn: 0,
      round: 1,
      moved: false,
      attacked: false,
      dashed: false,
      dashReady: false,
      log: "Initiative rolled. Battle begins!",
    });
    setSelectedId(order[0].id);
    setAttackMode(false);
  };
  const nextTurn = (updated, log) => {
    let n = (battle.turn + 1) % battle.order.length;
    while (updated.find((t) => t.id === battle.order[n])?.hp <= 0)
      n = (n + 1) % battle.order.length;
    const next = updated.find((t) => t.id === battle.order[n]);
    setBattle({
      ...battle,
      turn: n,
      round: n <= battle.turn ? battle.round + 1 : battle.round,
      moved: false,
      attacked: false,
      dashed: false,
      dashReady: false,
      log,
    });
    setSelectedId(next.id);
    setAttackMode(false);
  };
  const attack = (id) => {
    const target = tokens.find((t) => t.id === id);
    const rect = boardRef.current?.getBoundingClientRect();
    const origin = rect && active ? cell(active, rect) : null;
    const targetCell = rect && target ? cell(target, rect) : null;
    if (
      origin &&
      targetCell &&
      Math.max(
        Math.abs(targetCell.x - origin.x),
        Math.abs(targetCell.y - origin.y),
      ) > SIMPLE_ATTACK.range
    ) {
      setAttackMessage("That target is out of range (2 squares).");
      return;
    }
    if (
      !active ||
      !target ||
      battle.attacked ||
      battle.dashed ||
      target.hp <= 0 ||
      !origin ||
      !targetCell ||
      Math.max(
        Math.abs(targetCell.x - origin.x),
        Math.abs(targetCell.y - origin.y),
      ) > SIMPLE_ATTACK.range
    )
      return;
    const affected = new Set(
      patternCells(SIMPLE_ATTACK.pattern, SIMPLE_ATTACK.size).map(
        (offset) => `${targetCell.x + offset.x},${targetCell.y + offset.y}`,
      ),
    );
    const hitIds = new Set(
      tokens
        .filter(
          (t) =>
            t.id !== active.id &&
            affected.has(`${cell(t, rect).x},${cell(t, rect).y}`),
        )
        .map((t) => t.id),
    );
    const updated = tokens.map((t) =>
        hitIds.has(t.id)
          ? { ...t, hp: Math.max(0, t.hp - SIMPLE_ATTACK.damage) }
          : t,
      ),
      alive = updated.filter((t) => t.hp > 0);
    setTokens(updated);
    if (alive.length <= 1) {
      setBattle({
        ...battle,
        complete: true,
        log: `${active.name}'s star hits for ${SIMPLE_ATTACK.damage} damage. ${alive[0]?.name ?? "No one"} wins!`,
      });
      setAttackMode(false);
    } else
      nextTurn(
        updated,
        `${active.name}'s star hits ${hitIds.size} token(s) for ${SIMPLE_ATTACK.damage} damage.`,
      );
  };
  const end = () =>
    !battle?.complete && nextTurn(tokens, `${active?.name} ended their turn.`);
  const down = (e, t) => {
    e.preventDefault();
    if (attackMode && t.id !== activeId && t.hp > 0) return attack(t.id);
    setSelectedId(t.id);
    if (
      battle &&
      !battle.complete &&
      t.id === activeId &&
      !battle.attacked &&
      !battle.moved &&
      boardRef.current
    ) {
      const r = boardRef.current.getBoundingClientRect();
      setDrag({
        id: t.id,
        origin: { x: t.x, y: t.y },
        originCell: cell(t, r),
        speed: t.speed,
        battle: true,
        path: [cell(t, r)],
      });
    } else if (!battle) setDrag({ id: t.id, battle: false });
  };
  const canAttackTarget = (t) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || !active || t.id === active.id || t.hp <= 0) return false;
    const a = cell(active, rect),
      b = cell(t, rect);
    return (
      Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= SIMPLE_ATTACK.range
    );
  };
  return (
    <div className="app">
      <header>
        <strong>Roll30</strong>
        <span>Simple tabletop board</span>
        <div className="mode-switch">
          <button
            className={mode === "play" ? "active" : ""}
            onClick={() => setMode("play")}
          >
            Play
          </button>
          <button
            className={mode === "battle" ? "active" : ""}
            onClick={() => setMode("battle")}
          >
            <Swords size={15} /> Battle
          </button>
        </div>
      </header>
      <main>
        <section className="board-column">
          <div className="controls">
            <label className="button">
              <ImageUp size={17} /> Upload image
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  e.target.files?.[0] &&
                  (setMap(URL.createObjectURL(e.target.files[0])), setNoMap(false))
                }
              />
            </label>
            <button className="button" onClick={() => { setMap(null); setNoMap(true); }}>
              No map
            </button>
            <button className="button" onClick={add}>
              <Plus size={17} /> Add token
            </button>
            {mode === "battle" && (
              <>
                <span className="battle-grid">
                  <Grid3X3 size={17} /> 5 ft squares
                </span>
                <label className="grid-size">
                  Grid size{" "}
                  <input
                    type="range"
                    min="24"
                    max="80"
                    value={gridSize}
                    onChange={(e) => setGridSize(+e.target.value)}
                  />
                </label>
              </>
            )}
          </div>
          <div
            ref={boardRef}
            className={"board " + (!map && !noMap ? "empty" : "") + (noMap ? " no-map" : "")}
            style={{
              backgroundImage: map ? `url(${map})` : undefined,
              "--grid-size": `${gridSize}px`,
            }}
          >
            {!map && !noMap && (
              <div className="empty-message">
                <ImageUp size={28} />
                <strong>Upload a map image to begin</strong>
                <span>You can add and move tokens at any time.</span>
              </div>
            )}
            {mode === "battle" && <div className="grid" />}
            {drag?.battle && (
              <>
                <div className="move-counter">
                  {((drag.path?.length ?? 1) - 1) * 5} ft /{" "}
                  {drag.speed * (battle?.dashReady ? 2 : 1)} ft
                </div>
                {drag.target && <i className="move-arrow" style={{ left: `${drag.origin.x}%`, top: `${drag.origin.y}%`, width: `${Math.hypot(drag.target.x-drag.origin.x, drag.target.y-drag.origin.y)}%`, transform: `rotate(${Math.atan2(drag.target.y-drag.origin.y, drag.target.x-drag.origin.x)}rad)` }} />}
                {drag.path?.map((p, i) => (
                  <i
                    key={`${p.x}-${p.y}`}
                    className={
                      "move-cell " +
                      (i === 0
                        ? "origin"
                        : i >
                            Math.floor(drag.speed / 5) *
                              (battle?.dashReady ? 2 : 1)
                          ? "over"
                          : "")
                    }
                    style={{
                      left: p.x * gridSize,
                      top: p.y * gridSize,
                      width: gridSize,
                      height: gridSize,
                    }}
                  />
                ))}
              </>
            )}
            {battle && !battle.complete && active && (
              <div
                className="map-actions"
                style={{ left: `${active.x}%`, top: `${active.y}%` }}
              >
                <button
                  className={battle.dashReady ? "armed" : ""}
                  disabled={battle.moved || battle.attacked}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setMoveMode((v) => !v)}
                >
                  <Footprints size={16} />
                </button>
                <button
                  className={attackMode ? "armed" : ""}
                  disabled={battle.attacked || battle.dashed}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setAttackMode((v) => !v)}
                >
                  <Swords size={16} />
                </button>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={end}
                  aria-label="End turn early"
                >
                  <SkipForward size={16} />
                </button>
              </div>
            )}
            {attackMode && (
              <div className="attack-prompt">
                Choose a token to attack · 3 damage
              </div>
            )}
            {attackMode && attackTarget && boardRef.current && patternCells(SIMPLE_ATTACK.pattern, SIMPLE_ATTACK.size).map((offset) => { const c = cell(tokens.find((t) => t.id === attackTarget), boardRef.current.getBoundingClientRect()); return <i key={`attack-${offset.x}-${offset.y}`} className="attack-cell" style={{ left: (c.x + offset.x) * gridSize, top: (c.y + offset.y) * gridSize, width: gridSize, height: gridSize }} /> })}
            {attackMessage && <div className="attack-error">{attackMessage}</div>}
            {tokens.map((t) => (
              <button
                key={t.id}
                className={
                  "token " +
                  (selectedId === t.id ? "selected " : "") +
                  (attackMode && canAttackTarget(t)
                    ? "targetable"
                    : "")
                }
                style={{
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  "--token-colour": t.color,
                }}
                onPointerDown={(e) => down(e, t)}
                onPointerEnter={() => attackMode && setAttackTarget(t.id)}
              >
                <span>{t.name.slice(0, 2).toUpperCase()}</span>
                <small>{t.name}</small>
              </button>
            ))}
          </div>
        </section>
        <aside className="inspector">
          {mode === "battle" && (
            <Combat
              battle={battle}
              tokens={tokens}
              active={active}
              activeId={activeId}
              start={start}
            />
          )}{" "}
          {selected ? (
            <>
              <div>
                <p>SELECTED TOKEN</p>
                <h1>Token details</h1>
              </div>
              <label>
                Name
                <input
                  value={selected.name}
                  onChange={(e) =>
                    setTokens((x) =>
                      x.map((t) =>
                        t.id === selectedId
                          ? { ...t, name: e.target.value }
                          : t,
                      ),
                    )
                  }
                />
              </label>
              {mode === "battle" && (
                <>
                  <div className="stats">
                    <div>
                      <span>HP</span>
                      <strong>{selected.hp}</strong>
                    </div>
                    <div>
                      <span>MAX HP</span>
                      <strong>{selected.maxHp}</strong>
                    </div>
                    <div>
                      <span>AC</span>
                      <strong>{selected.ac}</strong>
                    </div>
                    <div>
                      <span>SPEED</span>
                      <strong>{selected.speed} ft</strong>
                    </div>
                  </div>
                  <div className="health">
                    <span>Health</span>
                    <strong>
                      {selected.hp} / {selected.maxHp}
                    </strong>
                    <i>
                      <b
                        style={{
                          width: `${Math.min(100, (selected.hp / selected.maxHp) * 100)}%`,
                        }}
                      />
                    </i>
                  </div>
                  <form
                    className="calculator"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const n = Number(adjustment);
                      if (Number.isFinite(n) && adjustment.trim())
                        setTokens((x) =>
                          x.map((t) =>
                            t.id === selectedId
                              ? { ...t, [stat]: Math.max(0, t[stat] + n) }
                              : t,
                          ),
                        );
                      setAdjustment("");
                    }}
                  >
                    <label>
                      Adjust stat
                      <select
                        value={stat}
                        onChange={(e) => setStat(e.target.value)}
                      >
                        <option value="hp">HP</option>
                        <option value="maxHp">Max HP</option>
                        <option value="ac">AC</option>
                        <option value="speed">Speed</option>
                      </select>
                    </label>
                    <label>
                      Amount
                      <input
                        value={adjustment}
                        onChange={(e) => setAdjustment(e.target.value)}
                        placeholder="e.g. +5 or -5"
                      />
                    </label>
                    <button className="button">Apply</button>
                  </form>
                </>
              )}
              <button
                className="remove"
                onClick={() => {
                  setTokens((x) => x.filter((t) => t.id !== selectedId));
                  setSelectedId(null);
                  reset();
                }}
              >
                <Trash2 size={16} /> Remove token
              </button>
            </>
          ) : (
            <div className="no-selection">
              <p>NO TOKEN SELECTED</p>
              <h1>Add a token</h1>
              <button className="button" onClick={add}>
                <Plus size={17} /> Add token
              </button>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
function Combat({ battle, tokens, active, activeId, start }) {
  if (!battle)
    return (
      <section className="combat-panel">
        <p>COMBAT</p>
        <h1>Ready to battle</h1>
        <span>Roll initiative and begin turn order.</span>
        <button
          className="start-battle"
          onClick={start}
          disabled={tokens.length < 2}
        >
          <Swords size={16} /> Start battle
        </button>
      </section>
    );
  return (
    <section className="combat-panel">
      <div className="combat-heading">
        <div>
          <p>{battle.complete ? "BATTLE COMPLETE" : `ROUND ${battle.round}`}</p>
          <h1>
            {battle.complete ? "Battle finished" : `${active?.name}'s turn`}
          </h1>
        </div>
        {!battle.complete && <span className="turn-dot" />}
      </div>
      <ol className="initiative">
        {battle.order.map((id, i) => {
          const t = tokens.find((x) => x.id === id);
          return (
            t && (
              <li
                key={id}
                className={
                  (id === activeId && !battle.complete ? "current " : "") +
                  (t.hp <= 0 ? "down" : "")
                }
              >
                <span>{i + 1}</span>
                <strong>{t.name}</strong>
                <em>{battle.initiatives[id]}</em>
              </li>
            )
          );
        })}
      </ol>
      <p className="combat-log">{battle.log}</p>
      {!battle.complete && (
        <>
          <span className="attack-help">
            Drag the active token to move, then use the icons beside it.
          </span>
        </>
      )}
    </section>
  );
}
createRoot(document.getElementById("root")).render(<App />);
