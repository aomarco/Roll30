import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeftRight,
  Hand,
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
  Zap,
} from "lucide-react";
import "./styles.css";
import "./movement.css";
import "./premium.css";
import "./motion.css";
import "./layout.css";
import "./studio.css";
import "./readability.css";
import CharactersPage from "./CharactersPage.jsx";
import { deriveCharacter } from "./characterRules.js";
import {
  ammunitionById,
  resolveWeaponAttack,
  weaponById,
  WEAPONS,
} from "./weapons.js";
import {
  ITEM_TYPES,
  changeInventoryQuantity,
  filterCatalog,
  inventoryQuantity,
  normalizeInventory,
} from "./items.js";
import MapSettingsPage from "./MapSettingsPage.jsx";
import {
  COMBAT_DATA_VERSION,
  migrateCharacterData,
  migrateTokenData,
  restoreBattleData,
} from "./persistenceRules.js";
import {
  activateDash,
  attackRollMode,
  canDash,
  canSwapWeapons,
  canUseAttackAction,
  chooseLandingCell,
  createTurnResources,
  distanceFeet,
  isDualWieldLoadout,
  loadoutProblem,
  movementMaximum,
  movementRemaining,
  normalizeLoadout,
  normalizeTurnResources,
  performWeaponSwap,
  retrievalKind,
  retrievalRoll,
  spendAttackAction,
  spendBonusAction,
  spendMovement,
  weaponRangeBand,
  weaponRangeCells,
} from "./combatRules.js";

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
  loadout: { mainHand: null, offHand: null },
  size: "medium",
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
    [attackKind, setAttackKind] = useState("action"),
    [selectedAttackHand, setSelectedAttackHand] = useState("mainHand"),
    [weaponMenuOpen, setWeaponMenuOpen] = useState(false),
    [swapMenuOpen, setSwapMenuOpen] = useState(false),
    [swapDraft, setSwapDraft] = useState({
      mainHand: null,
      offHand: null,
    }),
    [bonusMenuOpen, setBonusMenuOpen] = useState(false),
    [selectedWeaponId, setSelectedWeaponId] = useState("club"),
    [attackMessage, setAttackMessage] = useState(""),
    [storageError, setStorageError] = useState(""),
    [characters, setCharacters] = useState(() => {
      try {
        const stored = JSON.parse(
          localStorage.getItem("roll30-characters") || "[]",
        );
        return Array.isArray(stored) ? stored.map(migrateCharacterData) : [];
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
    [attackCinematic, setAttackCinematic] = useState(null),
    [retrievalCinematic, setRetrievalCinematic] = useState(null),
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
              data: {
                map,
                noMap,
                mode,
                gridSize,
                tokens,
                battle,
                combatVersion: COMBAT_DATA_VERSION,
              },
            }
          : item,
      ),
    );
  }, [map, noMap, mode, gridSize, tokens, battle, activeMapId, mapName]);
  const selected = tokens.find((t) => t.id === selectedId),
    activeId = battle?.order[battle.turn],
    active = tokens.find((t) => t.id === activeId);
  const turnResources =
    battle?.resources && active
      ? normalizeTurnResources(battle.resources, active.speed)
      : active
        ? createTurnResources(active.speed)
        : null;
  const movementLeft = movementRemaining(turnResources);
  const selectedInventory = normalizeInventory(selected?.inventory);
  const selectedInventoryQuantities = new Map(
    selectedInventory.map((entry) => [entry.itemId, entry.quantity]),
  );
  const selectedLoadout = selected
    ? normalizeLoadout(selectedInventory, selected.loadout)
    : { mainHand: null, offHand: null };
  const selectedOwnedWeapons = selectedInventory
    .map((entry) => ({ ...entry, weapon: weaponById(entry.itemId) }))
    .filter((entry) => entry.weapon);
  const quickCatalogResults = filterCatalog(quickItemQuery, quickItemType);
  const activeLoadout = active
    ? normalizeLoadout(active.inventory, active.loadout)
    : { mainHand: null, offHand: null };
  const equippedChoices = active
    ? ["mainHand", "offHand"]
        .map((hand) => ({
          hand,
          weapon: weaponById(activeLoadout[hand]),
        }))
        .filter((choice) => choice.weapon)
    : [];
  const availableWeapons = equippedChoices.map((choice) => choice.weapon);
  const activeOwnedWeapons = active
    ? normalizeInventory(active.inventory)
        .map((entry) => ({ ...entry, weapon: weaponById(entry.itemId) }))
        .filter((entry) => entry.weapon)
    : [];
  const swapProblem = active
    ? loadoutProblem(active.inventory, swapDraft)
    : null;
  useEffect(() => {
    if (!active) return;
    const preferred = active.loadout?.mainHand || active.loadout?.offHand || "";
    setSelectedWeaponId(preferred);
    setSelectedAttackHand(active.loadout?.mainHand ? "mainHand" : "offHand");
    setAttackKind("action");
    setAttackMode(false);
    setWeaponMenuOpen(false);
    setSwapMenuOpen(false);
    setBonusMenuOpen(false);
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
          ? {
              ...token,
              inventory: nextInventory,
              loadout: normalizeLoadout(nextInventory, token.loadout),
            }
          : token,
      ),
    );
  };
  const setSelectedLoadout = (patch) => {
    if (!selected) return;
    const candidate = { ...selectedLoadout, ...patch };
    if (!candidate.mainHand) candidate.offHand = null;
    if (weaponById(candidate.mainHand)?.hands === "two")
      candidate.offHand = null;
    setTokens((items) =>
      items.map((token) =>
        token.id === selected.id
          ? {
              ...token,
              loadout: normalizeLoadout(token.inventory, candidate),
            }
          : token,
      ),
    );
  };
  const openMap = async (entry) => {
    const data = entry.data || {};
    const migratedTokens = (data.tokens || []).map((token) => ({
      ...makeToken(token.id),
      ...migrateTokenData(token),
    }));
    const restoredBattle = restoreBattleData(data, migratedTokens);
    setActiveMapId(entry.id);
    setMapName(entry.name);
    setMap(data.map || null);
    setNoMap(!!data.noMap);
    setMode(entry.mode || data.mode || "play");
    setGridSize(data.gridSize || 48);
    setTokens(migratedTokens);
    setBattle(restoredBattle);
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
        combatVersion: COMBAT_DATA_VERSION,
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
        const distance = (drag.path?.length ?? 1) - 1,
          feet = distance * 5,
          allowance = Math.floor(drag.allowanceFeet / 5);
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
            resources: spendMovement(b.resources, feet),
            log: `${active?.name} moved ${feet} ft. ${Math.max(0, drag.allowanceFeet - feet)} ft remains.`,
          }));
        } else if (occupied)
          setBattle((b) => ({
            ...b,
            log: "That square is occupied.",
          }));
        else if (distance > allowance)
          setBattle((b) => ({
            ...b,
            log: `${active?.name} only has ${drag.allowanceFeet} ft of movement remaining.`,
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
    setSwapMenuOpen(false);
    setBonusMenuOpen(false);
    setAttackKind("action");
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
          loadout: normalizeLoadout(character.inventory, character.loadout),
          size: character.size || "medium",
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
          ...makeToken(t.id),
          ...migrateTokenData(t),
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
      resources: createTurnResources(order[0].speed),
      items: [],
      ammoSpent: {},
      log: "Initiative rolled. Battle begins!",
    });
    setSelectedId(order[0].id);
    setAttackMode(false);
    setWeaponMenuOpen(false);
    setSwapMenuOpen(false);
    setBonusMenuOpen(false);
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
      resources: createTurnResources(next.speed),
      log,
    });
    setSelectedId(next.id);
    setAttackMode(false);
    setWeaponMenuOpen(false);
    setSwapMenuOpen(false);
    setBonusMenuOpen(false);
  };
  const attack = async (id) => {
    if (!selectedWeapon || attackCinematic || retrievalCinematic) return;
    const target = tokens.find((t) => t.id === id);
    const rect = boardRef.current?.getBoundingClientRect();
    const origin = rect && active ? cell(active, rect) : null;
    const targetCell = rect && target ? cell(target, rect) : null;
    const rangeBand =
      origin &&
      targetCell &&
      weaponRangeBand(selectedWeapon, distanceFeet(origin, targetCell));
    if (target && !rangeBand) {
      setAttackMessage(
        `${target.name} is outside ${selectedWeapon.name} range.`,
      );
      return;
    }
    if (
      active &&
      selectedWeapon.ammunition &&
      inventoryQuantity(active.inventory, selectedWeapon.ammunition) < 1
    ) {
      const ammo = ammunitionById(selectedWeapon.ammunition);
      setAttackMessage(
        `Out of ${(ammo?.name || "ammunition").toLowerCase()}. Restock before firing the ${selectedWeapon.name}.`,
      );
      return;
    }
    const attackingLoadout = normalizeLoadout(
      active?.inventory,
      active?.loadout,
    );
    const weaponIsEquipped =
      attackingLoadout[selectedAttackHand] === selectedWeapon.id;
    if (
      !active ||
      !target ||
      target.hp <= 0 ||
      !origin ||
      !targetCell ||
      !rangeBand ||
      !weaponIsEquipped
    )
      return;
    const dualWielding = isDualWieldLoadout(active.inventory, attackingLoadout);
    const otherHand =
      selectedAttackHand === "mainHand" ? "offHand" : "mainHand";
    const availableOffHandWeaponId =
      attackKind === "action" && dualWielding && !turnResources.swapped
        ? attackingLoadout[otherHand]
        : null;
    let attackResources =
      attackKind === "bonus"
        ? spendBonusAction(turnResources, "off-hand-attack")
        : spendAttackAction(
            turnResources,
            selectedWeapon.id,
            availableOffHandWeaponId,
            availableOffHandWeaponId ? otherHand : null,
          );
    if (!attackResources) return;
    const rollDetails = attackRollMode({
      attacker: active,
      selectedWeapon,
      rangeBand,
      resources: turnResources,
    });
    setBattle((current) => ({
      ...current,
      resources: attackResources,
      log: `${active.name} attacks ${target.name} with ${selectedWeapon.name}${rollDetails.mode === "normal" ? "" : ` at ${rollDetails.mode}`}.`,
    }));
    const result = resolveWeaponAttack(
      active,
      target,
      selectedWeapon,
      Math.random,
      {
        rollMode: rollDetails.mode,
        damageModifier: attackKind === "bonus" ? "off-hand" : "normal",
      },
    );
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const pause = (milliseconds) =>
      new Promise((resolve) =>
        window.setTimeout(resolve, reducedMotion ? 80 : milliseconds),
      );
    let spinTimer;
    const beginSpin = (phase, sides) => {
      const rollCount = phase === "attack-roll" ? result.attackRolls.length : 1;
      setAttackCinematic({
        phase,
        attacker: active.name,
        target: target.name,
        targetAc: target.ac,
        weapon: selectedWeapon.name,
        weaponDice: selectedWeapon.damageDice,
        rollReasons: rollDetails.disadvantages,
        displayRoll: 1,
        displayRolls: Array.from({ length: rollCount }, () => 1),
        result,
      });
      if (!reducedMotion)
        spinTimer = window.setInterval(
          () =>
            setAttackCinematic((current) =>
              current
                ? {
                    ...current,
                    displayRoll: Math.floor(Math.random() * sides) + 1,
                    displayRolls: current.displayRolls.map(
                      () => Math.floor(Math.random() * sides) + 1,
                    ),
                  }
                : current,
            ),
          65,
        );
    };
    beginSpin("attack-roll", 20);
    await pause(850);
    window.clearInterval(spinTimer);
    setAttackCinematic((current) => ({
      ...current,
      phase: "attack-roll-landed",
      displayRoll: result.naturalRoll,
      displayRolls: result.attackRolls,
    }));
    await pause(420);
    setAttackCinematic({
      phase: "attack-total",
      attacker: active.name,
      target: target.name,
      targetAc: target.ac,
      weapon: selectedWeapon.name,
      weaponDice: selectedWeapon.damageDice,
      rollReasons: rollDetails.disadvantages,
      displayRoll: result.naturalRoll,
      displayRolls: result.attackRolls,
      result,
    });
    await pause(900);
    setAttackCinematic((current) => ({ ...current, phase: "verdict" }));
    await pause(700);
    if (result.hit) {
      beginSpin(
        "damage-roll",
        Number(selectedWeapon.damageDice.split("d")[1]) ||
          Math.max(1, result.damage.diceTotal),
      );
      await pause(700);
      window.clearInterval(spinTimer);
      setAttackCinematic((current) => ({
        ...current,
        phase: "damage-total",
        displayRoll: result.damage.diceTotal,
      }));
      await pause(850);
    }
    const damageBreakdown = result.damage.modifier
      ? ` (${result.damage.diceTotal} ${result.damage.modifier > 0 ? "+" : "−"} ${Math.abs(result.damage.modifier)})`
      : "";
    let updated = tokens.map((t) =>
      t.id === target.id && result.hit
        ? { ...t, hp: Math.max(0, t.hp - result.damage.total) }
        : t,
    );
    let battleItems = [...(battle.items || [])];
    const thrownAttack = rangeBand.id.startsWith("thrown-");
    if (thrownAttack) {
      if (
        selectedAttackHand === "mainHand" &&
        attackingLoadout.offHand &&
        attackResources.offHandAttackAvailable
      )
        attackResources = {
          ...attackResources,
          offHandAttackHand: "mainHand",
        };
      updated = updated.map((token) => {
        if (token.id !== active.id) return token;
        const inventory = changeInventoryQuantity(
          token.inventory,
          selectedWeapon.id,
          -1,
        );
        const loadout = { ...attackingLoadout };
        if (selectedAttackHand === "mainHand" && loadout.offHand) {
          loadout.mainHand = loadout.offHand;
          loadout.offHand = null;
        } else {
          loadout[selectedAttackHand] = null;
        }
        return { ...token, inventory, loadout };
      });
      const occupiedCells = updated.map((token) => cell(token, rect));
      const landingCell = chooseLandingCell(targetCell, occupiedCells, {
        columns: Math.floor(rect.width / gridSize),
        rows: Math.floor(rect.height / gridSize),
      });
      battleItems.push({
        id: `battle-item-${Date.now()}`,
        weaponId: selectedWeapon.id,
        originalOwnerId: active.id,
        state:
          result.hit && selectedWeapon.thrown?.lodgesOnHit
            ? "embedded"
            : "ground",
        embeddedInTokenId:
          result.hit && selectedWeapon.thrown?.lodgesOnHit ? target.id : null,
        cell:
          result.hit && selectedWeapon.thrown?.lodgesOnHit ? null : landingCell,
      });
    }
    let nextAmmoSpent = battle.ammoSpent || {};
    if (selectedWeapon.ammunition) {
      const ammoId = selectedWeapon.ammunition;
      updated = updated.map((token) =>
        token.id === active.id
          ? {
              ...token,
              inventory: changeInventoryQuantity(token.inventory, ammoId, -1),
            }
          : token,
      );
      const shooterSpent = nextAmmoSpent[active.id] || {};
      nextAmmoSpent = {
        ...nextAmmoSpent,
        [active.id]: {
          ...shooterSpent,
          [ammoId]: (shooterSpent[ammoId] || 0) + 1,
        },
      };
    }
    const alive = updated.filter((t) => t.hp > 0);
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
    const completing = alive.length <= 1;
    let recoveredCount = 0;
    const finalTokens = completing
      ? updated.map((token) => {
          const spent = nextAmmoSpent[token.id];
          if (!spent) return token;
          let inventory = token.inventory;
          for (const [ammoId, count] of Object.entries(spent)) {
            const give = Math.floor(count / 2);
            if (give > 0) {
              inventory = changeInventoryQuantity(inventory, ammoId, give);
              recoveredCount += give;
            }
          }
          return { ...token, inventory };
        })
      : updated;
    setTokens(finalTokens);
    setAttackCinematic((current) => ({ ...current, phase: "impact" }));
    await pause(500);
    setAttackCinematic(null);
    if (completing) {
      setBattle({
        ...battle,
        resources: attackResources,
        items: battleItems,
        ammoSpent: nextAmmoSpent,
        complete: true,
        log: `${active.name}'s ${selectedWeapon.name} hits for ${result.damage.total} ${selectedWeapon.damageType.toLowerCase()} damage. ${alive[0]?.name ?? "No one"} wins!${recoveredCount ? ` Recovered ${recoveredCount} spent ammunition (50%).` : ""}`,
      });
      setAttackMode(false);
      setWeaponMenuOpen(false);
    } else {
      setBattle({
        ...battle,
        resources: attackResources,
        items: battleItems,
        ammoSpent: nextAmmoSpent,
        log: result.hit
          ? `${active.name} rolls ${result.naturalRoll} + ${result.bonus} = ${result.attackTotal} and ${result.critical ? "critically " : ""}hits ${target.name} with a ${selectedWeapon.name} for ${result.damage.total}${damageBreakdown} ${selectedWeapon.damageType.toLowerCase()} damage.`
          : `${active.name} rolls ${result.naturalRoll} + ${result.bonus} = ${result.attackTotal}; the ${selectedWeapon.name} misses ${target.name} (AC ${target.ac}).`,
      });
      setAttackMode(false);
      setWeaponMenuOpen(false);
    }
    setAttackKind("action");
    setBonusMenuOpen(false);
  };
  const confirmWeaponSwap = () => {
    if (!active || loadoutProblem(active.inventory, swapDraft)) return;
    const swappedResources = performWeaponSwap(turnResources);
    if (!swappedResources) return;
    setTokens((items) =>
      items.map((token) =>
        token.id === active.id ? { ...token, loadout: swapDraft } : token,
      ),
    );
    setBattle((current) => ({
      ...current,
      resources: swappedResources,
      log: `${active.name} swaps to ${weaponById(swapDraft.mainHand)?.name || "empty hands"}${swapDraft.offHand ? ` and ${weaponById(swapDraft.offHand)?.name}` : ""}.`,
    }));
    setSelectedWeaponId(swapDraft.mainHand || swapDraft.offHand || "");
    setSelectedAttackHand(swapDraft.mainHand ? "mainHand" : "offHand");
    setSwapMenuOpen(false);
    setAttackMode(false);
    setWeaponMenuOpen(false);
    setSwapMenuOpen(false);
    setBonusMenuOpen(false);
  };
  const equipRecoveredWeapon = (token, weaponId) => {
    const inventory = changeInventoryQuantity(token.inventory, weaponId, 1);
    const loadout = { ...normalizeLoadout(token.inventory, token.loadout) };
    if (!loadout.mainHand) loadout.mainHand = weaponId;
    else if (!loadout.offHand) {
      const candidate = { ...loadout, offHand: weaponId };
      if (!loadoutProblem(inventory, candidate)) loadout.offHand = weaponId;
    }
    return { ...token, inventory, loadout };
  };
  const retrieveBattleItem = async (option) => {
    if (!active || !option || retrievalCinematic || attackCinematic) return;
    const requiresBonus = option.kind !== "corpse";
    if (requiresBonus && turnResources.bonusActionSpent) return;
    let nextResources = turnResources;
    let roll = null;
    if (option.kind === "embedded") {
      nextResources = spendBonusAction(turnResources, "retrieve-embedded");
      if (!nextResources) return;
      roll = retrievalRoll(active);
      setBattle((current) => ({
        ...current,
        resources: nextResources,
        log: `${active.name} tries to pull out ${option.weapon.name}.`,
      }));
      setRetrievalCinematic({
        phase: "rolling",
        weapon: option.weapon.name,
        displayRoll: 1,
        result: roll,
      });
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      let timer;
      if (!reduced)
        timer = window.setInterval(
          () =>
            setRetrievalCinematic((current) => ({
              ...current,
              displayRoll: Math.floor(Math.random() * 20) + 1,
            })),
          65,
        );
      await new Promise((resolve) =>
        window.setTimeout(resolve, reduced ? 100 : 700),
      );
      window.clearInterval(timer);
      setRetrievalCinematic((current) => ({
        ...current,
        phase: roll.success ? "success" : "failure",
        displayRoll: roll.naturalRoll,
      }));
      await new Promise((resolve) =>
        window.setTimeout(resolve, reduced ? 120 : 650),
      );
      setRetrievalCinematic(null);
      if (!roll.success) {
        setBattle((current) => ({
          ...current,
          resources: nextResources,
          log: `${active.name} rolls ${roll.total} against DC 15. ${option.weapon.name} remains embedded.`,
        }));
        setBonusMenuOpen(false);
        return;
      }
    } else if (option.kind === "ground") {
      nextResources = spendBonusAction(turnResources, "retrieve-ground");
      if (!nextResources) return;
    }
    setTokens((items) =>
      items.map((token) =>
        token.id === active.id
          ? equipRecoveredWeapon(token, option.item.weaponId)
          : token,
      ),
    );
    setBattle((current) => ({
      ...current,
      resources: nextResources,
      items: (current.items || []).filter((item) => item.id !== option.item.id),
      log:
        option.kind === "corpse"
          ? `${active.name} freely recovers ${option.weapon.name} from the defeated target.`
          : `${active.name} recovers ${option.weapon.name}${roll ? ` with a ${roll.total}` : ""}.`,
    }));
    setBonusMenuOpen(false);
  };
  const dash = () => {
    const dashedResources = activateDash(turnResources);
    if (!dashedResources || !active || attackCinematic) return;
    setBattle((current) => ({
      ...current,
      resources: dashedResources,
      log: `${active.name} uses Dash and now has ${movementRemaining(dashedResources)} ft of movement remaining.`,
    }));
    setAttackMode(false);
    setWeaponMenuOpen(false);
    setSwapMenuOpen(false);
    setBonusMenuOpen(false);
  };
  const end = () =>
    !battle?.complete && nextTurn(tokens, `${active?.name} ended their turn.`);
  const down = (e, t) => {
    e.preventDefault();
    if (attackCinematic || retrievalCinematic) return;
    if (attackMode && t.id !== activeId && t.hp > 0) return attack(t.id);
    setSelectedId(t.id);
    if (
      battle &&
      !battle.complete &&
      t.id === activeId &&
      movementLeft >= 5 &&
      turnResources?.swapChoice !== "attack" &&
      boardRef.current
    ) {
      const r = boardRef.current.getBoundingClientRect();
      setAttackMode(false);
      setWeaponMenuOpen(false);
      setDrag({
        id: t.id,
        origin: { x: t.x, y: t.y },
        originCell: cell(t, r),
        speed: t.speed,
        allowanceFeet: movementLeft,
        battle: true,
        path: [cell(t, r)],
      });
    } else if (!battle) setDrag({ id: t.id, battle: false });
  };
  const retrievalOptions = (() => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!battle || !active || !rect) return [];
    const actorCell = cell(active, rect);
    return (battle.items || [])
      .map((item) => {
        const carrier = item.embeddedInTokenId
          ? tokens.find((token) => token.id === item.embeddedInTokenId)
          : null;
        const kind = retrievalKind({
          battleItem: item,
          actorCell,
          carrier,
          carrierCell: carrier ? cell(carrier, rect) : null,
        });
        return kind
          ? { item, kind, carrier, weapon: weaponById(item.weaponId) }
          : null;
      })
      .filter((option) => option?.weapon);
  })();
  const attackStatus = !turnResources
    ? "Unavailable"
    : turnResources.dashed
      ? "Unavailable · Dashed"
      : turnResources.actionSpent
        ? `Unavailable · ${turnResources.actionType || "Action"} spent`
        : turnResources.swapped &&
            (turnResources.movementSpent > 0 ||
              turnResources.swapChoice === "movement")
          ? "Unavailable · Moved after swap"
          : !availableWeapons.length
            ? "No weapons equipped"
            : selectedWeapon
              ? `${selectedWeapon.name} · ${selectedWeapon.damageDice}`
              : "Choose equipped weapon";
  const dashStatus = !turnResources
    ? "Dash unavailable"
    : turnResources.swapped
      ? "Dash unavailable · Swapped"
      : turnResources.actionSpent
        ? "Dash unavailable · Action spent"
        : `Dash +${turnResources.movementBase} ft`;
  const swapStatus = !turnResources
    ? "Swap unavailable"
    : turnResources.swapped
      ? "Swap unavailable · Already swapped"
      : turnResources.dashed
        ? "Swap unavailable · Dashed"
        : turnResources.actionSpent
          ? "Swap unavailable · Action spent"
          : "Swap weapon";
  const canAttackTarget = (t) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || !active || !selectedWeapon || t.id === active.id || t.hp <= 0)
      return false;
    return !!weaponRangeBand(
      selectedWeapon,
      distanceFeet(cell(active, rect), cell(t, rect)),
    );
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
                    (((drag.path?.length ?? 1) - 1) * 5 > drag.allowanceFeet
                      ? "over"
                      : "walk")
                  }
                >
                  Move {((drag.path?.length ?? 1) - 1) * 5} ft ·{" "}
                  {Math.max(
                    0,
                    drag.allowanceFeet - ((drag.path?.length ?? 1) - 1) * 5,
                  )}{" "}
                  ft remaining
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
                        : i > Math.floor(drag.allowanceFeet / 5)
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
              <div className="map-actions">
                <div className="turn-resource-strip movement-only">
                  <div>
                    <span>MOVEMENT</span>
                    <strong>
                      {movementLeft} / {movementMaximum(turnResources)} ft
                    </strong>
                  </div>
                  <span className="resource-pips">
                    <i
                      className={turnResources.actionSpent ? "spent" : ""}
                      title={
                        turnResources.actionSpent
                          ? `Action spent: ${turnResources.actionType}`
                          : "Action available"
                      }
                    >
                      A
                    </i>
                    <i
                      className={turnResources.bonusActionSpent ? "spent" : ""}
                      title={
                        turnResources.bonusActionSpent
                          ? `Bonus Action spent: ${turnResources.bonusActionType}`
                          : "Bonus Action available"
                      }
                    >
                      B
                    </i>
                  </span>
                  <em>ROUND {battle.round}</em>
                </div>
                {weaponMenuOpen && (
                  <div className="weapon-picker">
                    <div className="weapon-picker-title">
                      <span>CHOOSE A WEAPON</span>
                      <small>d20 + ability + proficiency</small>
                    </div>
                    <div className="weapon-grid">
                      {equippedChoices.map(({ hand, weapon }) => {
                        const ammoLeft = weapon.ammunition
                          ? inventoryQuantity(
                              active.inventory,
                              weapon.ammunition,
                            )
                          : null;
                        const outOfAmmo = ammoLeft === 0;
                        return (
                          <button
                            key={hand}
                            disabled={outOfAmmo}
                            className={
                              (weapon.id === selectedWeaponId &&
                              hand === selectedAttackHand
                                ? "selected "
                                : "") + (outOfAmmo ? "out-of-ammo" : "")
                            }
                            onClick={() => {
                              setSelectedWeaponId(weapon.id);
                              setSelectedAttackHand(hand);
                              setAttackKind("action");
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
                            {weapon.ammunition ? (
                              <small className="ammo-count">
                                {ammoLeft}{" "}
                                {ammunitionById(weapon.ammunition)?.name ||
                                  "ammo"}
                                {ammoLeft === 1 ? "" : "s"} left
                              </small>
                            ) : (
                              <small>{weapon.category}</small>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {swapMenuOpen && (
                  <div className="combat-choice-panel swap-picker">
                    <div className="weapon-picker-title">
                      <span>SWAP LOADOUT</span>
                      <small>Attacking after a swap has disadvantage</small>
                    </div>
                    <div className="swap-fields">
                      <label>
                        Main hand
                        <select
                          value={swapDraft.mainHand || ""}
                          onChange={(event) => {
                            const mainHand = event.target.value || null;
                            setSwapDraft((current) => ({
                              ...current,
                              mainHand,
                              offHand:
                                weaponById(mainHand)?.hands === "two"
                                  ? null
                                  : current.offHand,
                            }));
                          }}
                        >
                          <option value="">Empty</option>
                          {activeOwnedWeapons.map(({ weapon }) => (
                            <option key={weapon.id} value={weapon.id}>
                              {weapon.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Off hand
                        <select
                          value={swapDraft.offHand || ""}
                          disabled={
                            !swapDraft.mainHand ||
                            weaponById(swapDraft.mainHand)?.hands === "two"
                          }
                          onChange={(event) =>
                            setSwapDraft((current) => ({
                              ...current,
                              offHand: event.target.value || null,
                            }))
                          }
                        >
                          <option value="">
                            {weaponById(swapDraft.mainHand)?.hands === "two"
                              ? "Requires 2 Hands"
                              : "Empty"}
                          </option>
                          {activeOwnedWeapons.map(({ weapon, quantity }) => (
                            <option
                              key={weapon.id}
                              value={weapon.id}
                              disabled={
                                weapon.hands === "two" ||
                                !weapon.properties.includes("Light") ||
                                !weaponById(
                                  swapDraft.mainHand,
                                )?.properties.includes("Light") ||
                                (weapon.id === swapDraft.mainHand &&
                                  quantity < 2)
                              }
                            >
                              {weapon.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="choice-panel-footer">
                      <span className={swapProblem ? "choice-error" : ""}>
                        {swapProblem || "Legal loadout"}
                      </span>
                      <button
                        onClick={confirmWeaponSwap}
                        disabled={!!swapProblem}
                      >
                        Confirm swap
                      </button>
                    </div>
                  </div>
                )}
                {bonusMenuOpen && (
                  <div className="combat-choice-panel bonus-picker">
                    <div className="weapon-picker-title">
                      <span>BONUS ACTIONS</span>
                      <small>Choose one available option</small>
                    </div>
                    <div className="bonus-options">
                      {turnResources.offHandAttackAvailable &&
                        !turnResources.bonusActionSpent && (
                          <button
                            onClick={() => {
                              const weaponId = turnResources.offHandWeaponId;
                              const hand =
                                turnResources.offHandAttackHand ||
                                (activeLoadout.mainHand === weaponId
                                  ? "mainHand"
                                  : "offHand");
                              setSelectedWeaponId(weaponId);
                              setSelectedAttackHand(hand);
                              setAttackKind("bonus");
                              setAttackMode(true);
                              setBonusMenuOpen(false);
                              setAttackMessage("");
                            }}
                          >
                            <Swords size={16} />
                            <span>
                              <strong>Off-hand attack</strong>
                              <small>
                                {weaponById(turnResources.offHandWeaponId)
                                  ?.name || "Other weapon"}
                              </small>
                            </span>
                          </button>
                        )}
                      {retrievalOptions.map((option) => (
                        <button
                          key={option.item.id}
                          onClick={() => retrieveBattleItem(option)}
                          disabled={
                            option.kind !== "corpse" &&
                            turnResources.bonusActionSpent
                          }
                        >
                          <Hand size={16} />
                          <span>
                            <strong>Recover {option.weapon.name}</strong>
                            <small>
                              {option.kind === "embedded"
                                ? "Embedded · d20 + STR + DEX vs DC 15"
                                : option.kind === "corpse"
                                  ? "Defeated carrier · free"
                                  : "Ground · no roll"}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="combat-utility-row">
                  <button
                    className="dash-compact"
                    title={dashStatus}
                    aria-label={dashStatus}
                    disabled={
                      !canDash(turnResources) ||
                      !!attackCinematic ||
                      !!retrievalCinematic
                    }
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={dash}
                  >
                    <Zap size={15} />
                    <span>{dashStatus}</span>
                  </button>
                  <button
                    className="swap-compact"
                    title={swapStatus}
                    aria-label={swapStatus}
                    disabled={
                      !canSwapWeapons(turnResources) ||
                      !!attackCinematic ||
                      !!retrievalCinematic
                    }
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      setSwapDraft(activeLoadout);
                      setSwapMenuOpen((open) => !open);
                      setWeaponMenuOpen(false);
                      setBonusMenuOpen(false);
                      setAttackMode(false);
                    }}
                  >
                    <ArrowLeftRight size={15} />
                    <span>{swapStatus}</span>
                  </button>
                </div>
                <div className="combat-actions-row">
                  <button
                    className={attackMode || weaponMenuOpen ? "armed" : ""}
                    disabled={
                      !canUseAttackAction(turnResources) ||
                      !availableWeapons.length ||
                      !!attackCinematic ||
                      !!retrievalCinematic
                    }
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      setWeaponMenuOpen((value) => !value);
                      setSwapMenuOpen(false);
                      setBonusMenuOpen(false);
                      setAttackKind("action");
                      setAttackMode(false);
                      setAttackMessage("");
                    }}
                  >
                    <span className="action-icon">
                      <Swords size={18} />
                    </span>
                    <span>
                      <strong>Attack</strong>
                      <small>{attackStatus}</small>
                    </span>
                  </button>
                  <button
                    className={
                      turnResources.offHandAttackAvailable ||
                      retrievalOptions.length
                        ? "bonus-ready"
                        : ""
                    }
                    disabled={
                      (!turnResources.offHandAttackAvailable &&
                        !retrievalOptions.length) ||
                      !!attackCinematic ||
                      !!retrievalCinematic
                    }
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      setBonusMenuOpen((open) => !open);
                      setWeaponMenuOpen(false);
                      setSwapMenuOpen(false);
                      setAttackMode(false);
                    }}
                  >
                    <span className="action-icon">
                      <Hand size={18} />
                    </span>
                    <span>
                      <strong>Bonus Action</strong>
                      <small>
                        {retrievalOptions.some(
                          (option) => option.kind === "corpse",
                        )
                          ? "Free recovery ready"
                          : turnResources.bonusActionSpent
                            ? "Spent"
                            : turnResources.offHandAttackAvailable
                              ? "Off-hand attack ready"
                              : retrievalOptions.length
                                ? "Recovery available"
                                : "Unavailable"}
                      </small>
                    </span>
                  </button>
                  <button
                    disabled={!!attackCinematic || !!retrievalCinematic}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={end}
                    aria-label="End turn"
                  >
                    <span className="action-icon">
                      <SkipForward size={18} />
                    </span>
                    <span>
                      <strong>End turn</strong>
                      <small>Advance initiative</small>
                    </span>
                  </button>
                </div>
              </div>
            )}
            {attackCinematic && (
              <div
                className={`attack-cinematic ${attackCinematic.phase} ${
                  attackCinematic.result.hit ? "will-hit" : "will-miss"
                }`}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <small>
                  {attackCinematic.attacker} · {attackCinematic.weapon}
                </small>
                {["attack-roll", "attack-roll-landed"].includes(
                  attackCinematic.phase,
                ) && (
                  <>
                    <span>
                      {attackCinematic.result.rollMode === "normal"
                        ? "ATTACK ROLL"
                        : attackCinematic.result.rollMode.toUpperCase()}
                    </span>
                    {attackCinematic.displayRolls.length > 1 ? (
                      <div className="dual-d20-roll">
                        {attackCinematic.displayRolls.map((roll, index) => (
                          <strong
                            className={`rolling-number ${
                              attackCinematic.phase === "attack-roll-landed" &&
                              index !== attackCinematic.result.selectedRollIndex
                                ? "rejected"
                                : ""
                            }`}
                            key={index}
                          >
                            {roll}
                          </strong>
                        ))}
                      </div>
                    ) : (
                      <strong className="rolling-number">
                        {attackCinematic.displayRoll}
                      </strong>
                    )}
                    <em>d20 against {attackCinematic.target}</em>
                  </>
                )}
                {attackCinematic.phase === "attack-total" && (
                  <>
                    <span>BUILDING ATTACK</span>
                    <div className="roll-equation">
                      <b>{attackCinematic.result.naturalRoll}</b>
                      <i>+</i>
                      <b>{attackCinematic.result.abilityModifier}</b>
                      <i>+</i>
                      <b>{attackCinematic.result.proficiency}</b>
                      <i>=</i>
                      <strong>{attackCinematic.result.attackTotal}</strong>
                    </div>
                    <div className="equation-labels">
                      <span>d20</span>
                      <span>ability</span>
                      <span>proficiency</span>
                      <span>total</span>
                    </div>
                  </>
                )}
                {attackCinematic.phase === "verdict" && (
                  <>
                    <span>ATTACK TOTAL VS ARMOUR CLASS</span>
                    <div className="versus-line">
                      <b>{attackCinematic.result.attackTotal}</b>
                      <i>VS</i>
                      <b>{attackCinematic.targetAc}</b>
                    </div>
                    <strong className="cinematic-verdict">
                      {attackCinematic.result.critical
                        ? "CRITICAL HIT"
                        : attackCinematic.result.hit
                          ? "HIT"
                          : "MISS"}
                    </strong>
                  </>
                )}
                {attackCinematic.phase === "damage-roll" && (
                  <>
                    <span>ROLLING DAMAGE</span>
                    <strong className="rolling-number damage-die">
                      {attackCinematic.displayRoll}
                    </strong>
                    <em>{attackCinematic.weaponDice}</em>
                  </>
                )}
                {attackCinematic.phase === "damage-total" && (
                  <>
                    <span>DAMAGE</span>
                    <div className="damage-equation">
                      <b>{attackCinematic.result.damage.diceTotal}</b>
                      {attackCinematic.result.damage.modifier !== 0 && (
                        <>
                          <i>
                            {attackCinematic.result.damage.modifier > 0
                              ? "+"
                              : "−"}
                          </i>
                          <b>
                            {Math.abs(attackCinematic.result.damage.modifier)}
                          </b>
                        </>
                      )}
                      <i>=</i>
                      <strong>{attackCinematic.result.damage.total}</strong>
                    </div>
                    <em>
                      dice{" "}
                      {attackCinematic.result.damage.modifier
                        ? "+ ability modifier"
                        : ""}
                    </em>
                  </>
                )}
                {attackCinematic.phase === "impact" && (
                  <strong className="impact-result">
                    {attackCinematic.result.hit
                      ? `−${attackCinematic.result.damage.total} HP`
                      : "MISS"}
                  </strong>
                )}
              </div>
            )}
            {attackMode && (
              <div className="attack-prompt">
                {selectedWeapon?.name} ready · choose a highlighted target
              </div>
            )}
            {attackMode &&
              active &&
              selectedWeapon &&
              boardRef.current &&
              weaponRangeCells(selectedWeapon).map((offset) => {
                const c = cell(
                    active,
                    boardRef.current.getBoundingClientRect(),
                  ),
                  distance = Math.abs(offset.x) + Math.abs(offset.y);
                return (
                  <i
                    key={`attack-${offset.x}-${offset.y}`}
                    className={`attack-cell ${offset.color}`}
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
            {retrievalCinematic && (
              <div
                className={`retrieval-cinematic ${retrievalCinematic.phase}`}
                role="status"
                aria-live="polite"
              >
                <span>RETRIEVAL · DC 15</span>
                <strong>{retrievalCinematic.displayRoll}</strong>
                <small>
                  d20 + {retrievalCinematic.result.strengthModifier} STR +{" "}
                  {retrievalCinematic.result.dexterityModifier} DEX ={" "}
                  {retrievalCinematic.result.total}
                </small>
                {retrievalCinematic.phase !== "rolling" && (
                  <em>
                    {retrievalCinematic.result.success
                      ? `${retrievalCinematic.weapon} recovered`
                      : `${retrievalCinematic.weapon} stays embedded`}
                  </em>
                )}
              </div>
            )}
            {(battle?.items || []).map((item) => {
              const itemWeapon = weaponById(item.weaponId);
              const carrier = item.embeddedInTokenId
                ? tokens.find((token) => token.id === item.embeddedInTokenId)
                : null;
              if (!itemWeapon || (item.state === "embedded" && !carrier))
                return null;
              const matchingOption = retrievalOptions.find(
                (option) => option.item.id === item.id,
              );
              return (
                <button
                  key={item.id}
                  className={`battle-item-marker ${item.state} ${matchingOption ? "retrievable" : ""}`}
                  style={
                    item.state === "ground"
                      ? {
                          left: (item.cell.x + 0.5) * gridSize,
                          top: (item.cell.y + 0.5) * gridSize,
                        }
                      : { left: `${carrier.x}%`, top: `${carrier.y}%` }
                  }
                  title={`${itemWeapon.name} · ${item.state}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => matchingOption && setBonusMenuOpen(true)}
                >
                  <Swords size={13} />
                  <span>{itemWeapon.name}</span>
                </button>
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
                      <label>
                        Creature size
                        <select
                          value={selected.size || "medium"}
                          onChange={(event) =>
                            setTokens((items) =>
                              items.map((token) =>
                                token.id === selected.id
                                  ? { ...token, size: event.target.value }
                                  : token,
                              ),
                            )
                          }
                        >
                          <option value="small">Small</option>
                          <option value="medium">Medium</option>
                          <option value="large">Large</option>
                        </select>
                      </label>
                    </div>
                    <div className="token-loadout-editor">
                      <div className="quick-inventory-heading">
                        <p>PRE-EQUIPPED LOADOUT</p>
                        <span>Only held weapons can attack in battle.</span>
                      </div>
                      <div className="loadout-fields">
                        <label>
                          Main hand
                          <select
                            value={selectedLoadout.mainHand || ""}
                            onChange={(event) =>
                              setSelectedLoadout({
                                mainHand: event.target.value || null,
                              })
                            }
                          >
                            <option value="">Empty</option>
                            {selectedOwnedWeapons.map(({ weapon }) => (
                              <option key={weapon.id} value={weapon.id}>
                                {weapon.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Off hand
                          <select
                            value={selectedLoadout.offHand || ""}
                            disabled={
                              !selectedLoadout.mainHand ||
                              weaponById(selectedLoadout.mainHand)?.hands ===
                                "two"
                            }
                            onChange={(event) =>
                              setSelectedLoadout({
                                offHand: event.target.value || null,
                              })
                            }
                          >
                            <option value="">
                              {weaponById(selectedLoadout.mainHand)?.hands ===
                              "two"
                                ? "Requires 2 Hands"
                                : "Empty"}
                            </option>
                            {selectedOwnedWeapons.map(
                              ({ weapon, quantity }) => (
                                <option
                                  key={weapon.id}
                                  value={weapon.id}
                                  disabled={
                                    weapon.hands === "two" ||
                                    !weapon.properties.includes("Light") ||
                                    !weaponById(
                                      selectedLoadout.mainHand,
                                    )?.properties.includes("Light") ||
                                    (weapon.id === selectedLoadout.mainHand &&
                                      quantity < 2)
                                  }
                                >
                                  {weapon.name}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      </div>
                      <output
                        className={
                          loadoutProblem(selected.inventory, selectedLoadout)
                            ? "loadout-error"
                            : ""
                        }
                      >
                        {loadoutProblem(selected.inventory, selectedLoadout) ||
                          (selectedLoadout.offHand
                            ? "Dual-wield loadout ready."
                            : selectedLoadout.mainHand
                              ? "One weapon equipped."
                              : "No weapon equipped.")}
                      </output>
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
                                  {item.kind === "ammunition"
                                    ? `${item.typeLabel} · bundle of ${item.bundle}`
                                    : `${item.typeLabel} · ${item.damageDice}`}
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
