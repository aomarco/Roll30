import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Backpack, Minus, Plus, Search, Shield, Trash2, X } from "lucide-react";
import {
  ABILITIES,
  ALIGNMENTS,
  BACKGROUNDS,
  LANGUAGES,
  POINT_BUY_TOTAL,
  deriveCharacter,
  formatModifier,
  modifier,
  newCharacter,
  pointsSpent,
} from "./characterRules.js";
import {
  ARMOR_CLASSES,
  GEAR_CLASSES,
  ITEM_CATALOG,
  ITEM_TYPES,
  WEAPON_CLASSES,
  WEAPON_PROPERTIES,
  bundleSize,
  changeInventoryQuantity,
  filterCatalog,
  inventoryQuantity,
  normalizeInventory,
  removeInventoryItem,
} from "./items.js";
import {
  loadoutProblem,
  normalizeEquipment,
  normalizeLoadout,
} from "./combatRules.js";
import { armorById, weaponById } from "./weapons.js";

export default function CharactersPage({ characters, setCharacters, onBack }) {
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [itemType, setItemType] = useState("all");
  const [itemClassFilter, setItemClassFilter] = useState("all");
  const [itemProperty, setItemProperty] = useState("all");
  const [inventoryQuery, setInventoryQuery] = useState("");
  useEffect(() => {
    if (!itemPickerOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setItemPickerOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [itemPickerOpen]);
  const selected = characters[0] || null;
  const update = (patch) =>
    setCharacters((items) =>
      items.map((item, index) => (index === 0 ? { ...item, ...patch } : item)),
    );
  const updateAbility = (key, amount) => {
    if (!selected) return;
    const next = Math.max(8, Math.min(15, selected.abilities[key] + amount));
    const abilities = { ...selected.abilities, [key]: next };
    if (pointsSpent(abilities) <= POINT_BUY_TOTAL) update({ abilities });
  };
  const knownLanguages = selected?.languages || [];
  const toggleLanguage = (language) => {
    if (!selected) return;
    update({
      languages: knownLanguages.includes(language)
        ? knownLanguages.filter((item) => item !== language)
        : [...knownLanguages, language],
    });
  };
  const derived = selected && deriveCharacter(selected);
  const remaining = selected
    ? POINT_BUY_TOTAL - pointsSpent(selected.abilities)
    : POINT_BUY_TOTAL;
  const inventory = normalizeInventory(selected?.inventory);
  const loadout = normalizeLoadout(inventory, selected?.loadout);
  const loadoutError = loadoutProblem(inventory, loadout);
  const ownedWeapons = inventory
    .map((entry) => ({
      ...entry,
      weapon: weaponById(entry.itemId),
    }))
    .filter((entry) => entry.weapon);
  const ownedArmor = inventory
    .map((entry) => ({ ...entry, armor: armorById(entry.itemId) }))
    .filter((entry) => entry.armor && entry.armor.category !== "Shield");
  const ownsShield = inventoryQuantity(inventory, "shield") > 0;
  const catalogResults = filterCatalog(itemQuery, itemType, {
    category: itemClassFilter,
    property: itemProperty,
  });
  // Class options adapt to the selected type; properties apply to weapons.
  const classOptions =
    itemType === "armor"
      ? ARMOR_CLASSES
      : itemType === "gear"
        ? GEAR_CLASSES
        : itemType === "ammunition"
          ? []
          : WEAPON_CLASSES;
  const propertyEnabled = itemType === "weapon" || itemType === "all";
  const visibleInventory = inventory.filter((entry) => {
    const item = ITEM_CATALOG.find(
      (candidate) => candidate.id === entry.itemId,
    );
    return item?.searchText.includes(inventoryQuery.trim().toLowerCase());
  });
  const changeItemQuantity = (itemId, amount) => {
    if (!selected) return;
    const nextInventory = changeInventoryQuantity(
      inventory,
      itemId,
      amount * bundleSize(itemId),
    );
    update({
      inventory: nextInventory,
      loadout: normalizeLoadout(nextInventory, loadout),
      ...normalizeEquipment(nextInventory, selected),
    });
  };
  const removeItem = (itemId) => {
    const nextInventory = removeInventoryItem(inventory, itemId);
    update({
      inventory: nextInventory,
      loadout: normalizeLoadout(nextInventory, loadout),
      ...normalizeEquipment(nextInventory, selected),
    });
  };
  const setLoadout = (patch) => {
    const candidate = { ...loadout, ...patch };
    if (!candidate.mainHand) candidate.offHand = null;
    if (weaponById(candidate.mainHand)?.hands === "two")
      candidate.offHand = null;
    // A shield needs a free off hand; drop it for two-handed or dual-wield.
    const dropShield =
      weaponById(candidate.mainHand)?.hands === "two" || !!candidate.offHand;
    update({
      loadout: normalizeLoadout(inventory, candidate),
      ...(dropShield ? { shield: false } : {}),
    });
  };
  const shieldBlocked =
    weaponById(loadout.mainHand)?.hands === "two" || !!loadout.offHand;

  return (
    <div className="characters-page">
      <header>
        <button className="brand-button" onClick={onBack}>
          Roll30
        </button>
        <span>Characters · Simplified 5e sheets</span>
        <button
          className="button home-button"
          onClick={() => setCharacters((items) => [newCharacter(), ...items])}
        >
          <Plus size={16} /> New character
        </button>
      </header>
      <main className="characters-layout">
        <aside className="character-list">
          <p>CHARACTERS</p>
          {characters.map((character, index) => (
            <button
              key={character.id}
              className={index === 0 ? "active" : ""}
              onClick={() =>
                setCharacters((items) => [
                  items[index],
                  ...items.filter((_, i) => i !== index),
                ])
              }
            >
              <strong>{character.name}</strong>
              <span>
                Level {character.level} {character.className}
              </span>
            </button>
          ))}
        </aside>
        {selected ? (
          <section className="character-sheet">
            <div className="sheet-title">
              <div>
                <p>CHARACTER SHEET</p>
                <h1>{selected.name}</h1>
              </div>
            </div>
            <div className="identity-grid">
              <label>
                Character name
                <input
                  value={selected.name}
                  onChange={(e) => update({ name: e.target.value })}
                />
              </label>
              <label>
                Class
                <select value={selected.className} disabled>
                  <option>Fighter</option>
                </select>
              </label>
              <label>
                Level
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={selected.level}
                  onChange={(e) =>
                    update({
                      level: Math.max(1, Math.min(20, Number(e.target.value))),
                    })
                  }
                />
              </label>
              <label>
                Race / Species
                <select value={selected.species} disabled>
                  <option>Human</option>
                </select>
              </label>
              <label>
                Size
                <select value={selected.size || "medium"} disabled>
                  <option value="medium">Medium</option>
                </select>
              </label>
              <label>
                Alignment
                <select
                  value={selected.alignment || "Neutral"}
                  onChange={(e) => update({ alignment: e.target.value })}
                >
                  {ALIGNMENTS.map((alignment) => (
                    <option key={alignment} value={alignment}>
                      {alignment}
                    </option>
                  ))}
                </select>
              </label>
              <label className="background-field">
                Background
                <input
                  list="background-options"
                  value={selected.background}
                  onChange={(e) => update({ background: e.target.value })}
                />
                <datalist id="background-options">
                  {BACKGROUNDS.map((background) => (
                    <option key={background} value={background} />
                  ))}
                </datalist>
              </label>
            </div>
            <div className="languages-section">
              <div className="languages-heading">
                <p>LANGUAGES</p>
                <span>{knownLanguages.length} known</span>
              </div>
              <div className="language-chips">
                {LANGUAGES.map((language) => (
                  <button
                    key={language}
                    type="button"
                    className={
                      knownLanguages.includes(language) ? "chip on" : "chip"
                    }
                    aria-pressed={knownLanguages.includes(language)}
                    onClick={() => toggleLanguage(language)}
                  >
                    {language}
                  </button>
                ))}
              </div>
            </div>
            <div className="ability-heading">
              <div>
                <p>ABILITY SCORES</p>
                <h2>27-point buy</h2>
                <span>Human adds +1 to every purchased score.</span>
              </div>
              <div className="points-left">
                <strong>{remaining}</strong>
                <span>POINTS LEFT</span>
              </div>
            </div>
            <div className="ability-grid">
              {ABILITIES.map((key) => {
                const base = selected.abilities[key],
                  final = derived.finalAbilities[key];
                return (
                  <div className="ability-card" key={key}>
                    <span>{key.toUpperCase()}</span>
                    <strong>{final}</strong>
                    <em>{formatModifier(modifier(final))}</em>
                    <div>
                      <button
                        onClick={() => updateAbility(key, -1)}
                        disabled={base <= 8}
                      >
                        −
                      </button>
                      <small>Base {base}</small>
                      <button
                        onClick={() => updateAbility(key, 1)}
                        disabled={base >= 15}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="derived-grid">
              <div>
                <span>HIT POINTS</span>
                <strong>{derived.hp}</strong>
                <small>Fighter + Constitution</small>
              </div>
              <div>
                <span>ARMOUR CLASS</span>
                <strong>
                  <Shield size={17} />
                  {derived.ac}
                </strong>
                <small>
                  {selected.armor
                    ? `${armorById(selected.armor)?.name}${selected.shield ? " + shield" : ""}`
                    : selected.shield
                      ? "Unarmoured + shield"
                      : "Unarmoured: 10 + DEX"}
                </small>
              </div>
              <div>
                <span>INITIATIVE</span>
                <strong>{formatModifier(derived.initiative)}</strong>
                <small>Dexterity modifier</small>
              </div>
              <div>
                <span>SPEED</span>
                <strong>{derived.speed} ft</strong>
                <small>
                  {derived.speed < 30
                    ? "−10 ft: Strength below armor minimum"
                    : "Human walking speed"}
                </small>
              </div>
            </div>
            <section className="inventory-section">
              <div className="inventory-heading">
                <div>
                  <p>INVENTORY</p>
                  <h2>Weapons and equipment</h2>
                  <span className="inventory-summary">
                    {inventory.reduce(
                      (total, item) => total + item.quantity,
                      0,
                    )}{" "}
                    items · {inventory.length} unique
                  </span>
                </div>
              </div>
              <div className="loadout-editor">
                <div>
                  <p>PRE-EQUIPPED LOADOUT</p>
                  <span>These are the weapons held when battle begins.</span>
                </div>
                <label>
                  Main hand
                  <select
                    value={loadout.mainHand || ""}
                    onChange={(event) =>
                      setLoadout({ mainHand: event.target.value || null })
                    }
                  >
                    <option value="">Empty</option>
                    {ownedWeapons.map(({ weapon }) => (
                      <option key={weapon.id} value={weapon.id}>
                        {weapon.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Off hand
                  <select
                    value={loadout.offHand || ""}
                    disabled={
                      !loadout.mainHand ||
                      weaponById(loadout.mainHand)?.hands === "two"
                    }
                    onChange={(event) =>
                      setLoadout({ offHand: event.target.value || null })
                    }
                  >
                    <option value="">
                      {weaponById(loadout.mainHand)?.hands === "two"
                        ? "Requires 2 Hands"
                        : "Empty"}
                    </option>
                    {ownedWeapons.map(({ weapon, quantity }) => (
                      <option
                        key={weapon.id}
                        value={weapon.id}
                        disabled={
                          weapon.hands === "two" ||
                          !weapon.properties.includes("Light") ||
                          !weaponById(loadout.mainHand)?.properties.includes(
                            "Light",
                          ) ||
                          (weapon.id === loadout.mainHand && quantity < 2)
                        }
                      >
                        {weapon.name}
                      </option>
                    ))}
                  </select>
                </label>
                <output className={loadoutError ? "loadout-error" : ""}>
                  {loadoutError ||
                    (loadout.offHand
                      ? "Dual-wield loadout ready."
                      : "One weapon equipped.")}
                </output>
              </div>
              <div className="loadout-editor">
                <div>
                  <p>ARMOUR</p>
                  <span>AC is derived from armor, Dexterity, and shield.</span>
                </div>
                <label>
                  Body armor
                  <select
                    value={selected.armor || ""}
                    onChange={(event) =>
                      update({ armor: event.target.value || null })
                    }
                  >
                    <option value="">None (unarmored)</option>
                    {ownedArmor.map(({ armor }) => (
                      <option key={armor.id} value={armor.id}>
                        {armor.name} · {armor.category}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="shield-check">
                  <span>
                    Shield
                    {shieldBlocked
                      ? " (hand not free)"
                      : !ownsShield
                        ? " (none owned)"
                        : ""}
                  </span>
                  <input
                    type="checkbox"
                    checked={!!selected.shield}
                    disabled={shieldBlocked || !ownsShield}
                    onChange={(event) => update({ shield: event.target.checked })}
                  />
                </label>
                <output>
                  AC {derived.ac}
                  {selected.armor
                    ? ` · ${armorById(selected.armor)?.name}`
                    : " · unarmored"}
                  {selected.shield ? " + shield" : ""}
                </output>
              </div>
              <div className="inventory-add-wrap">
                <button
                  className="button inventory-add"
                  onClick={() => setItemPickerOpen((open) => !open)}
                  aria-expanded={itemPickerOpen}
                >
                  <Plus size={16} /> Add Item
                </button>
                {itemPickerOpen &&
                  createPortal(
                    <div
                      className="item-picker-backdrop"
                      onPointerDown={() => setItemPickerOpen(false)}
                    >
                      <div
                        className="item-picker"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Add an inventory item"
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <div className="item-picker-title">
                          <span>ITEM CATALOG</span>
                          <button
                            onClick={() => setItemPickerOpen(false)}
                            aria-label="Close item list"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="item-browser-tools">
                          <label className="inventory-search">
                            <Search size={15} />
                            <input
                              value={itemQuery}
                              onChange={(event) =>
                                setItemQuery(event.target.value)
                              }
                              placeholder="Search name, type, damage…"
                              autoFocus
                            />
                          </label>
                          <select
                            value={itemType}
                            onChange={(event) => {
                              setItemType(event.target.value);
                              setItemClassFilter("all");
                              setItemProperty("all");
                            }}
                            aria-label="Filter item type"
                          >
                            {ITEM_TYPES.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="item-filter-row">
                          <select
                            value={itemClassFilter}
                            onChange={(event) =>
                              setItemClassFilter(event.target.value)
                            }
                            disabled={!classOptions.length}
                            aria-label="Filter class"
                          >
                            <option value="all">
                              {itemType === "armor" ? "All classes" : "All types"}
                            </option>
                            {classOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <select
                            value={itemProperty}
                            onChange={(event) =>
                              setItemProperty(event.target.value)
                            }
                            disabled={!propertyEnabled}
                            aria-label="Filter property"
                          >
                            <option value="all">Any property</option>
                            {WEAPON_PROPERTIES.map((property) => (
                              <option key={property} value={property}>
                                {property}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="item-picker-results">
                          <small>{catalogResults.length} results</small>
                          {catalogResults.map((item) => {
                            const owned =
                              inventory.find(
                                (entry) => entry.itemId === item.id,
                              )?.quantity || 0;
                            return (
                              <button
                                key={item.id}
                                className="item-picker-option"
                                onClick={() => changeItemQuantity(item.id, 1)}
                              >
                                <span>
                                  <strong>{item.name}</strong>
                                  <small>
                                    {item.kind === "ammunition"
                                      ? `${item.typeLabel} · bundle of ${item.bundle}`
                                      : item.kind === "armor"
                                        ? `${item.typeLabel} · ${item.category} · AC ${item.acBase}${item.acDex ? "+Dex" : ""}`
                                        : item.kind === "gear"
                                          ? `${item.typeLabel}${item.cost ? ` · ${item.cost.quantity} ${item.cost.unit}` : ""}`
                                          : `${item.typeLabel} · ${item.category} · ${item.rangeFeet} ft`}
                                  </small>
                                </span>
                                <em>{owned ? `${owned} owned` : "+ Add"}</em>
                              </button>
                            );
                          })}
                          {!catalogResults.length && (
                            <p className="catalog-empty">
                              No catalog items match that search.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>,
                    document.body,
                  )}
              </div>
              {inventory.length ? (
                <>
                  <label className="inventory-search inventory-list-search">
                    <Search size={15} />
                    <input
                      value={inventoryQuery}
                      onChange={(event) =>
                        setInventoryQuery(event.target.value)
                      }
                      placeholder="Search your inventory…"
                    />
                  </label>
                  <div className="inventory-grid">
                    {visibleInventory.map((entry) => {
                      const item = ITEM_CATALOG.find(
                        (candidate) => candidate.id === entry.itemId,
                      );
                      if (!item) return null;
                      return (
                        <article className="inventory-item" key={item.id}>
                          <span className="inventory-item-icon">
                            <Backpack size={17} />
                          </span>
                          <div>
                            <strong>{item.name}</strong>
                            <small>
                              {item.kind === "ammunition"
                                ? `Ammunition · bundle of ${item.bundle}`
                                : item.kind === "armor"
                                  ? `${item.category} armour · AC ${item.acBase}${item.acDex ? "+Dex" : ""}`
                                  : item.kind === "gear"
                                    ? `${item.typeLabel}${item.cost ? ` · ${item.cost.quantity} ${item.cost.unit}` : ""}`
                                    : `${item.damageDice} ${item.damageType.toLowerCase()} · ${item.rangeFeet} ft`}
                            </small>
                          </div>
                          <div className="quantity-stepper">
                            <button
                              onClick={() => changeItemQuantity(item.id, -1)}
                              aria-label={`Remove one ${item.name}`}
                            >
                              <Minus size={13} />
                            </button>
                            <strong>{entry.quantity}</strong>
                            <button
                              onClick={() => changeItemQuantity(item.id, 1)}
                              aria-label={`Add one ${item.name}`}
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <button
                            className="inventory-delete"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove all ${item.name}`}
                            title="Remove all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </article>
                      );
                    })}
                    {!visibleInventory.length && (
                      <div className="catalog-empty">
                        No owned items match that search.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="inventory-empty">
                  <Backpack size={21} />
                  <span>No items yet. Add a weapon to get started.</span>
                </div>
              )}
            </section>
            <p className="rules-note">
              HP uses the Fighter hit die and Constitution modifier. Species
              only affects it indirectly here through Human’s +1 Constitution.
            </p>
            <button
              className="remove"
              onClick={() =>
                setCharacters((items) =>
                  items.filter((item) => item.id !== selected.id),
                )
              }
            >
              <Trash2 size={16} /> Delete character
            </button>
          </section>
        ) : (
          <section className="character-empty">
            <h1>No characters yet</h1>
            <p>Create your first Human Fighter sheet.</p>
            <button
              className="start-battle"
              onClick={() => setCharacters([newCharacter()])}
            >
              <Plus size={16} /> Create character
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
