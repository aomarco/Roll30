import { useState } from "react";
import { Backpack, Minus, Plus, Search, Shield, Trash2, X } from "lucide-react";
import {
  ABILITIES,
  POINT_BUY_TOTAL,
  deriveCharacter,
  formatModifier,
  modifier,
  newCharacter,
  pointsSpent,
} from "./characterRules.js";
import {
  ITEM_CATALOG,
  ITEM_TYPES,
  changeInventoryQuantity,
  filterCatalog,
  normalizeInventory,
  removeInventoryItem,
} from "./items.js";

export default function CharactersPage({ characters, setCharacters, onBack }) {
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [itemType, setItemType] = useState("all");
  const [inventoryQuery, setInventoryQuery] = useState("");
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
  const derived = selected && deriveCharacter(selected);
  const remaining = selected
    ? POINT_BUY_TOTAL - pointsSpent(selected.abilities)
    : POINT_BUY_TOTAL;
  const inventory = normalizeInventory(selected?.inventory);
  const catalogResults = filterCatalog(itemQuery, itemType);
  const visibleInventory = inventory.filter((entry) => {
    const item = ITEM_CATALOG.find(
      (candidate) => candidate.id === entry.itemId,
    );
    return item?.searchText.includes(inventoryQuery.trim().toLowerCase());
  });
  const changeItemQuantity = (itemId, amount) => {
    if (!selected) return;
    update({ inventory: changeInventoryQuantity(inventory, itemId, amount) });
  };
  const removeItem = (itemId) =>
    update({ inventory: removeInventoryItem(inventory, itemId) });

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
              <div className="points-left">
                <strong>{remaining}</strong>
                <span>POINTS LEFT</span>
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
              <label className="background-field">
                Background
                <input
                  value={selected.background}
                  onChange={(e) => update({ background: e.target.value })}
                />
              </label>
            </div>
            <div className="ability-heading">
              <div>
                <p>ABILITY SCORES</p>
                <h2>27-point buy</h2>
              </div>
              <span>Human adds +1 to every purchased score.</span>
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
                <small>Unarmoured: 10 + DEX</small>
              </div>
              <div>
                <span>INITIATIVE</span>
                <strong>{formatModifier(derived.initiative)}</strong>
                <small>Dexterity modifier</small>
              </div>
              <div>
                <span>SPEED</span>
                <strong>{derived.speed} ft</strong>
                <small>Human walking speed</small>
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
                <div className="inventory-add-wrap">
                  <button
                    className="button inventory-add"
                    onClick={() => setItemPickerOpen((open) => !open)}
                    aria-expanded={itemPickerOpen}
                  >
                    <Plus size={16} /> Add Item
                  </button>
                  {itemPickerOpen && (
                    <div className="item-picker">
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
                          onChange={(event) => setItemType(event.target.value)}
                          aria-label="Filter item type"
                        >
                          {ITEM_TYPES.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="item-picker-results">
                        <small>{catalogResults.length} results</small>
                        {catalogResults.map((item) => {
                          const owned =
                            inventory.find((entry) => entry.itemId === item.id)
                              ?.quantity || 0;
                          return (
                            <button
                              key={item.id}
                              className="item-picker-option"
                              onClick={() => changeItemQuantity(item.id, 1)}
                            >
                              <span>
                                <strong>{item.name}</strong>
                                <small>
                                  {item.typeLabel} · {item.category} ·{" "}
                                  {item.rangeFeet} ft
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
                  )}
                </div>
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
                              {item.damageDice} {item.damageType.toLowerCase()}{" "}
                              · {item.rangeFeet} ft
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
