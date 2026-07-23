# Roll30 — Master Handoff

## Purpose of This Document

This is the authoritative handoff for **Roll30**, a browser-based tabletop battle-map app inspired by D&D 5e. It explains the current product, its rules, architecture, persistence, tests, limitations, and agreed future direction.

The document distinguishes between:

- **Implemented:** behavior that exists in the current application.
- **Planned:** behavior discussed and agreed upon but not yet built.
- **Deferred or excluded:** ideas intentionally postponed or removed from scope.

Do not treat the planned combat revision as current behavior.

## Maintenance Protocol

This file must remain synchronized with the application.

1. After any application change, add a medium-sized summary under **To Be Updated**.
2. When asked to “update the master document,” rewrite all affected sections so they describe the current app.
3. After that full rewrite, remove every entry from **To Be Updated** and leave the section empty.
4. Record planned mechanics as **planned**, never as implemented.
5. Preserve the local `DND 5E Data` source folder unless the user explicitly asks to remove it.

## Product Summary

Roll30 lets a user:

- Create and manage multiple maps from a home library.
- Choose whether each map is a **Play** map or a **Battle** map.
- Upload a background image or use a plain white board.
- Add tokens manually or create them from saved character sheets.
- Configure token combat statistics and inventories.
- Run grid-based battles with initiative, movement, attacks, damage, and turn order.
- Create simplified D&D characters using point buy and an item inventory.
- Keep maps and characters in local browser storage.

The application is deliberately focused. It is not yet a complete D&D 5e rules engine, multiplayer virtual tabletop, account system, or cloud-synced campaign manager.

## Live Application and Repository

| Resource           | Location                            |
| ------------------ | ----------------------------------- |
| Production app     | https://aomarco.github.io/Roll30/   |
| GitHub repository  | `aomarco/Roll30`                    |
| Frontend framework | React                               |
| Build tool         | Vite                                |
| Deployment         | GitHub Pages through GitHub Actions |

## Getting Started Locally

```powershell
npm install
npm run dev
```

Other useful commands:

```powershell
npm test
npm run build
npm run preview
```

The production build is written to `dist/`.

## User Experience and Navigation

### Home Page

The app opens on the **home page**, not directly inside the last-opened map.

The home page is the map library. From it, the user can:

- Create a map.
- Give the map a name.
- Choose **Play** or **Battle** as the map type.
- Open an existing map.
- Open its settings.
- Delete it.
- Open the character workspace.

Selecting the Roll30 brand from elsewhere in the app returns to the home page.

### Map Creation

The map's mode is selected when it is created:

- **Play:** a lightweight freeform board.
- **Battle:** a grid-based setup and combat workspace.

The old design that switched between Play and Battle in the middle of a session has been replaced by a mode stored on each map. A map's mode can still be changed from its settings.

### Map Settings

Map settings are available from the home page and from the open map workspace.

The settings page supports:

- Renaming the map.
- Changing its Play/Battle type.
- Uploading or replacing the map image.
- Selecting the **No Map** white-background option.
- Changing battle grid cell size from **24 px to 80 px**.

Each grid square represents **5 feet** regardless of its visual pixel size.

### Character Workspace

Characters have their own full page. The character creator is a complete page section rather than a small card nested inside another bubble.

The page includes:

- A character list.
- New and delete controls.
- Identity fields.
- Point-buy ability controls.
- Derived combat statistics.
- Inventory management.

The Add Item interface is rendered at the document level with a high stacking order, a blurred backdrop, and its own scrolling. It can be closed with its close control, the backdrop, or Escape.

## Map Workspace

The tabletop workspace uses three functional regions:

| Region        | Responsibility                                      |
| ------------- | --------------------------------------------------- |
| Left sidebar  | Encounter and token creation controls               |
| Center board  | Map, grid, tokens, movement, targeting, and effects |
| Right sidebar | Selected-token setup and editing                    |

The general page is designed to fit without whole-page vertical scrolling at normal desktop sizes. Areas that can grow—such as inventories and weapon lists—scroll internally.

At narrower widths or browser zoom levels, the layout reflows instead of merely shrinking everything. On mobile-width layouts, the board becomes the primary vertical workspace.

### Readability

The app includes a dedicated readability layer:

- Small interface labels are generally at least 11–12 px.
- Main controls are generally 12–14 px or larger.
- Interactive targets are larger than the earliest versions.
- Browser zoom causes layout reflow at the relevant breakpoints.

### Motion

The interface intentionally uses energetic, tactile motion:

- Buttons compress and spring.
- Panels and menus enter with swishy transitions.
- Click interactions can produce visual bursts.
- Attack ranges pop outward from the token.
- Combat rolls are staged rather than appearing instantly.
- Damage produces a shake and floating result.

The app respects reduced-motion preferences and shortens or removes nonessential animation when requested by the operating system.

Only the **attack hit sound** remains. General interface sound effects were removed.

## Maps and Tokens

### New Token Defaults

A manually created token begins with:

| Field            | Default |
| ---------------- | ------: |
| HP               |      10 |
| Maximum HP       |      10 |
| AC               |      10 |
| Speed            |   30 ft |
| Initiative bonus |      +0 |
| Strength         |      10 |
| Dexterity        |      10 |
| Level            |       1 |
| Inventory        |   Empty |

Tokens also store an ID, name, grid position, and display color.

### Character-Based Tokens

The Add Token area lists saved character names. Choosing one prefills the new token with that character's:

- Name.
- Maximum and current HP.
- AC.
- Speed.
- Initiative bonus.
- Strength.
- Dexterity.
- Level.
- Inventory.
- Character reference.

A character-based token receives only the weapons in that character's inventory. It does not receive every weapon in the catalog.

### Setup Mode

Battle maps open in **Setup** mode by default.

In Setup, the user can directly edit a token's:

- Name.
- Current HP.
- Maximum HP.
- AC.
- Speed.
- Initiative bonus.
- Strength.
- Dexterity.
- Level.

Setup also provides a quick inventory with:

- Search.
- Item-type filtering.
- Quantity controls.
- Add and remove behavior.
- Internal scrolling for a large future catalog.

The inventory design is generic and is not hard-coded around the current number of weapons.

### Token Position Rules

- Two tokens cannot occupy the same battle-grid square.
- Setup movement snaps tokens into grid cells on Battle maps.
- Play maps permit ordinary freeform dragging.
- Ordinary dragging is immediate; it does not continuously apply the combat movement animation.
- The smooth token transition is reserved for committing a legal combat move.
- Drag calculations compensate for the token's grab point so the token remains visually aligned with the cursor.

## Character Sheets

### Identity Fields

Current character sheets contain:

- Character Name.
- Class.
- Level.
- Race/Species.
- Background.

There is currently one supported class and one supported species:

| Type         | Available option |
| ------------ | ---------------- |
| Class        | Fighter          |
| Race/Species | Human            |

Background is stored as character information but does not yet drive additional rules.

### Ability Scores and Point Buy

Characters use the six core abilities:

- Strength.
- Dexterity.
- Constitution.
- Intelligence.
- Wisdom.
- Charisma.

The current creator uses standard-style **27-point buy**, with purchasable scores from **8 through 15**.

Human currently adds **+1 to every ability score**. The interface distinguishes the purchased score from the final calculated score.

The ability modifier formula is:

```text
floor((score - 10) / 2)
```

### Derived Statistics

Current derived values are:

| Statistic        | Current calculation                                              |
| ---------------- | ---------------------------------------------------------------- |
| Level 1 HP       | `10 + Constitution modifier`, minimum 1                          |
| HP after level 1 | Adds `6 + Constitution modifier` per level, minimum 1 each level |
| AC               | `10 + Dexterity modifier`                                        |
| Initiative bonus | Dexterity modifier                                               |
| Speed            | 30 ft                                                            |

The HP formula is a simplified fixed-average Fighter model. In official D&D, hit points depend on class hit die, level, Constitution modifier, and sometimes species, feats, or other features. Roll30 currently has only Fighter/Human, so it does not yet implement the full class/species system.

### Character Inventory

Character inventories are quantity-based and use the shared item catalog.

The inventory supports:

- Adding an item from the catalog.
- Search by useful item text.
- Item-type filtering.
- Increasing or decreasing quantity.
- Removing the last copy.
- Internal scrolling for large catalogs.

Inventory entries use item IDs instead of embedding duplicate item definitions in every character.

## Item and Weapon Data

### Generic Item Model

The item layer is designed to expand beyond weapons.

An inventory entry has the shape:

```js
{
  itemId: "weapon-id",
  quantity: 1
}
```

The system:

- Normalizes legacy string inventories.
- Merges duplicate item entries.
- Clamps quantities to valid values.
- Searches catalog metadata.
- Exposes generic item types and labels.

At present, the catalog contains weapons only, but the UI and data helpers are structured for future armor, equipment, consumables, and other items.

### Imported Weapons

The five fake prototype weapons were removed. The current catalog contains nine real weapons sourced from the local 2014 D&D 5e SRD data:

| Weapon      | Damage          | Current functional notes |
| ----------- | --------------- | ------------------------ |
| Club        | 1d4 bludgeoning | Simple melee             |
| Mace        | 1d6 bludgeoning | Simple melee             |
| Sickle      | 1d4 slashing    | Simple melee             |
| Flail       | 1d8 bludgeoning | Martial melee            |
| Morningstar | 1d8 piercing    | Martial melee            |
| Rapier      | 1d8 piercing    | Finesse                  |
| Scimitar    | 1d6 slashing    | Finesse                  |
| Shortsword  | 1d6 piercing    | Finesse                  |
| War pick    | 1d8 piercing    | Martial melee            |

Each definition retains relevant metadata such as:

- Name and ID.
- Damage dice and type.
- Category.
- Range.
- Properties.
- Cost.
- Weight.
- Source marker.

Property metadata such as **Light** and **Monk** is preserved even when the corresponding combat rule is not yet implemented.

### Finesse

Finesse is implemented.

When attacking with a finesse weapon, Roll30 compares the attacker's Strength and Dexterity modifiers and uses the higher one for:

- The attack roll.
- The damage roll.

Ordinary current melee weapons use Strength.

### Local D&D Data

The repository contains a `DND 5E Data` directory with local 2014 SRD JSON source data. It is a reference/import source and must not be deleted accidentally.

The app does not dynamically load the whole source dataset at runtime. Supported entries are transformed into the app's explicit catalog schema so rules can be reviewed and tested.

## Battle Lifecycle

### Setup/Battle Switch

Battle maps use a **Setup / Battle** switch.

- **Setup** is for map preparation, token placement, token stats, and inventory.
- **Battle** starts or enters initiative-based combat.

After a battle finishes, the user can return to Setup and start another battle.

### Starting Battle

Starting a battle:

1. Includes the map's current tokens.
2. Restores each token to its configured maximum HP.
3. Snaps battle positions to valid grid cells.
4. Rolls initiative automatically.
5. Sorts tokens from highest to lowest initiative.
6. Creates a fresh turn-resource state for the first token.

### Turn Order

Turn order is a compact floating element in the upper-left of the map rather than a full sidebar section.

It is intentionally simple:

```text
Turn Order
Token 1 (19)
Token 2 (13)
```

The current token glows. Defeated tokens are visually distinguished.

### Combat Controls

The current token's controls appear in a larger bubble in the bottom-right of the board. This gives weapon selection and future actions enough room without clipping.

The current controls are:

- Move.
- Attack.
- Dash.
- End Turn.

The bubble also shows:

- Active token.
- Round.
- Remaining movement.
- Action availability.

## Current Turn Economy

Roll30 now models movement and an action separately.

Each turn starts with:

- Movement equal to the token's speed.
- One available action.
- An unused bonus-action state reserved for future features.
- Dash inactive.

### Movement Currency

Movement is a spendable currency:

- Each square costs **5 feet**.
- A 30-foot token starts with **30 feet**, or six squares.
- Moving subtracts only the distance actually traveled.
- The Move action can be used multiple times while movement remains.
- Movement can be split before and after an attack.
- Unused movement does not carry into the next turn.
- Movement resets at the start of the token's next turn.

### Dash

Dash is manual.

Activating Dash:

- Spends the token's action.
- Doubles that turn's movement maximum.
- Preserves movement already spent.
- Prevents attacking because the action has been used.
- Enters movement mode.

There is no longer an automatic “drag past speed to Dash” rule.

### Attack

Attack spends the action but **does not end the turn**.

After attacking, a token may still use any remaining movement. The user must press **End Turn** explicitly.

### End Turn

End Turn is always manual. It is the normal way to advance initiative, including when the token has no useful actions remaining.

### Bonus Action

The turn-state model contains bonus-action fields, but there is currently no player-facing bonus-action button and no completed bonus-action mechanic. This is groundwork for dual wielding and thrown-weapon retrieval.

## Combat Movement Interaction

When Move is active and the current token is dragged:

1. The token remains visibly in its origin square.
2. An arrow begins at the token and stretches to the live cursor position.
3. The arrow tip points to the cursor, not merely to the center of a grid square.
4. Every intersected grid square along the calculated path highlights.
5. The origin square is white.
6. Squares within the current legal movement budget are green.
7. Squares beyond the legal budget are red.
8. A feet counter previews the movement cost before the drop.
9. Dropping on a legal, unoccupied destination commits the move.
10. The token then smoothly animates to the destination square.
11. An illegal or occupied drop leaves the token at its origin.

The animation applies only when a combat move is committed. It is not active during ordinary Setup or Play dragging.

## Attack Range and Patterns

### Pattern Engine

Attack patterns are generated mathematically and scale without hard-coded maximum levels.

Supported pattern families are:

- Square.
- Diamond.
- Plus.
- Star.

The level-one and level-two outputs are tested against the exact coordinate sets supplied during development. The attacker/token origin is excluded from the affected cells.

### Current Attack Pattern

Current weapon targeting derives a diamond-shaped range from the selected weapon's range in feet:

```text
pattern level = weapon range in feet / 5
```

All currently imported weapons are five-foot melee weapons, so their live targeting area is the adjacent diamond around the attacker.

This is different from the earlier prototype that used a fixed Diamond 2 attack. The current code uses weapon range dynamically.

### Targeting Interaction

Pressing Attack:

- Opens the weapon menu.
- Shows only weapons owned by the active token.
- Keeps the active token's attack area visible.
- Does not show arbitrary ranges merely because the pointer passed over another token.
- Animates affected cells outward from the attacker.
- Prompts the user to click a target.
- Rejects targets outside the selected weapon's range.

New blank tokens have no weapons, so they must receive a weapon through Setup inventory before they can attack.

## Attack Resolution

### Attack Roll

The current attack check is:

```text
d20 + ability modifier + proficiency bonus
```

The result is compared with the target's AC.

- A natural 1 misses.
- A natural 20 is a critical hit.
- Otherwise, the attack hits when the total meets or exceeds AC.

Proficiency bonus is derived from level.

### Ability Modifier

Current weapon ability selection:

- Ordinary melee weapon: Strength.
- Finesse weapon: whichever is higher, Strength or Dexterity.
- The combat engine also supports an explicitly Dexterity-based weapon definition for future ranged weapons.

The selected ability modifier is added to both the attack roll and damage.

### Damage

On a hit:

```text
weapon damage dice + selected ability modifier
```

Damage cannot fall below zero.

On a critical hit:

- Damage dice are doubled.
- The ability modifier is added once.

Successful damage reduces the target's actual HP.

### Advantage and Disadvantage Engine

The underlying combat resolver supports:

- Normal rolls.
- Advantage: roll two d20s and keep the higher.
- Disadvantage: roll two d20s and keep the lower.
- Advantage and disadvantage cancel one another.
- Multiple sources do not stack into extra dice.

The attack presentation can animate both dice and dim the rejected result.

No current weapon or battlefield rule automatically supplies advantage or disadvantage yet. The engine exists for future Heavy, long-range, weapon-swap, and similar rules.

### Attack Presentation

Attacks use a staged cinematic sequence:

1. The d20 rapidly cycles through values.
2. The selected result settles.
3. Ability and proficiency modifiers appear.
4. The total is compared with AC.
5. Hit, miss, or critical result is revealed.
6. On a hit, damage dice animate.
7. The damage modifier is added.
8. The impact is applied.

During resolution, conflicting attack and turn controls are locked.

With reduced motion enabled, the sequence remains understandable but skips lengthy number spinning.

### Impact Feedback

When a target takes damage:

- The remaining attack sound plays.
- The target token shakes.
- The damage number appears dramatically above the target.
- HP updates after the impact.

## Battle Completion

A battle is considered complete when no more than one token remains conscious.

The user can return to Setup and begin another battle. The setup/battle lifecycle must remain reusable; battle completion must not permanently lock the map.

## Persistence

### Local Storage

Roll30 stores lightweight application state using:

| Key                 | Purpose                             |
| ------------------- | ----------------------------------- |
| `roll30-maps`       | Map definitions and saved map state |
| `roll30-active-map` | Most recently active map reference  |
| `roll30-characters` | Character sheets                    |

Saved map state includes the map's:

- ID and name.
- Mode.
- No-map choice.
- Grid size.
- Tokens.
- Token stats and inventory.
- Battle state needed for restoration.

### Map Images

Uploaded images are stored separately in IndexedDB:

| Database        | Object store | Key    |
| --------------- | ------------ | ------ |
| `roll30-assets` | `images`     | Map ID |

The lightweight map record stores whether an image exists, while the image data itself stays out of localStorage. This avoids consuming the much smaller localStorage quota with large data URLs.

### Persistence Boundaries

Persistence is:

- Local to the current browser and device.
- Not tied to an account.
- Not cloud synchronized.
- Not collaborative.
- Not currently exportable or importable as a campaign file.

Clearing browser site data removes saved maps, characters, and images. Storage quota or permission failures should be surfaced in the interface instead of failing silently.

## Key Source Files

| File                      | Responsibility                                                             |
| ------------------------- | -------------------------------------------------------------------------- |
| `src/main.jsx`            | Application shell, routes/state, map workspace, tokens, battle interaction |
| `src/CharactersPage.jsx`  | Character creator and character inventory                                  |
| `src/MapSettingsPage.jsx` | Map naming, mode, background, and grid settings                            |
| `src/characterRules.js`   | Point buy, modifiers, and derived character statistics                     |
| `src/combatRules.js`      | Turn resources, roll modes, and attack resolution                          |
| `src/items.js`            | Generic catalog and inventory helpers                                      |
| `src/weapons.js`          | Imported weapon definitions and weapon helpers                             |
| `src/patterns.js`         | Infinite mathematical attack-pattern generation                            |
| `src/styles.css`          | Base application styling                                                   |
| `src/studio.css`          | Main tabletop studio presentation                                          |
| `src/layout.css`          | Page and responsive layout                                                 |
| `src/movement.css`        | Grid movement, path, arrow, and token effects                              |
| `src/motion.css`          | Global interaction and transition animation                                |
| `src/premium.css`         | Higher-polish visual treatments                                            |
| `src/readability.css`     | Text sizing, target sizing, zoom/reflow improvements                       |

Rule modules have matching `*.test.js` files under `src/`.

## Current Test Coverage

The current automated suite contains **28 tests** covering:

- Point-buy calculations.
- Character-derived statistics.
- Turn-resource creation and spending.
- Manual Dash behavior.
- Advantage/disadvantage selection and cancellation.
- Generic item inventory normalization.
- Quantity behavior.
- Search and filtering.
- Exact Square, Diamond, Plus, and Star pattern coordinates.
- Infinite pattern scaling assumptions.
- Weapon ability choice.
- Finesse modifier selection.
- Proficiency.
- Attack hit/miss/critical logic.
- Damage modifiers.
- Advantage/disadvantage attack resolution.

Run:

```powershell
npm test
npm run build
```

Visual changes should also be checked in the browser at desktop, narrow, and zoomed layouts.

## Known Current Limitations

| Area           | Current limitation                                                     |
| -------------- | ---------------------------------------------------------------------- |
| Rules content  | Only Fighter and Human are supported                                   |
| Items          | Catalog currently contains nine weapons and no other item types        |
| Equipment      | Inventory exists, but equipped loadouts do not                         |
| Weapon choice  | Any owned weapon can currently be chosen when attacking                |
| Bonus actions  | State exists, but no usable bonus-action mechanic exists               |
| Ranged combat  | No ranged or thrown weapons are currently active                       |
| Ammunition     | Not modeled                                                            |
| Creature size  | Not modeled                                                            |
| Heavy weapons  | Size-based disadvantage is not active                                  |
| Reach          | No live Reach or Lance rules                                           |
| Dual wielding  | Not implemented                                                        |
| Thrown objects | No weapon tokens, landing squares, lodging, or retrieval               |
| Multiplayer    | No networking, accounts, shared sessions, or permissions               |
| Persistence    | Browser-local only; no export, sync, or backup                         |
| Accessibility  | Reduced motion exists, but a full keyboard/screen-reader audit remains |

## Agreed Future Combat and Equipment Revision

Everything in this section is **planned and not yet implemented**.

### Goals

The next major revision should add:

- Equipment and pre-battle loadouts.
- Weapon swapping during combat.
- One-hand/two-hand rules.
- Dual wielding and bonus-action attacks.
- Creature size and Heavy disadvantage.
- Reach and simplified Lance behavior.
- Ranged and thrown range bands.
- Physical thrown-weapon outcomes and retrieval.
- More SRD weapons.

### Planned Equipment Model

Before battle, a token can pre-equip a specific weapon or valid pair of weapons.

During battle:

- A token may attack only with an equipped weapon.
- Swapping equipment is an action-like tactical choice with special restrictions.
- A swapped weapon attack has disadvantage on the **attack roll only**.
- Damage is rolled normally if that attack hits.
- The player still ends the turn manually.

The exact state model should distinguish:

- Inventory ownership.
- Primary equipped weapon.
- Optional off-hand weapon.
- Hand occupancy.
- Whether a swap occurred this turn.
- Whether movement, Dash, Attack, or Swap has consumed the relevant option.

### Planned Swap Restrictions

The agreed behavior is:

- A weapon may be pre-equipped before combat without penalty.
- A token may swap to another owned weapon on its turn.
- After swapping, the token may either attack at disadvantage or use allowed movement, subject to the finalized action rules.
- Swapping must not automatically advance initiative.
- If Dash has already been used, the token cannot swap.
- The implementation must preserve explicit End Turn even when no other option remains.

Because the discussion evolved alongside the new movement/action system, these restrictions should be encoded in one tested turn-state reducer rather than scattered UI conditions.

### Planned Hand and Dual-Wield Rules

- One-handed mode is automatic when a weapon is paired for dual wielding.
- A weapon requiring two hands cannot be dual wielded.
- After attacking with one qualifying weapon, the other weapon becomes available as a bonus-action attack.
- The attack modifier still applies to the off-hand attack roll.
- A positive ability modifier is not added to off-hand damage.
- A negative ability modifier still reduces off-hand damage, following the intended 5e-style rule.
- The future Bonus Action button should glow when the off-hand attack becomes available.

The implementation should use weapon property data, not weapon-name special cases.

### Planned Heavy and Size Rule

Creature size will be added to the combat model.

If a **Small** creature attacks with a **Heavy** weapon, the attack roll has disadvantage. This rule should be implemented generically so future monsters and species can use it.

### Planned Reach and Lance

Reach should extend the melee targeting pattern according to weapon data.

Lance will use a deliberately simplified custom rule:

- It has Reach.
- It attacks at disadvantage against a target within 5 feet.
- Mounting and dismounting rules are excluded.

### Planned Range Colors

Affected squares should stop at the weapon's maximum range. There is no generic “impossible range” band beyond that point.

Normal ranged weapons:

| Color  | Meaning                            |
| ------ | ---------------------------------- |
| Green  | Normal range                       |
| Yellow | Long range; attack at disadvantage |

Thrown weapons:

| Color  | Meaning                                   |
| ------ | ----------------------------------------- |
| Green  | Melee range                               |
| Yellow | Normal thrown range                       |
| Red    | Long thrown range; attack at disadvantage |

Red is specifically reserved for long-range throwing because throwing the weapon has additional physical consequences.

### Planned Thrown-Weapon State

A thrown weapon must leave the attacker's equipped hand and become a physical combat-state object.

On a hit:

- A lodging weapon embeds in the target.
- A blunt/non-lodging weapon falls on a nearby legal square.

On a miss:

- The weapon lands on the same or an adjacent legal square near the target.

**Handaxe is explicitly classified as able to lodge.**

The state model should support:

```js
{
  weaponId,
  ownerTokenId,
  state: "ground" | "embedded",
  gridX,
  gridY,
  embeddedInTokenId
}
```

### Planned Retrieval Rules

Embedded weapon:

- Retrieval uses a bonus action.
- Roll against **DC 15**.
- Add both the retriever's Strength modifier and Dexterity modifier.

Ground weapon:

- Can be picked up from the same or an adjacent square.
- Uses a bonus action.
- Requires no roll.

Dead carrier:

- If the original target is dead and the retriever is adjacent, retrieval is free and requires no roll.

After retrieval:

- If the retriever has empty hands, the weapon is equipped immediately without the normal swapping downside.
- Otherwise, it returns to inventory and requires a proper future equip action.

### Planned Additional Weapons

Only weapons whose rules fit the current engine were imported first. Later imports should be staged by the rule systems they require.

The future sequence should broadly be:

1. Equipment/loadout foundation.
2. Advantage/disadvantage sources.
3. Handedness and dual wielding.
4. Size and Heavy.
5. Reach and Lance.
6. Range bands.
7. Thrown-weapon state and retrieval.
8. Import newly supported weapons.
9. Add Versatile behavior.
10. Add ammunition and ammunition tracking later.

### Deferred or Excluded Mechanics

| Mechanic                                 | Decision                                               |
| ---------------------------------------- | ------------------------------------------------------ |
| Net                                      | Excluded; too complex for its value                    |
| Ammunition                               | Deferred until after the core equipment/range revision |
| Mount/unmount Lance rules                | Excluded                                               |
| Full improvised-weapon edge cases        | Deferred                                               |
| Full official object interaction economy | Replaced by Roll30's custom equipment rules            |

## Recommended Implementation Order

When work resumes on the planned revision:

1. Expand tests around the current turn-resource model.
2. Add an explicit loadout/equipment schema with migration for saved tokens.
3. Centralize legal-action calculation in `combatRules.js`.
4. Build the Setup equipment editor.
5. Restrict attack selection to equipped weapons.
6. Add Swap and its disadvantage source.
7. Add bonus-action state and dual wielding.
8. Add creature size and Heavy disadvantage.
9. Add range-band calculation and color output.
10. Add Reach and simplified Lance.
11. Add thrown-weapon entities and retrieval state transitions.
12. Import only the newly supported SRD weapons.
13. Run unit, build, persistence-migration, and browser interaction checks.

Avoid implementing these rules solely as button-disable conditions in React. Rule legality and state transitions should live in pure, tested helpers so saving, UI display, and combat resolution cannot disagree.

## Definition of Done for Future Changes

A combat or inventory feature is complete only when:

- Its rule is represented in the shared data model.
- Its legality is enforced in pure rule code.
- The UI clearly explains why an action is available or unavailable.
- Animation does not obscure the final result.
- Reduced-motion behavior remains usable.
- Old saved maps and inventories migrate safely.
- Unit tests cover the rule's important branches.
- `npm test` passes.
- `npm run build` passes.
- Desktop, narrow, zoomed, and overflow layouts are visually checked.
- The change is summarized under **To Be Updated** until the next full handoff refresh.

## To Be Updated

- **Prevented the application from crashing on its home page when no battle is active.** The shared movement helper now treats a missing turn-resource object as zero available movement instead of attempting to read `movementSpent` from `null`. This restores initial React rendering for clean sessions and normal home-page loads. A regression test now verifies that both movement-total helpers safely accept a missing active turn.

- **Streamlined the in-battle controls and made movement direct.** The dedicated Move button and movement-arming step were removed: the active token can now be dragged whenever it has at least five feet of movement remaining, while the existing route preview, movement currency, collision checks, and committed-move animation remain intact. The combat dock no longer repeats the active token portrait, active-turn name, or Action Ready panel; it retains a compact movement readout and round indicator. Dash is now a deliberately smaller secondary control between Attack and End Turn, and the floating Turn Order list explicitly suppresses horizontal overflow so it cannot show an unnecessary sideways scrollbar.
