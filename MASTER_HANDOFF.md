# Roll30 — Master Handoff

## Purpose

This is the authoritative technical and product handoff for **Roll30**, a browser-based tabletop map and combat app inspired by the 2014 D&D 5e SRD.

It describes what the application does **now**, how the custom Roll30 combat rules work, where data is stored, how older saves migrate, and how to verify and release changes.

Roll30 is a **private D&D app built for the owner and their friends**, created out of dissatisfaction with the existing public options. It is not intended as a commercial or general-audience product; design and scope decisions should favour this small, private group rather than broad public use.

The local `DND 5E Data` folder is reference source data. Preserve it unless the user explicitly requests its removal.

## Maintenance Protocol

This document follows a permanent update rule:

1. After any ordinary application change, append a medium-sized summary under **To Be Updated**.
2. When the user asks to update the master document, audit the current application and rewrite every affected section.
3. After a full rewrite, remove every entry from **To Be Updated** and leave that section empty.
4. Describe implemented behavior as implemented and deferred work as deferred.
5. Do not claim that a feature is complete solely because UI for it exists; rules, persistence, and tests must agree.

## Product Summary

Roll30 currently provides:

- A persistent home page containing multiple named maps.
- Play maps and Battle maps.
- Uploaded map artwork or a white no-map canvas.
- Grid-snapped tokens and collision prevention.
- Simplified persistent character sheets.
- Searchable, quantity-based character and token inventories.
- Pre-equipped weapon loadouts.
- Initiative and a floating turn-order display.
- Split movement, manual Dash, Actions, Bonus Actions, and manual End Turn.
- D&D-style weapon attack rolls, damage, critical hits, advantage, and disadvantage.
- Dual wielding and off-hand Bonus Action attacks.
- Weapon swapping with custom Roll30 restrictions.
- Melee, Reach, ranged, and thrown range bands.
- Physical ground and embedded thrown weapons.
- Ground, embedded, and defeated-carrier weapon recovery.
- Twenty-three imported 2014 SRD weapons.
- Local browser persistence and GitHub Pages deployment.

Roll30 is still a single-browser local application. It does not provide accounts, multiplayer synchronization, cloud saves, monsters, spells, armour mechanics, ammunition, or a complete D&D rules engine.

## Live Application and Repository

| Resource | Value |
| --- | --- |
| Production app | https://aomarco.github.io/Roll30/ |
| Repository | `aomarco/Roll30` |
| Default branch | `main` |
| Framework | React |
| Build system | Vite |
| Deployment | GitHub Pages through GitHub Actions |
| Pages base path | `/Roll30/` |

## Local Development

```powershell
npm install
npm run dev
```

Verification commands:

```powershell
npm test
npm run build
npm run preview
git diff --check
```

The production bundle is written to `dist/`.

## Application Navigation

### Startup

The app always starts on the **home page**. Remembering an open map must never bypass the home library during a fresh page load.

### Brand Navigation

The **Roll30** brand button returns to the home page from the map workspace, settings, and character workspace.

### Home Page

The home page lets the user:

- Create a named map.
- Choose Play or Battle when creating it.
- Open a saved map.
- Open Map Settings.
- Delete a map after confirmation.
- Open the Characters workspace.

Map cards are summaries of saved records; they are not separate copies of map data.

### Map Settings

Map Settings is reachable from both the home page and an open map. It edits:

- Map name.
- Play or Battle type.
- Uploaded background artwork.
- White no-map canvas.
- Grid size.

Settings write back to the same persistent map record.

## Map Workspace

The desktop workspace uses three columns:

- **Left sidebar:** Setup/Battle switch, token creation, character import, and token roster.
- **Center:** map canvas, tokens, turn order, movement/attack overlays, thrown items, and combat dock.
- **Right sidebar:** selected-token editing, statistics, inventory, and loadout.

The browser document is viewport-locked. Content-heavy regions scroll internally rather than forcing the whole page to scroll.

At narrower effective widths—including browser zoom—the workspace reflows before its columns become unusably narrow.

## Play Maps

Play maps are lightweight freeform boards:

- Tokens can be added and dragged freely.
- Tokens are not forced through turn resources.
- The combat grid and combat dock are not used.
- Normal dragging follows the pointer without the battle arrival animation.

## Battle Maps: Setup Mode

Battle maps open in **Setup** by default.

Setup permits:

- Adding a blank token.
- Adding a token from a character sheet.
- Selecting and deleting tokens.
- Dragging tokens onto grid cells.
- Directly setting HP, Max HP, AC, Speed, Strength, Dexterity, Level, Initiative Bonus, and size.
- Searching and editing a token’s quantity-based inventory.
- Selecting a main-hand and optional off-hand loadout.

Setup changes have no combat penalty.

### Blank Token Defaults

New blank tokens begin with:

| Field | Default |
| --- | ---: |
| HP | 10 |
| Max HP | 10 |
| AC | 10 |
| Speed | 30 ft |
| Strength | 10 |
| Dexterity | 10 |
| Level | 1 |
| Initiative bonus | 0 |
| Size | Medium |
| Inventory | Empty |
| Loadout | Empty |

### Character-Based Tokens

A character token copies:

- Character name.
- Derived HP.
- AC.
- Speed.
- Strength and Dexterity.
- Level.
- Initiative bonus.
- Size.
- Inventory quantities.
- Pre-equipped loadout.

Later character-sheet edits do not retroactively overwrite an existing token.

## Grid and Token Positioning

Every Battle square represents **5 feet**.

Battle tokens:

- Snap to square centers.
- Cannot finish on an occupied token square.
- Stay centered under pointer input.
- Remain visually at their origin while a combat move is previewed.

During battle dragging:

- The arrow uses the exact raw cursor vector.
- Grid validation independently uses the snapped destination.
- The token remains at its starting square until drop.
- A valid drop produces the smooth arrival animation.
- An invalid drop leaves it at the origin.

The first path cell is white. Legal path cells are green. Cells beyond the current movement allowance are red.

## Character Sheets

The Characters workspace is a full-width working section rather than a nested card.

Each simplified sheet currently contains:

- Character Name.
- Class.
- Level.
- Race/Species.
- Background.
- Six ability scores.
- Point-buy controls.
- AC.
- Initiative bonus.
- Speed.
- HP.
- Size.
- Inventory.
- Pre-equipped loadout.

Only one class and species are implemented:

- **Fighter**
- **Human**

### Point Buy

Point buy uses the standard 27-point structure for base values from 8 through 15. Human adds +1 to each ability afterward.

### Derived Values

Current character calculations are:

- Level 1 Fighter HP: `10 + Constitution modifier`.
- Later fixed-average Fighter levels: `6 + Constitution modifier` per additional level.
- Initiative: Dexterity modifier.
- Speed: 30 feet, reduced by 10 when Strength is below equipped heavy armor's minimum.
- AC: derived by `computeArmorClass` from equipped armor, Dexterity (category-capped), and shield; unarmoured is `10 + Dexterity modifier`.
- Size: Medium.

Race does not directly provide Fighter HP. Human can affect it indirectly through the Constitution increase.

## Inventory System

Characters and tokens use the same generic inventory model:

```js
[
  { itemId: "dagger", quantity: 2 },
  { itemId: "javelin", quantity: 4 }
]
```

The inventory UI supports:

- Search.
- Item-type filtering.
- Internal scrolling.
- Quantity increments and decrements.
- Removing a full stack.
- Total and unique-item summaries.

The Add Item catalog is rendered at document level with a high stacking layer so character-sheet content cannot overlap or clip it. It closes through its close button, the backdrop, or Escape.

Legacy string inventories migrate into quantity entries and duplicate IDs merge safely.

## Loadouts and Hand Rules

Inventory means what a token owns. Loadout means what it is currently holding:

```js
loadout: {
  mainHand: "scimitar",
  offHand: "shortsword"
}
```

Rules:

- A loadout can only reference owned weapons.
- Equipping the same weapon in both hands requires two inventory copies.
- Two-Handed weapons require the off hand to be empty.
- An off-hand weapon is legal only when both weapons are Light melee weapons.
- Merely owning a weapon does not make it available in the Battle attack picker.
- The attack picker displays equipped weapons only.
- Character sheets and token Setup both support pre-equipping.

Versatile weapons are deferred, so the current 23-weapon catalog uses only one-hand or two-hand requirements.

## Battle Start and Initiative

Switching a prepared Battle map from Setup to Battle:

- Rolls initiative automatically for all tokens.
- Includes each token’s configured initiative bonus.
- Sorts the turn order.
- Selects the first active token.
- Creates fresh turn resources from that token’s Speed.
- Clears prior physical battle items for a newly started battle.

The floating top-left **Turn Order** display uses the compact format:

```text
Turn Order
Fighter (19)
Bandit (13)
```

The active row glows. The display does not create a horizontal scrollbar.

Completed battles can be restarted. Restarting restores tokens to full HP, creates a fresh initiative order, and resets battle resources.

## Turn Resource Model

Each active token has:

```js
{
  movementBase,
  movementSpent,
  actionSpent,
  actionType,
  bonusActionSpent,
  bonusActionType,
  dashed,
  swapped,
  swapChoice,
  mainWeaponAttacked,
  mainAttackWeaponId,
  offHandAttackAvailable,
  offHandWeaponId,
  offHandAttackHand
}
```

The compact combat dock displays:

- Remaining and maximum movement.
- Action and Bonus Action pips.
- Round number.
- Compact Dash and Swap utilities.
- Attack.
- Bonus Action.
- End Turn.

Panels open inside the dock and scroll internally when necessary. Disabled actions show a concise reason.

## Manual End Turn

**End Turn is the only normal initiative-advancement path.**

Movement, Dash, swapping, attacks, bonus attacks, and retrieval never automatically advance the turn.

On End Turn:

- Initiative advances to the next living token.
- Round increments when the order wraps.
- The next token receives fresh resources based on its own Speed.
- Unused movement never carries over.

## Movement Currency

Movement is a spendable per-turn currency:

- Every traversed square costs 5 feet.
- Dragging is available whenever at least 5 feet remains.
- Movement may be split into multiple separate drags.
- Movement may occur before and after attacking.
- A committed move subtracts its route cost.
- Movement cannot exceed the current remaining allowance.

Example:

```text
30 ft Speed
Move 10 ft
Attack
Move 15 ft
Move 5 ft
End Turn
```

## Manual Dash

Dash is a compact explicit utility action.

Pressing Dash:

- Spends the Action.
- Adds one full Speed value to the movement maximum.
- Preserves movement already spent.
- Does not move the token automatically.
- Prevents Attack.
- Prevents Swap.
- Leaves the Bonus Action available.

For a 30-foot token that already spent 10 feet, Dash changes the maximum from 30 to 60 and leaves 50 feet remaining. It does not double only the remaining movement.

Dash is unavailable after an attack, a swap, or a previous Dash.

## Attack Action

Attack:

- Spends the Action.
- Does not end the turn.
- Does not spend movement.
- Prevents Dash.
- Prevents a later Swap.
- May unlock a dual-wield off-hand Bonus Action.
- Leaves remaining normal movement usable.

The user must still press End Turn.

## Weapon Swapping

Roll30 uses a custom once-per-turn Swap Weapon rule.

Swap is unavailable:

- After attacking.
- After Dashing.
- After another swap.

### Swap Then Attack

```text
Swap
Attack at disadvantage
No movement
No Dash
End Turn manually
```

Disadvantage affects only the attack roll. Damage remains normal.

### Swap Then Move

```text
Swap
Move using normal movement currency
Attack unavailable
Dash unavailable
Continue moving while movement remains
End Turn manually
```

### Move Then Swap

```text
Move
Swap
Attack unavailable
Dash unavailable
End Turn manually
```

Even when the token has no useful action remaining, the user ends manually.

## Dual Wielding and Bonus Actions

Normal dual-wield eligibility requires:

- Two equipped melee weapons.
- Both weapons have the Light property.
- Neither requires two hands.

After the main Attack action uses one equipped weapon:

- The other equipped weapon becomes the off-hand weapon.
- The Bonus Action control glows.
- The Bonus Action attack must use that other weapon.
- Attack and proficiency modifiers apply normally to its attack roll.
- A positive ability modifier is omitted from off-hand damage.
- A negative ability modifier still reduces off-hand damage.
- Spending the Bonus Action does not end the turn.

Dual-wield off-hand attacks are not unlocked after a weapon swap.

## Advantage and Disadvantage

The shared roll engine supports:

| Mode | Resolution |
| --- | --- |
| Normal | Roll one d20 |
| Advantage | Roll two d20s and keep the higher |
| Disadvantage | Roll two d20s and keep the lower |

Rules:

- Advantage and disadvantage cancel.
- Multiple sources do not create additional dice.
- Ability and proficiency modifiers apply to the selected die.
- Disadvantage never reduces the damage roll.

Implemented disadvantage sources:

- Long-range attacks.
- Long-range throws.
- Heavy weapons used by Small creatures.
- Lance attacks against a target 5 feet away.
- An attack immediately following a weapon swap.

The cinematic displays both d20s, dims the rejected die, and emphasizes the selected result.

## Attack and Damage Rules

Attack rolls use:

```text
d20 + ability modifier + proficiency bonus
```

Ability selection:

| Usage | Ability |
| --- | --- |
| Ordinary melee | Strength |
| Ordinary ranged | Dexterity |
| Finesse | Better of Strength or Dexterity |
| Thrown melee weapon | Its ordinary melee ability |
| Finesse thrown weapon | Better of Strength or Dexterity |

An attack hits when the total meets or exceeds AC.

- Natural 1 always misses.
- Natural 20 always hits and is critical.
- Critical hits double damage dice only.
- Ability modifiers are added once.
- Final damage cannot fall below zero.
- The damage engine supports dice definitions and fixed damage definitions for future imports.

## Dramatic Attack Presentation

An attack resolves through:

1. One or two spinning d20s.
2. The real natural result.
3. Ability and proficiency modifiers.
4. Total versus target AC.
5. Hit, miss, or critical verdict.
6. Damage die spin on a hit.
7. Visible damage modifier.
8. Final HP impact.

During resolution, repeat attack and turn-ending input is locked.

Successful hits:

- Play the one retained attack-impact sound.
- Shake the damaged token.
- Display dramatic floating damage.

Misses show a distinct miss result and do not play the hit sound.

Reduced-motion preferences shorten and suppress continuous motion.

## Range Bands and Highlights

Attack cells animate outward from the attacker and remain visible while targeting.

Cells stop at the maximum valid range. There are no permanent impossible-range cells.

### Ordinary Melee

| Color | Meaning |
| --- | --- |
| Green | Legal melee square |

### Reach

Reach weapons produce green melee squares through 10 feet.

### Ordinary Ranged

| Color | Meaning |
| --- | --- |
| Green | Normal range |
| Yellow | Long range; disadvantage |

### Thrown

| Color | Meaning |
| --- | --- |
| Green | Melee use |
| Yellow | Normal throw |
| Red | Long throw; disadvantage |

Clicking an unhighlighted target displays an out-of-range message.

## Reach, Heavy, and Lance

Every token and character has a size field. Human and legacy data default to Medium.

Heavy rule:

```text
Small attacker + Heavy weapon = disadvantage
```

Reach weapons attack normally through 10 feet.

Roll30’s simplified Lance:

- 10-foot Reach.
- Normal attack at 10 feet.
- Disadvantage at 5 feet.
- No mount/unmount behavior.
- No mounted hand-state changes.

## Physical Thrown Weapons

Throwing is inferred from target distance; the player does not select a separate throw mode.

When a weapon is thrown:

- One inventory copy is removed from the attacker.
- The equipped hand is cleared.
- If the main hand was thrown while an off-hand weapon remains, the remaining weapon shifts into the main hand.
- A physical battle item is created.

Lodging weapons:

- Dagger.
- Dart.
- Handaxe.
- Javelin.

The engine is prepared for Spear and Trident when Versatile weapons are imported.

Non-lodging blunt weapon:

- Light Hammer.

Outcomes:

- Lodging hit: damage is dealt and the item embeds in the target.
- Non-lodging hit: damage is dealt and the item lands on a nearby legal square.
- Miss: the item lands on a nearby legal square.

Ground and embedded items persist in versioned battle state.

## Retrieval

### Embedded in a Living Target

The active character must be the carrier or adjacent to the carrier and must have a Bonus Action.

```text
d20 + Strength modifier + Dexterity modifier vs DC 15
```

On success:

- Spend the Bonus Action.
- Remove the embedded marker.
- Give the weapon to the retriever.

On failure:

- Spend the Bonus Action.
- Leave the weapon embedded.
- Deal no additional damage.

### Ground Weapon

The active character must be on the same or an adjacent square.

- Costs a Bonus Action.
- Requires no roll.
- Any character can retrieve it.

### Defeated Carrier

An adjacent character can recover an embedded weapon from a defeated carrier:

- Free.
- No Bonus Action.
- No roll.

### Equip or Inventory

After recovery:

- An available legal empty hand receives the weapon immediately.
- Immediate recovery-equipping has no Swap penalty or disadvantage.
- If there is no legal empty hand, the weapon returns to inventory.
- A stored weapon requires a later normal Swap action before use.

## Supported Weapon Catalog

Roll30 contains **23 source-backed 2014 SRD weapons**.

| Weapon | Damage | Important behavior |
| --- | ---: | --- |
| Club | 1d4 bludgeoning | Light |
| Mace | 1d6 bludgeoning | Standard melee |
| Sickle | 1d4 slashing | Light |
| Flail | 1d8 bludgeoning | Standard melee |
| Morningstar | 1d8 piercing | Standard melee |
| Rapier | 1d8 piercing | Finesse |
| Scimitar | 1d6 slashing | Finesse, Light |
| Shortsword | 1d6 piercing | Finesse, Light |
| War pick | 1d8 piercing | Standard melee |
| Dagger | 1d4 piercing | Finesse, Light, thrown, lodges |
| Greatclub | 1d8 bludgeoning | Two-Handed |
| Handaxe | 1d6 slashing | Light, thrown, lodges |
| Javelin | 1d6 piercing | Thrown, lodges |
| Light hammer | 1d4 bludgeoning | Light, thrown, does not lodge |
| Dart | 1d4 piercing | Finesse, thrown, lodges |
| Glaive | 1d10 slashing | Heavy, Reach, Two-Handed |
| Greataxe | 1d12 slashing | Heavy, Two-Handed |
| Greatsword | 2d6 slashing | Heavy, Two-Handed |
| Halberd | 1d10 slashing | Heavy, Reach, Two-Handed |
| Lance | 1d12 piercing | Reach, custom close disadvantage |
| Maul | 2d6 bludgeoning | Heavy, Two-Handed |
| Pike | 1d10 piercing | Heavy, Reach, Two-Handed |
| Whip | 1d4 slashing | Finesse, Reach |

Source-fidelity tests compare imported names, damage, types, ranges, properties, price, and weight with the local SRD data.

## Deferred and Excluded Weapon Work

### Versatile Batch — implemented

Quarterstaff, Spear, Battleaxe, Longsword, Trident, and Warhammer are now in the
catalog with `hands: "versatile"`: two-handed damage die when the off hand is
free, one-handed die when a shield is equipped (see `effectiveDamageDice`).

### Ammunition Batch

Deferred until ammunition inventory and consumption exist:

- Light Crossbow.
- Shortbow.
- Sling.
- Blowgun.
- Hand Crossbow.
- Heavy Crossbow.
- Longbow.

The fixed-damage engine support needed by Blowgun already exists.

### Excluded

- Net mechanics are intentionally excluded.
- Full mounted Lance mechanics are intentionally excluded.

## Battle Completion and Restart

A battle completes when one or zero living tokens remain.

The winner is reported. A completed battle can be started again, which:

- Restores all tokens to Max HP.
- Rolls fresh initiative.
- Creates fresh turn resources.
- Allows another complete battle on the same map.

## Persistence

### Local Storage

`localStorage` stores lightweight application data:

- Map records.
- Names and modes.
- Grid settings.
- Tokens and positions.
- Token stats, size, inventories, and loadouts.
- Versioned battle state.
- Characters, inventories, and loadouts.

### IndexedDB

Uploaded map images use the `roll30-assets` IndexedDB database. This avoids exhausting the smaller localStorage quota with image data.

Legacy embedded data-URL images migrate into IndexedDB when loaded.

### Combat Data Version

The current combat persistence version is:

```js
COMBAT_DATA_VERSION = 2
```

Versioned battles restore:

- Initiative order and current turn.
- Round.
- Turn resources.
- Ground and embedded battle items.
- Bonus Action state.
- Movement spent.
- Dash and Swap state.

Legacy or incompatible in-progress battles reopen safely in **Setup** instead of attempting to reconstruct an invalid partial turn.

### Migration Defaults

Legacy tokens:

- Receive `size: "medium"`.
- Receive normalized quantity inventory.
- Receive a safe loadout using the first owned weapon when no loadout field existed.

Legacy characters:

- Receive `size: "medium"`.
- Receive normalized inventory.
- Receive a normalized loadout.

An explicitly saved empty main hand remains empty; it is not silently re-equipped during normal restore.

### Storage Errors

Storage failures are surfaced in the UI. A failed image or state save must not silently appear successful.

## Key Source Files

| File | Responsibility |
| --- | --- |
| `src/main.jsx` | Application navigation, map workspace, combat presentation, browser persistence wiring |
| `src/combatRules.js` | Pure turn, loadout, swap, range, roll-mode, retrieval, and landing rules |
| `src/weapons.js` | Weapon catalog, modifiers, dice, and attack resolution |
| `src/items.js` | Generic catalog and quantity-based inventory helpers |
| `src/persistenceRules.js` | Versioned token, character, and battle migration |
| `src/characterRules.js` | Point buy and simplified character derivation |
| `src/CharactersPage.jsx` | Character workspace, inventory, and pre-equipped loadout UI |
| `src/patterns.js` | Infinite mathematical Square, Diamond, Plus, and Star cell generators |
| `src/movement.css` | Movement, attack-cell, token, dock, and grid feedback |
| `src/premium.css` | Motion system, combat panels, cinematics, and polish |
| `src/studio.css` | Workspace, settings, setup, inventory, and responsive layout |
| `.github/workflows/deploy-pages.yml` | GitHub Pages build and deployment |

## Pattern Engine

The mathematical pattern generator supports any positive level:

- `square: n`
- `diamond: n`
- `plus: n`
- `star: n`

All patterns exclude their origin. Exact tests preserve the user-supplied level 1 and level 2 coordinate sets.

Weapon range currently uses scalable Diamond cells centered on the attacker, then assigns the weapon-specific color band.

## Automated Test Coverage

The current suite contains **42 tests** covering:

- Character point buy and derived Fighter statistics.
- Safe no-battle movement helpers.
- Movement spending and split movement.
- Manual Dash.
- Action spending.
- Advantage/disadvantage cancellation.
- Loadout ownership and hand legality.
- Legacy loadout migration.
- Swap attack and movement branches.
- Dual-wield off-hand unlock.
- Range colors and maximum cutoffs.
- Heavy, Lance, long-range, and Swap disadvantage.
- Retrieval DC and modifiers.
- Retrieval adjacency.
- Nearby thrown-weapon landing.
- Inventory normalization and quantities.
- Generic catalog search.
- Exact Square, Diamond, Plus, and Star coordinates.
- Token and character migration.
- Legacy versus versioned battle restore.
- Exact 23-weapon catalog.
- Local SRD source fidelity.
- Strength, Dexterity, and Finesse modifiers.
- Normal, advantage, and disadvantage attack selection.
- Natural 1, natural 20, and critical damage.
- Positive and negative off-hand modifiers.
- Fixed damage definitions.

## UI Layout and Anti-Clipping Practices

Several rounds of bugs in the combat dock came from the same family of layout
mistakes: text and controls being clipped, overflowing their panel, or
collapsing to nothing. This section is the standing guidance for any UI work.
Follow it whenever you add or change a panel, button, row, or menu.

### Why clipping keeps happening

The root cause is almost always **a flex or grid child that refuses to shrink**.
By default, flex and grid items have `min-width: auto`, which means they will
not shrink below their content's intrinsic size. A long label, a wide button,
or a fixed-size child then forces its container wider than the available space.
When an ancestor has `overflow: hidden` (or `overflow-x: hidden`), the excess is
sliced off — that is the "clipping." When the ancestor scrolls, you get an
unwanted scrollbar (the stray orange bar seen in the dock was exactly this).

### Rules to prevent it

1. **Constrain grid tracks.** Use `grid-template-columns: minmax(0, 1fr)` rather
   than bare `1fr` or an implicit `auto` column. A bare `1fr` still has an
   `auto` minimum and can be forced wide; `minmax(0, 1fr)` can actually shrink.
   The combat dock (`.map-actions`) must keep its single `minmax(0, 1fr)` column
   with `min-width: 0` on its direct children.

2. **Add `min-width: 0` to flex and grid children that contain text.** This
   overrides the `min-width: auto` default and lets the child shrink so its text
   can ellipsize instead of pushing the layout wide. The same applies to
   `min-height: 0` for vertical cases.

3. **Any text that can be long must have an explicit overflow behavior.** Either
   truncate — `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` —
   or allow it to wrap on purpose. Never leave a `white-space: nowrap` element
   without `overflow`/`text-overflow`, or it will spill and clip. Status strings
   ("Unavailable · attack spent", weapon names, loadout messages) are the usual
   offenders.

4. **Do not rely on implicit auto-stretch to size a control full width.** Grid
   and flex "stretch" behavior is subtle and did not fire reliably here. For a
   control that must fill its container, set it explicitly: `width: 100%`, or a
   deterministic `grid-template-columns` (e.g. `18px minmax(0, 1fr)` for an
   icon + label row) with `justify-items: start` so content hugs the left.

5. **Icon + label buttons follow one pattern.** A fixed icon column and a
   flexible text column: pin the icon (fixed size, do not let it shrink or grow),
   give the text column `minmax(0, 1fr)` / `min-width: 0`, and let the label
   ellipsize. This is how the Attack/Bonus/End-turn and Bonus-option buttons are
   built; copy it rather than inventing a new layout.

6. **Scroll on purpose, clip deliberately.** A panel that should never scroll
   sideways gets `overflow-x: hidden`; a panel meant to scroll gets
   `overflow-y: auto` with `overscroll-behavior: contain`. Do not add
   `overflow: hidden` to "fix" a spill without also fixing the child that is
   causing it — otherwise you have only hidden the symptom.

7. **Test at more than one width.** The workspace reflows at documented
   breakpoints and under browser zoom. Check a narrow width (or zoom in) so a
   control that fits at desktop width does not clip when the column shrinks.

### Verify by rendering, not by reasoning

CSS layout bugs are easy to reason about incorrectly. When a layout fix is not
obviously correct, **render it and look** rather than trusting the reasoning. A
lightweight way that needs no project dependencies: build (`npm run build`),
then load the compiled CSS with the affected DOM in headless Chrome via
`playwright-core` pointed at the system Chrome executable, screenshot the
element, and measure its box. Confirm the control is the width you expect and
the text is visible before committing.

## Completion Checklist for Changes

A combat, inventory, or persistence change is complete only when:

- The shared data model represents it.
- Pure rule helpers enforce important legality.
- React displays the rule without inventing separate behavior.
- Save and migration behavior are defined.
- Important branches have automated tests.
- `npm test` passes.
- `npm run build` passes.
- `git diff --check` passes.
- Desktop and constrained layouts remain readable.
- Internal scroll areas do not clip controls.
- Any new or changed UI follows the **UI Layout and Anti-Clipping Practices** section (constrained tracks, `min-width: 0`, text overflow behavior, explicit full-width sizing), and non-obvious layout changes are verified by rendering, not just reasoning.
- Reduced-motion behavior remains usable.
- GitHub Pages deploys successfully.
- The live build and asset paths are verified.
- The change is recorded under **To Be Updated** until the next full handoff refresh.

## Known Limitations

- Saves are local to one browser profile.
- No accounts, cloud sync, or multiplayer.
- No undo/redo history.
- Only Human Fighter character derivation exists.
- AC is simplified and armour does not alter it.
- No shields, armour equipping, spells, conditions, reactions, or monsters.
- No ammunition or Loading-property enforcement.
- No Versatile damage mode.
- No Net.
- No mounted Lance rules.
- No magic-item effect engine.
- The catalog contains weapons only, although its schema and UI are generic.
- Physical thrown items exist only inside an active versioned battle.

## To Be Updated

- **Points-left moved next to the point-buy section (2026-07-24):** The "POINTS LEFT" chip was in the character-sheet title; it now sits in the Ability Scores heading (`.ability-heading`) beside the "27-point buy" label, where it's relevant. The "Human adds +1…" caption moved into the heading's inner div; `.ability-heading > span` selectors in `src/movement.css` and `src/readability.css` updated to `.ability-heading > div > span`. Verified by rendering in headless Chrome. `npm run build` passes.

- **New characters start with an empty point buy (2026-07-24):** `newCharacter()` in `src/characterRules.js` previously pre-filled abilities with a full 27-point spread (`str:15, dex:14, …`). It now starts every ability at the base `8` (0 points spent) so the player buys from scratch. Character-rules tests updated to the new baseline (all 9s after Human's +1). `npm test` (48) and `npm run build` pass.

- **Armor, shields, and true Versatile weapons (2026-07-24):** Added the 2014 SRD armor system. New source-backed `ARMOR` catalog in `src/weapons.js` (12 body armors + shield) and an "Armour" item type in `src/items.js`. **AC is now fully derived** via `computeArmorClass` in `src/combatRules.js` (unarmored 10+Dex; Light +full Dex; Medium +Dex capped at +2; Heavy no Dex; +2 for a shield) — the manual token AC input was removed and AC recomputes whenever armor/shield/Dexterity change. Tokens and characters gain `armor` and `shield` fields (defaulted in `migrateTokenData`/`migrateCharacterData`; **legacy manual AC values are discarded** in favor of the derived value). **Heavy-armor Strength penalty** is enforced through `effectiveSpeed` (−10 ft when Strength is below the armor's minimum), applied when building each turn's movement. A **shield occupies a hand**: `equipmentProblem` forbids it with a two-handed weapon or while dual wielding, and equipping such a loadout auto-clears the shield; a shield checkbox appears in the character sheet and token Setup. **Versatile weapons are now genuinely versatile** (reverting last week's always-two-handed behavior): `hands: "versatile"`, one-handed die in `damageDice` and two-handed die in `versatileDamageDice`; `effectiveDamageDice` returns the two-handed die when both hands are free and the one-handed die when a shield is equipped, used by the attack resolution and shown in the weapon picker. Str/stealth data is imported for fidelity but stealth is not enforced (no stealth system). Tests: armor source fidelity, AC across categories + shield, effective versatile die, Strength speed penalty, and shield legality — suite now 48, `npm run build` passes; new Setup armor block render-verified in headless Chrome.

- **Bonus option button full width — verified (2026-07-24):** The Bonus Actions option button kept collapsing to a bare icon. Fixed in `src/premium.css` by giving the button a deterministic two-column grid (`grid-template-columns: 18px minmax(0, 1fr)`, `justify-items: start`, `width: 100%`) plus `width: 100%` on the label span, instead of relying on flex/grid auto-stretch that wasn't taking. The icon sits left with the title and subtitle beside it, full width. Verified by rendering the compiled CSS in headless Chrome (button 490px in a 518px panel) — not just reasoned. `npm run build` passes.

- **Combat dock horizontal-overflow root-cause fix (2026-07-24):** Earlier per-panel tweaks did not stop the Swap "Confirm" button clipping or the Bonus option collapsing to a bare icon. Root cause: `.map-actions` is a CSS grid with no column template, so its implicit `auto` column plus default `min-width: auto` on children let any wide child (the Confirm button, long status text) force the dock wider than its box, which then clipped against `overflow-x: hidden`. Fixed structurally in `src/premium.css`: `.map-actions` now uses `grid-template-columns: minmax(0, 1fr)` with `.map-actions > * { min-width: 0 }`, and `.bonus-options` uses `grid-template-columns: minmax(0, 1fr)` so its buttons stretch full width and show their label/subtitle instead of shrinking to the icon. Action-row `strong`/`small` now ellipsise (`src/movement.css`) so states like "Unavailable · attack spent" truncate cleanly instead of overflowing. Reworded the Swap picker status from the cryptic "Legal loadout" to a plain "Ready — swap to <weapon>" / "Ready — dual-wield swap" message (`src/main.jsx`). `npm run build` and `git diff --check` pass.

- **Combat dock panel layout fixes (2026-07-24):** Two CSS-only fixes in `src/premium.css`. (1) In the **Bonus Actions** panel the option label column wasn't growing, so titles like "Recover Dagger" wrapped to two lines and the subtitle was clipped; the label `<span>` now uses `flex: 1 1 auto`, the icon is pinned with `flex: 0 0 auto`, and the title truncates on one line. (2) In the **Swap Loadout** panel the "Confirm swap" button overflowed the panel and produced an orange horizontal scrollbar; the footer status text now flexes/ellipsises, the button is pinned with `flex: 0 0 auto` and `white-space: nowrap`, and `.combat-choice-panel` clips horizontal overflow (`overflow-x: hidden`). `npm run build` and `git diff --check` pass.

- **Ammunition bundles and attack-range performance (2026-07-24):** Two follow-up fixes. (1) Ammunition is now added and adjusted **a full bundle at a time** — Arrows/Crossbow bolts/Sling bullets step by 20, Blowgun needles by 50 — matching the "bundle of 20/50" catalog description, so adding a stack in the character sheet or token Setup grants the whole bundle rather than a single unit (via `bundleSize` in `src/items.js`, applied at both quantity-change sites). Per-shot battle consumption and 50% recovery still operate on individual units. (2) **Fixed severe lag when targeting long-range weapons.** The attack-range overlay previously generated the weapon's full diamond (a Longbow at 600 ft produced ~29,000 cells) and called `getBoundingClientRect()` once per cell. `weaponRangeCells` now accepts a `maxRadius` cap, and the renderer computes board geometry once and only builds/paints cells that fall on the visible board (`columns + rows` radius), cutting thousands of off-screen nodes to at most the on-board count. The staggered pop-in animation and colour bands are unchanged.

- **Versatile weapons imported as two-handed (2026-07-24):** Added Quarterstaff, Spear, Battleaxe, Longsword, Trident, and Warhammer to `src/weapons.js`. Roll30 wields Versatile weapons two-handed by default, so each carries its SRD **two-handed** damage die (e.g. Longsword `1d10`, Quarterstaff `1d8`) and `hands: "two"`. The two-handed requirement blocks the off hand: all three off-hand selects (character sheet, token Setup, and the Swap picker) now disable the off-hand slot and label it **"Requires 2 Hands"** when a two-handed weapon is in the main hand. Spear and Trident remain Thrown and lodge on hit. Source-fidelity test updated to expect the two-handed die for Versatile weapons.

- **Ranged weapons and ammunition (2026-07-24):** Added the seven ammunition weapons — Light/Hand/Heavy Crossbow, Shortbow, Longbow, Sling, Blowgun — to `src/weapons.js`, each with an `ammunition` field naming its ammo type. Added a source-backed `AMMUNITION` catalog (Arrow, Crossbow bolt, Sling bullet, Blowgun needle) and exposed it as a new **Ammunition** item type in `src/items.js`; inventory renderers guard the non-weapon `kind`. Combat behavior: pressing **Attack** with a ranged weapon shows remaining ammunition in the weapon picker; a weapon at **0 ammo is disabled and cannot fire** (an out-of-ammo message shows if attempted); each shot consumes one unit from the shooter's inventory. Battle state tracks spent ammo per token (`battle.ammoSpent`), and **when the battle ends each token recovers 50% (floored) of the ammunition it fired**, added back to its inventory with a log note. Blowgun uses the existing fixed-damage engine; the damage-spin was hardened against non-dice weapons. `restoreBattleData` normalizes `ammoSpent`. Net remains intentionally excluded. Catalog is now 36 weapons; `npm test` (43) and `npm run build` pass.

- **Combat dock utility buttons fix (2026-07-24):** The compact **Dash** and **Swap** controls in `.combat-utility-row` were collapsing to tiny squares that truncated their icons and labels. They now use `flex: 1 1 0` with `min-width: 0`, centered content, and a non-shrinking icon (`.combat-utility-row > button svg { flex: 0 0 auto }`) so each button fills half the row and shows its icon plus status text. CSS-only change in `src/premium.css`; `npm run build` and `git diff --check` pass.
