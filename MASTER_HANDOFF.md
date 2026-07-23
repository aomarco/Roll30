# Roll30 — Master Handoff

## Purpose of This Document

This is the master product and engineering handoff for Roll30. It explains the app’s current features, the rules behind them, where important systems live, how data is stored, and what future work must preserve.

### Maintenance Rule

- **Every app change must add a medium-sized summary to “To Be Updated”.**
- An ordinary feature or fix **does not** require the rest of this document to be rewritten immediately.
- When the user explicitly asks to **update the document**, delete every entry from “To Be Updated”, inspect the current app, and rewrite the full handoff so it is completely accurate.
- After that rewrite, leave “To Be Updated” empty until the next app change.

## Product Overview

Roll30 is a lightweight browser-based tabletop battle-map app inspired by virtual tabletops. It focuses on fast local play: users create maps, create simplified D&D 5e characters, place tokens, configure combat statistics and equipment, and run turn-based battles on a grid.

The app is a React application built with Vite. It is designed as a local-first app: maps, tokens, battles, characters, and inventories are saved in the browser rather than through a hosted account or database.

## Navigation and Main Pages

### Home

The app loads into the home page. From there a user can:

- Create and name a map.
- Choose the map’s play style when creating it.
- Open an existing map.
- Delete a map.
- Open map settings.
- Open the character-sheet area.

The **Roll30** brand button returns to the home page from other areas.

### Map Settings

Map settings can be opened from the home page or from a map workspace. Settings allow the user to:

- Rename the map.
- Upload or replace the map image.
- Select the no-map option, which uses a clean white background.
- Adjust map-related configuration such as grid size.

Map images are stored separately in IndexedDB so large image data does not overflow normal localStorage.

### Character Sheets

Character sheets are a separate page. A simplified sheet currently includes:

| Area          | Current behaviour                                                   |
| ------------- | ------------------------------------------------------------------- |
| Identity      | Character name, Fighter class, level, Human species, and background |
| Abilities     | Six core ability scores using a 27-point-buy system                 |
| Derived stats | HP, AC, initiative bonus, and speed                                 |
| Inventory     | Searchable, filterable, quantity-based item inventory               |

The current rules implementation supports one class and one species:

- **Fighter:** supplies the current hit-die logic.
- **Human:** adds +1 to purchased ability scores and has a 30-foot walking speed.

HP is derived from class and Constitution. Species currently affects HP only indirectly through its Constitution increase.

## Map Workspace

The workspace uses two sidebars so map-making controls and token configuration have room without obscuring the board. General page scrolling is locked; sections that may grow, such as inventories and weapon lists, scroll internally.

### Setup and Battle Modes

Battle-style maps use a **Setup / Battle** switch.

- **Setup** is the default when opening a battle map. It is used for placing tokens, editing their stats, and managing their quick inventory.
- **Battle** runs initiative, movement, attacks, damage, and turns.

### Tokens

Users can add blank tokens or select a character name next to the add-token control to create a token prefilled from that character sheet.

Token data includes:

- Name and visual colour.
- Grid position.
- HP and maximum HP.
- Armour Class.
- Speed.
- Initiative bonus.
- Strength and Dexterity.
- Level.
- Inventory.

Two tokens cannot occupy the same grid square.

### Token Setup

In Setup mode, selecting a token exposes direct editable fields for its combat stats. Its quick inventory can be searched and filtered, and item quantities can be changed without opening the full character-sheet page.

Blank tokens begin with no weapons. Tokens imported from character sheets copy that character’s current inventory.

## Inventory and Item Catalog

Inventory is built around a generic catalog rather than a hard-coded group of weapon buttons.

### Data Model

An inventory is an array of entries:

```js
{ itemId: "longsword", quantity: 1 }
```

Catalog items have a stable ID, item kind, display type, searchable metadata, and type-specific properties. The first catalog records happen to be five weapons, but the UI and storage model are designed to support dozens of weapons and hundreds of mixed items.

Legacy inventories saved as arrays of weapon ID strings are normalized automatically. Duplicate legacy entries are merged into quantities, so existing users do not lose their equipment.

### Current Inventory Interfaces

| Interface             | Intended use                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Character inventory   | Full item browser, search, type filter, owned count, quantity controls, and remove-all action |
| Token quick inventory | Compact setup browser with search, type filter, scrollable results, and quantity controls     |
| Battle weapon picker  | Shows only attack-capable weapons owned by the active token                                   |

The initial catalog contains Club, Dagger, Longsword, Battleaxe, and Shortbow. Adding future catalog data should not require redesigning either inventory interface.

## Grid and Movement

The grid is active in Battle mode and locks token placement to squares.

- Each square represents **5 feet**.
- The default speed is **30 feet**, or six squares.
- Dragging a token during its turn leaves the token at its origin and draws an arrow from the token to the live cursor.
- The arrow reaches the cursor itself; grid highlighting is calculated separately.
- The starting square is white.
- Movement within normal speed is green.
- Movement beyond normal speed but within double speed is blue and counts as a dash.
- Movement beyond double speed is red and cannot be completed.
- Dropping on a legal square animates the token from its origin to the destination.
- Ordinary dragging outside this combat move does not use that travel animation.

Landing on a green route preserves the token’s attack. Landing on a blue route uses the dash and prevents attacking. A token cannot move after attacking.

## Battle Flow

Entering Battle starts or prepares combat and rolls initiative automatically for tokens. Initiative includes each token’s initiative bonus.

The turn order appears as a compact floating panel in the top-left of the map:

```text
Turn Order
Token 1 (19)
Token 2 (13)
```

The current combatant glows. The active token has its actions in the larger bottom-right combat bubble, including attack and ending the turn early. A completed battle can be started again.

## Attacks and Weapons

Pressing attack opens the active token’s owned weapon list. A token without weapons has no weapon attacks available.

An attack follows the basic D&D flow:

1. Roll a d20 and add the weapon’s attack modifier.
2. Compare the result with the target’s Armour Class.
3. On a hit, roll the weapon’s damage dice and apply the appropriate modifier.
4. Subtract damage from the target’s HP.

The current attack uses the **Diamond 2** targeting pattern. Pressing attack makes the active token’s affected squares appear and remain visible while targeting. Pattern cells animate outward from the centre. Trying to target outside the allowed range displays an out-of-range message.

On a successful hit:

- The target token shakes.
- Damage appears dramatically above it for a short time.
- The attack hit sound plays.

All non-attack interface sound effects are intentionally disabled.

## Scalable Pattern System

Patterns are generated mathematically rather than stored as fixed level-one and level-two lists. Supported pattern families are:

- Square
- Diamond
- Plus
- Star

The numeric pattern level scales the generated coordinates indefinitely. The current exact coordinate definitions were calibrated from user-provided 9×9 examples. Pattern generation lives in `src/patterns.js` and its tests.

## Persistence

Roll30 is local-first and stores:

| Data                                             | Storage      |
| ------------------------------------------------ | ------------ |
| Map records, configuration, tokens, battle state | localStorage |
| Character sheets and inventories                 | localStorage |
| Uploaded map images                              | IndexedDB    |

Persistence is browser- and device-specific. Clearing site data removes locally saved Roll30 content. There is currently no account sync or server backup.

## Important Source Files

| File                      | Responsibility                                                             |
| ------------------------- | -------------------------------------------------------------------------- |
| `src/main.jsx`            | Main navigation, map workspace, tokens, movement, battle flow, persistence |
| `src/CharactersPage.jsx`  | Character sheet and full inventory UI                                      |
| `src/MapSettingsPage.jsx` | Map settings                                                               |
| `src/characterRules.js`   | Point buy and derived character statistics                                 |
| `src/weapons.js`          | Weapon definitions and attack resolution                                   |
| `src/items.js`            | Generic catalog and inventory normalization/quantity helpers               |
| `src/patterns.js`         | Infinite mathematical attack patterns                                      |
| `src/studio.css`          | Workspace, character, and inventory styling                                |

## Testing and Release

Before publishing a change:

1. Run formatting.
2. Run `npm test`.
3. Run `npm run build`.
4. Run `git diff --check`.
5. Inspect the affected UI at desktop and constrained sizes.
6. Commit only intended source changes.
7. Push to GitHub and confirm the GitHub Pages deployment succeeds.

The production app is hosted at:

**https://aomarco.github.io/Roll30/**

## Known Future Direction

- Import the wider D&D 5e equipment catalog into the generic item catalog.
- Add more item types, such as armour, adventuring gear, consumables, and containers.
- Add more classes, species, and their derived-stat rules.
- Decide how equipped, carried, attuned, and container states should work before those mechanics are needed.
- Add import/export or account-backed syncing if cross-device persistence becomes a priority.

## To Be Updated

### 2026-07-23 — Scalable Inventory Foundation

Replaced the five-weapon toggle assumption with a generic, quantity-based inventory system shared by character sheets and map tokens. Added catalog search, item-type filters, owned quantities, increment/decrement controls, remove-all behaviour, compact internal scrolling, and inventory result summaries. Combat now derives its weapon picker from attack-capable catalog items actually owned by the active token. Existing inventories saved as weapon ID strings are automatically migrated in memory to `{ itemId, quantity }` entries, including merging duplicates, so previous maps and characters remain usable. Added focused tests for legacy normalization, quantity updates, catalog searching, and generic ID extraction.

### 2026-07-23 — First SRD Weapon Import

Removed the original five hand-written test weapon definitions and replaced them with nine records selected directly from the local 2014 5e SRD equipment dataset: Club, Mace, Sickle, Flail, Morningstar, Rapier, Scimitar, Shortsword, and War pick. This first batch deliberately contains only five-foot melee weapons whose attacks work faithfully with Roll30’s existing Strength and Finesse mechanics; weapons needing thrown ranges, long-range disadvantage, versatile damage, reach, hand tracking, ammunition, loading, or special rules remain deferred. The imported records now retain their SRD source, properties, price, and weight for later inventory-detail work, and those fields participate in catalog search. The old default weapon selection was also removed, while Club keeps its stable ID so existing Club inventory entries remain valid.

### 2026-07-23 — Finesse Damage Modifiers

Completed the requested Finesse attack calculation so Roll30 finds the higher of the attacker’s Strength and Dexterity modifiers and uses that same modifier for both the d20 attack bonus and the damage total. Critical hits still double only the weapon’s damage dice, not the ability modifier, and final damage is prevented from falling below zero. Successful Finesse attacks now include a readable damage breakdown in the combat log, such as `7 (4 + 3) piercing damage`, while the dramatic damage popup continues to display the final HP loss. Added coverage for modifier selection, attack bonuses, damage bonuses, and negative-modifier damage.

### 2026-07-23 — Dramatic Staged Attack Rolls

Replaced instant attack resolution with a cinematic, input-safe roll sequence shown over the battle map. The presentation rapidly spins through d20 values, lands on the real natural roll, assembles the ability and proficiency modifiers one at a time, compares the completed attack total against the target’s Armour Class, and then clearly announces a hit, miss, or critical hit. Successful attacks continue into a separate damage-die spin, reveal any Finesse ability modifier, calculate the final damage, and finish with a forceful HP-loss impact before advancing the turn. Attack and end-turn controls are locked during resolution to prevent duplicate actions, the existing hit sound and token impact effects now occur at the final payoff, and reduced-motion users receive the same information through an accelerated non-spinning sequence.

### 2026-07-24 — Full-Section Character Creator

Removed the rounded, elevated card treatment from the character creator so the active character sheet now reads as a full workspace section beside the character list. The sheet uses a quiet structural divider, open page background, and full-width content flow instead of appearing nested inside another bubble. Rebuilt the Add Item browser as a document-level modal rendered outside the character sheet’s scrolling and stacking contexts, with an opaque blurred backdrop and z-index above every application surface. The catalog can be dismissed by its close button, clicking the backdrop, or pressing Escape, ensuring that no sheet decoration, control, or scrolling container can clip or cover it.
