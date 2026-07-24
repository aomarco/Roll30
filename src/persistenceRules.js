import { normalizeInventory } from "./items.js";
import { normalizeLoadout, normalizeTurnResources } from "./combatRules.js";

export const COMBAT_DATA_VERSION = 2;

export function migrateTokenData(token = {}) {
  const inventory = normalizeInventory(token.inventory);
  return {
    ...token,
    hp: Number.isFinite(Number(token.hp)) ? Number(token.hp) : 10,
    maxHp: Number.isFinite(Number(token.maxHp)) ? Number(token.maxHp) : 10,
    ac: Number.isFinite(Number(token.ac)) ? Number(token.ac) : 10,
    speed: Number.isFinite(Number(token.speed)) ? Number(token.speed) : 30,
    initiativeBonus: Number(token.initiativeBonus) || 0,
    strength: Number.isFinite(Number(token.strength))
      ? Number(token.strength)
      : 10,
    dexterity: Number.isFinite(Number(token.dexterity))
      ? Number(token.dexterity)
      : 10,
    level: Math.max(1, Number(token.level) || 1),
    size: token.size || "medium",
    inventory,
    loadout: normalizeLoadout(inventory, token.loadout),
  };
}

export function migrateCharacterData(character = {}) {
  const inventory = normalizeInventory(character.inventory);
  return {
    ...character,
    size: character.size || "medium",
    inventory,
    loadout: normalizeLoadout(inventory, character.loadout),
  };
}

export function restoreBattleData(data, tokens) {
  if (
    data?.combatVersion !== COMBAT_DATA_VERSION ||
    !data?.battle ||
    !Array.isArray(data.battle.order)
  )
    return null;
  const activeId = data.battle.order[data.battle.turn || 0];
  const active = tokens.find((token) => token.id === activeId);
  return {
    ...data.battle,
    items: Array.isArray(data.battle.items) ? data.battle.items : [],
    ammoSpent:
      data.battle.ammoSpent && typeof data.battle.ammoSpent === "object"
        ? data.battle.ammoSpent
        : {},
    resources: normalizeTurnResources(
      data.battle.resources,
      active?.speed || 0,
    ),
  };
}
