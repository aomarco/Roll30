import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Grid3X3,
  ImageUp,
  Minus,
  Plus,
  Search,
  Settings2,
  SkipForward,
  Swords,
  Trash2,
  Users,
} from "lucide-react";
import "./styles.css";
import "./movement.css";
import "./premium.css";
import "./motion.css";
import "./layout.css";
import "./studio.css";
import { patternCells } from "./patterns.js";
import CharactersPage from "./CharactersPage.jsx";
import { deriveCharacter } from "./characterRules.js";
import { resolveWeaponAttack, WEAPONS } from "./weapons.js";
import {
  ITEM_TYPES,
  changeInventoryQuantity,
  filterCatalog,
  inventoryItemIds,
  normalizeInventory,
} from "./items.js";
import MapSettingsPage from "./MapSettingsPage.jsx";

const makeToken = (id) => ({
  id,
  name: "Token",
  x: 50,
  y: 50,
  hp: 10,
  maxHp: 10,
  ac: 10,
  speed: 30,
  initiativeBonus: 0,
  strength: 10,
  dexterity: 10,
  level: 1,
  inventory: [],
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

const readStoredMaps = () => {
  try {
    const value = JSON.parse(localStorage.getItem("roll30-maps") || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};
const INITIAL_MAPS = readStoredMaps();
const INITIAL_ACTIVE_ID = localStorage.getItem("roll30-active-map") || null;
const INITIAL_ENTRY = INITIAL_MAPS.find(
  (entry) => entry.id === INITIAL_ACTIVE_ID,
);
const INITIAL_DATA = INITIAL_ENTRY?.data || {};
const imageDb = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open("roll30-assets", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
const saveMapImage = async (id, image) => {
  const db = await imageDb();
  const tx = db.transaction("images", "readwrite");
  tx.objectStore("images").put(image, id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};
const loadMapImage = async (id) => {
  const db = await imageDb();
  const request = db.transaction("images").objectStore("images").get(id);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};
const deleteMapImage = async (id) => {
  const db = await imageDb();
  const tx = db.transaction("images", "readwrite");
  tx.objectStore("images").delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
};
const playHitSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContext(),
      now = context.currentTime;
    const gain = context.createGain(),
      thump = context.createOscillator();
    thump.type = "triangle";
    thump.frequency.setValueAtTime(130, now);
    thump.frequency.exponentialRampToValueAtTime(42, now + 0.16);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    thump.connect(gain).connect(context.destination);
    thump.start(now);
    thump.stop(now + 0.2);
    thump.onended = () => context.close();
  } catch {
    /* Audio may be unavailable or disabled. */
  }
};

function App() {
  const [maps, setMaps] = useState(INITIAL_MAPS),
    [activeMapId, setActiveMapId] = useState(null),
    [mapName, setMapName] = useState(""),
    [createMode, setCreateMode] = useState("battle"),
    [map, setMap] = useState(INITIAL_DATA.map || null),
    [noMap, setNoMap] = useState(!!INITIAL_DATA.noMap),
    [mode, setMode] = useState(
      INITIAL_ENTRY?.mode || INITIAL_DATA.mode || "play",
    ),
    [gridSize, setGridSize] = useState(INITIAL_DATA.gridSize || 48),
    [tokens, setTokens] = useState(INITIAL_DATA.tokens || []),
    [selectedId, setSelectedId] = useState(null),
    [drag, setDrag] = useState(null),
    [stat, setStat] = useState("hp"),
    [adjustment, setAdjustment] = useState(""),
    [statMessage, setStatMessage] = useState(""),
    [battle, setBattle] = useState(INITIAL_DATA.battle || null),
    [attackMode, setAttackMode] = useState(false),
    [weaponMenuOpen, setWeaponMenuOpen] = useState(false),
    [selectedWeaponId, setSelectedWeaponId] = useState("longsword"),
    [attackMessage, setAttackMessage] = useState(""),
    [storageError, setStorageError] = useState(""),
    [characters, setCharacters] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem("roll30-characters") || "[]");
      } catch {
        return [];
      }
    }),
    [showCharacters, setShowCharacters] = useState(false),
    [showSettings, setShowSettings] = useState(false),
    [settingsReturn, setSettingsReturn] = useState("map"),
    [selectedCharacterId, setSelectedCharacterId] = useState(""),
    [quickItemQuery, setQuickItemQuery] = useState(""),
    [quickItemType, setQuickItemType] = useState("all"),
    [damagePopups, setDamagePopups] = useState([]);
  const selectedWeapon =
    WEAPONS.find((weapon) => weapon.id === selectedWeaponId) || null;
  const boardRef = useRef(null);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animateInteraction = (event) => {
      const control = event.target.closest(
        "button:not(:disabled), label.button, input, select",
      );
      if (!control) return;
      if (reduced.matches) return;
      const burst = document.createElement("span");
      burst.className = "click-burst";
      burst.style.left = `${event.clientX}px`;
      burst.style.top = `${event.clientY}px`;
      for (let index = 0; index < 7; index += 1) {
        const spark = document.createElement("i");
        spark.style.setProperty("--spark-angle", `${index * (360 / 7)}deg`);
        spark.style.setProperty(
          "--spark-distance",
          `${16 + (index % 3) * 5}px`,
        );
        burst.appendChild(spark);
      }
      document.body.appendChild(burst);
      window.setTimeout(() => burst.remove(), 620);
    };
    document.addEventListener("pointerdown", animateInteraction);
    return () =>
      document.removeEventListener("pointerdown", animateInteraction);
  }, []);
  useEffect(() => {
    try {
      const lightweightMaps = maps.map((entry) => ({
        ...entry,
        data: entry.data
          ? {
              ...entry.data,
              map: null,
              hasImage: !!entry.data.map || !!entry.data.hasImage,
            }
          : entry.data,
      }));
      localStorage.setItem("roll30-maps", JSON.stringify(lightweightMaps));
      localStorage.setItem("roll30-active-map", activeMapId || "");
      setStorageError("");
    } catch (error) {
      setStorageError(
        error?.name === "QuotaExceededError"
          ? "Browser storage is full. Use a smaller map image or remove an old map."
          : "This browser blocked local saving.",
      );
    }
  }, [maps, activeMapId]);
  useEffect(() => {
    localStorage.setItem("roll30-characters", JSON.stringify(characters));
  }, [characters]);
  useEffect(() => {
    setStatMessage("");
    setAdjustment("");
  }, [selectedId]);
  useEffect(() => {
    if (activeMapId && map)
      saveMapImage(activeMapId, map).catch(() =>
        setStorageError("The uploaded image could not be saved locally."),
      );
  }, [activeMapId, map]);
  useEffect(() => {
    const entry = maps.find((item) => item.id === activeMapId);
    if (activeMapId && !map && !noMap && entry?.data?.hasImage)
      loadMapImage(activeMapId)
        .then(setMap)
        .catch(() =>
          setStorageError("The saved map image could not be loaded."),
        );
  }, [activeMapId]);
  useEffect(() => {
    if (!activeMapId) return;
    setMaps((items) =>
      items.map((item) =>
        item.id === activeMapId
          ? {
              ...item,
              name: mapName,
              mode,
              data: { map, noMap, mode, gridSize, tokens, battle },
            }
          : item,
      ),
    );
  }, [map, noMap, mode, gridSize, tokens, battle, activeMapId, mapName]);
  const selected = tokens.find((t) => t.id === selectedId),
    activeId = battle?.order[battle.turn],
    active = tokens.find((t) => t.id === activeId);
  const selectedInventory = normalizeInventory(selected?.inventory);
  const selectedInventoryQuantities = new Map(
    selectedInventory.map((entry) => [entry.itemId, entry.quantity]),
  );
  const quickCatalogResults = filterCatalog(quickItemQuery, quickItemType);
  const availableWeapons = active
    ? WEAPONS.filter((weapon) =>
        inventoryItemIds(active.inventory).includes(weapon.id),
      )
    : [];
  useEffect(() => {
    if (!active) return;
    const weaponIds = inventoryItemIds(active.inventory);
    setSelectedWeaponId((current) =>
      weaponIds.includes(current) ? current : weaponIds[0] || "",
    );
    setAttackMode(false);
    setWeaponMenuOpen(false);
  }, [activeId]);
  const adjustSelectedStat = (event) => {
    event.preventDefault();
    const amount = Number(adjustment.trim());
    if (!selected || !Number.isFinite(amount) || !adjustment.trim()) {
      setStatMessage("Enter an adjustment such as +3 or -4.");
      return;
    }
    const currentValue = Number(selected[stat]);
    const nextValue = Math.max(
      0,
      (Number.isFinite(currentValue) ? currentValue : 0) + amount,
    );
    setTokens((items) =>
      items.map((token) =>
        token.id === selected.id ? { ...token, [stat]: nextValue } : token,
      ),
    );
    setStatMessage(
      `${stat === "maxHp" ? "MAX HP" : stat.toUpperCase()} is now ${nextValue}${stat === "speed" ? " ft" : ""}.`,
    );
    setAdjustment("");
  };
  const setSelectedStat = (key, value) => {
    if (!selected) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const minimum = key === "initiativeBonus" ? -20 : key === "level" ? 1 : 0;
    const maximum = key === "level" ? 20 : Number.POSITIVE_INFINITY;
    const nextValue = Math.min(maximum, Math.max(minimum, parsed));
    setTokens((items) =>
      items.map((token) =>
        token.id === selected.id ? { ...token, [key]: nextValue } : token,
      ),
    );
  };
  const changeSelectedItemQuantity = (itemId, amount) => {
    if (!selected) return;
    const nextInventory = changeInventoryQuantity(
      selected.inventory,
      itemId,
      amount,
    );
    setTokens((items) =>
      items.map((token) =>
        token.id === selected.id
          ? { ...token, inventory: nextInventory }
          : token,
      ),
    );
  };
  const openMap = async (entry) => {
    const data = entry.data || {};
    setActiveMapId(entry.id);
    setMapName(entry.name);
    setMap(data.map || null);
    setNoMap(!!data.noMap);
    setMode(entry.mode || data.mode || "play");
    setGridSize(data.gridSize || 48);
    setTokens(data.tokens || []);
    setBattle(null);
    setSelectedId(null);
    if (!data.map && data.hasImage) {
      try {
        setMap(await loadMapImage(entry.id));
      } catch {
        setStorageError("The saved map image could not be loaded.");
      }
    }
  };
  const createMap = () => {
    const entry = {
      id: Date.now().toString(),
      name: mapName.trim() || "Untitled map",
      mode: createMode,
      data: {
        map: null,
        noMap: createMode === "play",
        mode: createMode,
        gridSize: 48,
        tokens: [],
        battle: null,
      },
    };
    setMaps((items) => [...items, entry]);
    openMap(entry);
  };
  const deleteMap = (entry) => {
    if (!window.confirm(`Delete “${entry.name}”? This cannot be undone.`))
      return;
    setMaps((items) => items.filter((item) => item.id !== entry.id));
    if (activeMapId === entry.id) setActiveMapId(null);
    deleteMapImage(entry.id).catch(() =>
      setStorageError(
        "The map was removed, but its uploaded image could not be cleared.",
      ),
    );
  };
  const home = (
    <div className="home">
      <header>
        <button className="brand-button" onClick={() => setActiveMapId(null)}>
          Roll30
        </button>
        <span>Your maps</span>
      </header>
      {storageError && <div className="storage-error">{storageError}</div>}
      <main className="home-main">
        <section className="new-map">
          <p>NEW MAP</p>
          <h1>Create a tabletop</h1>
          <input
            value={mapName}
            onChange={(e) => setMapName(e.target.value)}
            placeholder="Map name"
          />
          <div className="mode-choice">
            <button
              className={createMode === "play" ? "active" : ""}
              onClick={() => setCreateMode("play")}
            >
              Play
            </button>
            <button
              className={createMode === "battle" ? "active" : ""}
              onClick={() => setCreateMode("battle")}
            >
              Battle
            </button>
          </div>
          <button className="start-battle" onClick={createMap}>
            Create map
          </button>
        </section>
        <section className="map-list">
          <div className="map-list-heading">
            <p>YOUR MAPS</p>
            <button className="button" onClick={() => setShowCharacters(true)}>
              <Users size={16} /> Characters
            </button>
          </div>
          {maps.length ? (
            maps.map((entry) => (
              <div className="map-row" key={entry.id}>
                <button className="map-open" onClick={() => openMap(entry)}>
                  <strong>{entry.name}</strong>
                  <span>{entry.mode === "battle" ? "Battle" : "Play"}</span>
                </button>
                <button
                  className="map-settings"
                  onClick={async () => {
                    await openMap(entry);
                    setSettingsReturn("home");
                    setShowSettings(true);
                  }}
                  aria-label={`Settings for ${entry.name}`}
                  title="Map settings"
                >
                  <Settings2 size={16} />
                </button>
                <button
                  className="map-delete"
                  onClick={() => deleteMap(entry)}
                  aria-label={`Delete ${entry.name}`}
                  title="Delete map"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          ) : (
            <span>No saved maps yet.</span>
          )}
        </section>
      </main>
    </div>
  );
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
        setDrag((d) => ({
          ...d,
          path,
          target: next,
          cursor: { x: e.clientX - rect.left, y: e.clientY - rect.top },
        }));
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
          allowance = speed * 2,
          usedDash = distance > speed;
        const occupied =
          drag.target &&
          tokens.some(
            (token) =>
              token.id !== drag.id &&
              cell(token, boardRef.current.getBoundingClientRect()).x ===
                drag.target.cell.x &&
              cell(token, boardRef.current.getBoundingClientRect()).y ===
                drag.target.cell.y,
          );
        if (distance <= allowance && distance > 0 && !occupied) {
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
            log: `${active?.name} moved ${distance * 5} ft${usedDash ? " using Dash" : ""}.`,
          }));
        } else if (occupied)
          setBattle((b) => ({
            ...b,
            log: "That square is occupied.",
          }));
        else if (distance > allowance)
          setBattle((b) => ({
            ...b,
            log: `${active?.name} cannot move more than ${drag.speed * 2} ft.`,
          }));
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
    setWeaponMenuOpen(false);
  };
  const add = () => {
    const character = characters.find(
      (item) => item.id === selectedCharacterId,
    );
    const derived = character && deriveCharacter(character);
    const t = character
      ? {
          ...makeToken(Date.now()),
          name: character.name,
          hp: derived.hp,
          maxHp: derived.hp,
          ac: derived.ac,
          speed: derived.speed,
          initiativeBonus: derived.initiative,
          strength: derived.finalAbilities.str,
          dexterity: derived.finalAbilities.dex,
          level: character.level,
          inventory: normalizeInventory(character.inventory),
          characterId: character.id,
        }
      : makeToken(Date.now());
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
          hp: t.maxHp,
          x: ((cx * gridSize + gridSize / 2) / rect.width) * 100,
          y: ((cy * gridSize + gridSize / 2) / rect.height) * 100,
          initiative:
            Math.floor(Math.random() * 20) +
            1 +
            (Number(t.initiativeBonus) || 0),
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
      log: "Initiative rolled. Battle begins!",
    });
    setSelectedId(order[0].id);
    setAttackMode(false);
    setWeaponMenuOpen(false);
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
      log,
    });
    setSelectedId(next.id);
    setAttackMode(false);
    setWeaponMenuOpen(false);
  };
  const attack = (id) => {
    if (!selectedWeapon) return;
    const target = tokens.find((t) => t.id === id);
    const rect = boardRef.current?.getBoundingClientRect();
    const origin = rect && active ? cell(active, rect) : null;
    const targetCell = rect && target ? cell(target, rect) : null;
    const rangeSquares = Math.max(1, selectedWeapon.rangeFeet / 5);
    const validOffsets = new Set(
      patternCells("diamond", rangeSquares).map(({ x, y }) => `${x},${y}`),
    );
    const inPattern =
      origin &&
      targetCell &&
      validOffsets.has(`${targetCell.x - origin.x},${targetCell.y - origin.y}`);
    if (target && !inPattern) {
      setAttackMessage(
        `${target.name} is outside ${selectedWeapon.name} range.`,
      );
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
      !inPattern
    )
      return;
    const result = resolveWeaponAttack(active, target, selectedWeapon);
    const updated = tokens.map((t) =>
        t.id === target.id && result.hit
          ? { ...t, hp: Math.max(0, t.hp - result.damage.total) }
          : t,
      ),
      alive = updated.filter((t) => t.hp > 0);
    const popupId = `${target.id}-${Date.now()}`;
    if (result.hit) playHitSound();
    setDamagePopups((items) => [
      ...items,
      {
        id: popupId,
        tokenId: target.id,
        damage: result.damage.total,
        hit: result.hit,
        critical: result.critical,
        roll: result.naturalRoll,
        total: result.attackTotal,
      },
    ]);
    setTimeout(
      () =>
        setDamagePopups((items) => items.filter((item) => item.id !== popupId)),
      1250,
    );
    setTokens(updated);
    if (alive.length <= 1) {
      setBattle({
        ...battle,
        complete: true,
        log: `${active.name}'s ${selectedWeapon.name} hits for ${result.damage.total} ${selectedWeapon.damageType.toLowerCase()} damage. ${alive[0]?.name ?? "No one"} wins!`,
      });
      setAttackMode(false);
    } else
      nextTurn(
        updated,
        result.hit
          ? `${active.name} rolls ${result.naturalRoll} + ${result.bonus} = ${result.attackTotal} and ${result.critical ? "critically " : ""}hits ${target.name} with a ${selectedWeapon.name} for ${result.damage.total} ${selectedWeapon.damageType.toLowerCase()} damage.`
          : `${active.name} rolls ${result.naturalRoll} + ${result.bonus} = ${result.attackTotal}; the ${selectedWeapon.name} misses ${target.name} (AC ${target.ac}).`,
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
    if (!rect || !active || !selectedWeapon || t.id === active.id || t.hp <= 0)
      return false;
    const a = cell(active, rect),
      b = cell(t, rect);
    return patternCells(
      "diamond",
      Math.max(1, selectedWeapon.rangeFeet / 5),
    ).some(({ x, y }) => x === b.x - a.x && y === b.y - a.y);
  };
  if (showCharacters)
    return (
      <CharactersPage
        characters={characters}
        setCharacters={setCharacters}
        onBack={() => setShowCharacters(false)}
      />
    );
  if (showSettings && activeMapId)
    return (
      <MapSettingsPage
        name={mapName}
        setName={setMapName}
        mode={mode}
        setMode={(nextMode) => {
          setMode(nextMode);
          if (nextMode !== "battle") reset();
        }}
        map={map}
        noMap={noMap}
        gridSize={gridSize}
        setGridSize={setGridSize}
        onUpload={(image) => {
          setMap(image);
          setNoMap(false);
        }}
        onNoMap={() => {
          setMap(null);
          setNoMap(true);
          deleteMapImage(activeMapId).catch(() =>
            setStorageError("The old map image could not be cleared."),
          );
        }}
        onBack={() => {
          setShowSettings(false);
          if (settingsReturn === "home") setActiveMapId(null);
        }}
      />
    );
  if (!activeMapId) return home;
  return (
    <div className="app">
      <header>
        <button className="brand-button" onClick={() => setActiveMapId(null)}>
          Roll30
        </button>
        <span>
          {mapName || "Untitled map"} · {mode === "battle" ? "Battle" : "Play"}
        </span>
        <button
          className="button header-settings"
          onClick={() => {
            setSettingsReturn("map");
            setShowSettings(true);
          }}
        >
          <Settings2 size={16} /> Map settings
        </button>
        <button
          className="button home-button"
          onClick={() => setActiveMapId(null)}
        >
          All maps
        </button>
      </header>
      {storageError && <div className="storage-error">{storageError}</div>}
      <main>
        <aside className="encounter-sidebar">
          <div className="sidebar-heading">
            <p>{mode === "battle" ? "ENCOUNTER" : "MAP TOOLS"}</p>
            <h1>
              {mode === "battle"
                ? battle
                  ? "Battle running"
                  : "Build the scene"
                : "Play setup"}
            </h1>
          </div>

          {mode === "battle" && (
            <div className="encounter-switch" aria-label="Encounter mode">
              <button className={!battle ? "active" : ""} onClick={reset}>
                Setup
              </button>
              <button
                className={battle ? "active" : ""}
                onClick={() => (!battle || battle.complete) && start()}
                disabled={tokens.length < 2}
              >
                Battle
              </button>
            </div>
          )}

          <section className="token-library">
            <div className="sidebar-section-title">
              <span>TOKENS</span>
              <em>{tokens.length}</em>
            </div>
            <select
              className="character-token-select"
              value={selectedCharacterId}
              onChange={(e) => setSelectedCharacterId(e.target.value)}
            >
              <option value="">Blank token</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
            <button className="button sidebar-add-token" onClick={add}>
              <Plus size={17} /> Add to map
            </button>
            <div className="token-roster">
              {tokens.map((token) => (
                <button
                  key={token.id}
                  className={selectedId === token.id ? "active" : ""}
                  onClick={() => setSelectedId(token.id)}
                >
                  <i style={{ background: token.color }}>
                    {token.name.slice(0, 2).toUpperCase()}
                  </i>
                  <span>
                    <strong>{token.name}</strong>
                    <small>
                      {mode === "battle"
                        ? `${token.hp}/${token.maxHp} HP`
                        : "On map"}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {mode === "battle" && !battle && (
            <p className="setup-guidance">
              {tokens.length < 2
                ? "Add at least two tokens to enable Battle."
                : "Arrange the scene, then switch to Battle to roll initiative."}
            </p>
          )}
        </aside>
        <section className="board-column">
          <div className="board-statusbar">
            <span>
              {battle && !battle.complete
                ? `Round ${battle.round} · ${active?.name}'s turn`
                : mode === "battle"
                  ? "Setup mode · arrange your encounter"
                  : "Play mode · free movement"}
            </span>
            {mode === "battle" && (
              <em>
                <Grid3X3 size={14} /> 5 ft grid
              </em>
            )}
          </div>
          <div
            ref={boardRef}
            className={
              "board " +
              (!map && !noMap ? "empty" : "") +
              (noMap ? " no-map" : "")
            }
            style={{
              backgroundImage: map ? `url(${map})` : undefined,
              "--grid-size": `${gridSize}px`,
            }}
          >
            {!map && !noMap && (
              <div className="empty-message">
                <ImageUp size={28} />
                <strong>Choose a map background</strong>
                <span>
                  Upload artwork or use a white canvas in Map Settings.
                </span>
                <button
                  className="button"
                  onClick={() => {
                    setSettingsReturn("map");
                    setShowSettings(true);
                  }}
                >
                  <Settings2 size={16} /> Open map settings
                </button>
              </div>
            )}
            {mode === "battle" && <div className="grid" />}
            {battle && (
              <TurnOrder battle={battle} tokens={tokens} activeId={activeId} />
            )}
            {drag?.battle && (
              <>
                <div
                  className={
                    "move-counter " +
                    ((drag.path?.length ?? 1) - 1 > drag.speed / 5
                      ? (drag.path?.length ?? 1) - 1 > (drag.speed / 5) * 2
                        ? "over"
                        : "dash"
                      : "walk")
                  }
                >
                  {((drag.path?.length ?? 1) - 1) * 5} ft / {drag.speed} ft
                  speed · {drag.speed * 2} ft max
                </div>
                {drag.cursor &&
                  boardRef.current &&
                  (() => {
                    const rect = boardRef.current.getBoundingClientRect(),
                      x = (drag.origin.x / 100) * rect.width,
                      y = (drag.origin.y / 100) * rect.height,
                      dx = drag.cursor.x - x,
                      dy = drag.cursor.y - y;
                    return (
                      <i
                        className="move-arrow"
                        style={{
                          left: x,
                          top: y,
                          width: Math.hypot(dx, dy),
                          transform: `rotate(${Math.atan2(dy, dx)}rad)`,
                        }}
                      />
                    );
                  })()}
                {drag.path?.map((p, i) => (
                  <i
                    key={`${p.x}-${p.y}`}
                    className={
                      "move-cell " +
                      (i === 0
                        ? "origin"
                        : i > Math.floor(drag.speed / 5) * 2
                          ? "over"
                          : i > Math.floor(drag.speed / 5)
                            ? "dash"
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
              <div className="map-actions">
                <div className="combat-dock-head">
                  <span
                    className="combat-token-dot"
                    style={{ background: active.color }}
                  >
                    {active.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <small>ACTIVE TURN</small>
                    <strong>{active.name}</strong>
                  </div>
                  <em>R{battle.round}</em>
                </div>
                {weaponMenuOpen && (
                  <div className="weapon-picker">
                    <div className="weapon-picker-title">
                      <span>CHOOSE A WEAPON</span>
                      <small>d20 + ability + proficiency</small>
                    </div>
                    <div className="weapon-grid">
                      {availableWeapons.map((weapon) => (
                        <button
                          key={weapon.id}
                          className={
                            weapon.id === selectedWeaponId ? "selected" : ""
                          }
                          onClick={() => {
                            setSelectedWeaponId(weapon.id);
                            setWeaponMenuOpen(false);
                            setAttackMode(true);
                            setAttackMessage("");
                          }}
                        >
                          <strong>{weapon.name}</strong>
                          <b>{weapon.damageDice}</b>
                          <span>
                            {weapon.damageType} · {weapon.rangeFeet} ft
                          </span>
                          <small>{weapon.category}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="combat-actions-row">
                  <button
                    className={attackMode || weaponMenuOpen ? "armed" : ""}
                    disabled={
                      battle.attacked ||
                      battle.dashed ||
                      !availableWeapons.length
                    }
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      setWeaponMenuOpen((value) => !value);
                      setAttackMode(false);
                      setAttackMessage("");
                    }}
                  >
                    <span className="action-icon">
                      <Swords size={18} />
                    </span>
                    <span>
                      <strong>Attack</strong>
                      <small>
                        {selectedWeapon
                          ? `${selectedWeapon.name} · ${selectedWeapon.damageDice}`
                          : "No weapons equipped"}
                      </small>
                    </span>
                  </button>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={end}
                    aria-label="End turn early"
                  >
                    <span className="action-icon">
                      <SkipForward size={18} />
                    </span>
                    <span>
                      <strong>End turn</strong>
                      <small>Pass early</small>
                    </span>
                  </button>
                </div>
              </div>
            )}
            {attackMode && (
              <div className="attack-prompt">
                {selectedWeapon.name} ready · choose a target · d20 vs AC
              </div>
            )}
            {attackMode &&
              active &&
              boardRef.current &&
              patternCells(
                "diamond",
                Math.max(1, selectedWeapon.rangeFeet / 5),
              ).map((offset) => {
                const c = cell(
                    active,
                    boardRef.current.getBoundingClientRect(),
                  ),
                  distance = Math.abs(offset.x) + Math.abs(offset.y);
                return (
                  <i
                    key={`attack-${offset.x}-${offset.y}`}
                    className="attack-cell"
                    style={{
                      left: (c.x + offset.x) * gridSize,
                      top: (c.y + offset.y) * gridSize,
                      width: gridSize,
                      height: gridSize,
                      "--attack-delay": `${distance * 55}ms`,
                    }}
                  />
                );
              })}
            {attackMessage && (
              <div className="attack-error">{attackMessage}</div>
            )}
            {damagePopups.map((popup) => {
              const token = tokens.find((item) => item.id === popup.tokenId);
              return (
                token && (
                  <div
                    key={popup.id}
                    className={`damage-popup ${popup.hit ? "hit" : "miss"} ${popup.critical ? "critical" : ""}`}
                    style={{ left: `${token.x}%`, top: `${token.y}%` }}
                  >
                    <small>
                      d20 {popup.roll} · {popup.total} total
                    </small>
                    <strong>
                      {popup.hit
                        ? `${popup.critical ? "CRITICAL · " : ""}−${popup.damage}`
                        : "MISS"}
                    </strong>
                  </div>
                )
              );
            })}
            {tokens.map((t) => (
              <button
                key={t.id}
                className={
                  "token " +
                  (selectedId === t.id ? "selected " : "") +
                  (drag?.id === t.id ? "dragging " : "") +
                  (damagePopups.some(
                    (popup) => popup.tokenId === t.id && popup.hit,
                  )
                    ? "hit "
                    : "") +
                  (attackMode && canAttackTarget(t) ? "targetable" : "")
                }
                style={{
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  "--token-colour": t.color,
                }}
                onPointerDown={(e) => down(e, t)}
              >
                <span>{t.name.slice(0, 2).toUpperCase()}</span>
                <small>{t.name}</small>
              </button>
            ))}
          </div>
        </section>
        <aside className="inspector">
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
              {mode === "battle" &&
                (!battle ? (
                  <section className="setup-stat-editor">
                    <div className="setup-stat-heading">
                      <p>SETUP STATS</p>
                      <span>Set this token's starting values.</span>
                    </div>
                    <div className="setup-stat-grid">
                      {[
                        ["hp", "HP"],
                        ["maxHp", "Max HP"],
                        ["ac", "AC"],
                        ["speed", "Speed (ft)"],
                        ["strength", "Strength"],
                        ["dexterity", "Dexterity"],
                        ["level", "Level"],
                        ["initiativeBonus", "Initiative bonus"],
                      ].map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <input
                            type="number"
                            value={selected[key] ?? (key === "level" ? 1 : 0)}
                            min={
                              key === "initiativeBonus"
                                ? -20
                                : key === "level"
                                  ? 1
                                  : 0
                            }
                            max={key === "level" ? 20 : undefined}
                            onChange={(event) =>
                              setSelectedStat(key, event.target.value)
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="quick-inventory">
                      <div className="quick-inventory-heading">
                        <p>QUICK INVENTORY</p>
                        <span>Search the catalog and set quantities.</span>
                      </div>
                      <div className="quick-inventory-tools">
                        <label className="inventory-search">
                          <Search size={14} />
                          <input
                            value={quickItemQuery}
                            onChange={(event) =>
                              setQuickItemQuery(event.target.value)
                            }
                            placeholder="Search items…"
                          />
                        </label>
                        <select
                          value={quickItemType}
                          onChange={(event) =>
                            setQuickItemType(event.target.value)
                          }
                          aria-label="Filter quick inventory"
                        >
                          {ITEM_TYPES.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="quick-weapon-list">
                        {quickCatalogResults.map((item) => {
                          const quantity =
                            selectedInventoryQuantities.get(item.id) || 0;
                          return (
                            <div
                              key={item.id}
                              className={`quick-item-row ${quantity ? "equipped" : ""}`}
                            >
                              <span>
                                <strong>{item.name}</strong>
                                <small>
                                  {item.typeLabel} · {item.damageDice}
                                </small>
                              </span>
                              <div className="quantity-stepper">
                                <button
                                  onClick={() =>
                                    changeSelectedItemQuantity(item.id, -1)
                                  }
                                  disabled={!quantity}
                                  aria-label={`Remove one ${item.name}`}
                                >
                                  <Minus size={13} />
                                </button>
                                <strong>{quantity}</strong>
                                <button
                                  onClick={() =>
                                    changeSelectedItemQuantity(item.id, 1)
                                  }
                                  aria-label={`Add one ${item.name}`}
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {!quickCatalogResults.length && (
                          <p className="catalog-empty">
                            No catalog items match that search.
                          </p>
                        )}
                      </div>
                    </div>
                  </section>
                ) : (
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
                    <form className="calculator" onSubmit={adjustSelectedStat}>
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
                          onChange={(e) => {
                            setAdjustment(e.target.value);
                            setStatMessage("");
                          }}
                          placeholder="e.g. +5 or -5"
                          inputMode="numeric"
                        />
                      </label>
                      <button className="button" type="submit">
                        Apply adjustment
                      </button>
                      {statMessage && (
                        <output className="stat-feedback">{statMessage}</output>
                      )}
                    </form>
                  </>
                ))}
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
              <h1>Select a token</h1>
              <span>
                Choose one from the map or the token list to edit its details.
              </span>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
function TurnOrder({ battle, tokens, activeId }) {
  return (
    <aside className="turn-order-float">
      <strong>Turn Order</strong>
      <ol>
        {battle.order.map((id) => {
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
                <span>{t.name}</span>
                <em>({battle.initiatives[id]})</em>
              </li>
            )
          );
        })}
      </ol>
    </aside>
  );
}
createRoot(document.getElementById("root")).render(<App />);
