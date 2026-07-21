# Roll30 Deep Audit and Plan of Action

**Audit date:** 22 July 2026  
**Purpose:** Replace estimate-based progress with one authoritative, testable route from the current prototype to a dependable private virtual tabletop.

## Executive conclusion

Roll30 is no longer just the original visual mock-up. It has a real Supabase project, authentication, campaign-scoped data, row-level security, storage, realtime subscriptions, and server-side operations for several game actions. The public GitHub Pages deployment is reachable and the private IP/password gate responds correctly.

However, the project is not close to 17/21 complete under a strict definition of complete. It is a **broad functional prototype** whose features have mostly been implemented as thin database-backed forms. Several important paths conflict with one another, there are no automated tests, the local database history cannot recreate the remote project, and the deployed JavaScript is behind the local database state.

The correct current score is:

| Classification | Count | Meaning |
|---|---:|---|
| Verified complete | **0 / 21** | No workstream has yet passed database, GM browser, player browser, realtime, refresh, error-state, and deployed-site checks. |
| Meaningfully implemented but partial | **15 / 21** | Real data or server behavior exists, but the experience, edge cases, or verification are incomplete. |
| Early stub or currently broken | **6 / 21** | Only a narrow slice exists, or a newer change broke the earlier path. |

This score is deliberately strict. It prevents “a table exists” or “a button calls something” from being reported as “done.”

## What was audited

- The original `AethertableHandoffText.txt` specification.
- All current HTML and JavaScript entry points.
- All local Supabase migrations and the access-gate Edge Function.
- The live Supabase project schema, migration history, functions, RLS policies, publications, advisors, and row counts.
- The Git working tree, local/remote branch relationship, GitHub repository, and GitHub Pages HTTP response.
- The bundled D&D 5e SRD data.
- Static UI structure, role visibility, responsive behavior, empty/loading/error states, and accessibility affordances.

Interactive browser testing could not be performed during this audit because no controllable browser was available in the environment. That limitation is now represented as an explicit verification gap rather than silently assumed success.

## Confirmed strengths

- The GitHub Pages site returns HTTP 200 and identifies itself as **Roll30 · Private Table**.
- The access-gate Edge Function is active. A request from the approved GitHub Pages origin returned 200, while a wrong origin returned 403.
- The gate password is checked server-side against a hash. Failed attempts are counted and temporarily blocked after five failures.
- The browser contains only a publishable Supabase key; no service-role key is exposed.
- Every application table currently exposed in `public` has RLS enabled.
- Campaign membership is used throughout the main data policies.
- Media is stored in a private bucket and accessed with signed URLs.
- The remote database currently contains no demo campaigns, characters, scenes, sessions, notes, templates, tokens, or events.
- Real backend operations exist for campaign creation/joining, HP changes, combat attacks, purchases, scene duplication, templates, triggers, snapshots, initiative advancement, token movement, and token visibility.
- The bundled SRD library is substantial: 334 monsters, 319 spells, 237 equipment records, and related rules data.

## Critical findings

### 1. GitHub, local files, and Supabase are out of sync

The local branch and GitHub `main` both point to commit `5dcb3dc`, but the workspace has an uncommitted JavaScript refactor and two untracked migrations. The live GitHub version does not call `get_visible_roll30_tokens`; the local version does.

At the same time, those token migrations have already been applied to the live Supabase database. The database now stores tokens in `session_tokens`, while the deployed frontend still expects `sessions.state.tokens`. Any newly created live board therefore risks appearing empty on the deployed site.

**Required response:** freeze feature work, reconcile the refactor, repair its dependent features, test it, then deploy one coherent version.

### 2. The repository cannot recreate the live database

Supabase reports **31 remote migrations**, but GitHub contains only the later subset. Missing local history includes the core schema, hardened policy helpers, campaign onboarding RPCs, media storage setup, shared gameplay operations, purchase resolution, session restore, and other changes.

**Required response:** pull or reconstruct a clean baseline from the remote schema, preserve the applied migration ledger, and verify a fresh database can be built from source control.

### 3. Snapshot and initiative paths are broken by the token refactor

The new migration clears `sessions.state.tokens` and moves positions into `session_tokens`. The existing snapshot functions still save and restore only `sessions.state`, so snapshots omit tokens. The initiative form also still reads `state.tokens`, making it disappear after the migration.

**Required response:** update snapshot/restore and initiative to use normalized tokens in the same release as the frontend refactor.

### 4. Vision is safer, but not finished dynamic lighting

The new RPC prevents concealed token positions from being sent to a player and checks range plus wall intersection. That is a valuable security improvement. It does not yet calculate visible map polygons, light contribution, darkness, doors, half-walls, explored fog, or per-player reveal masks. The UI still draws a translucent full-board overlay rather than true fog of war.

**Required response:** call the current work “secure token visibility,” not “dynamic lighting,” then build the actual visibility engine last on top of tested geometry.

### 5. The live interface is a replacement dashboard, not the completed tabletop UX

The original 2,000-line mock interface is removed from the DOM at load time and replaced with a 310-line database dashboard. This successfully hides demo content, but it also discards much of the intended GM/player tabletop interaction. The old mock, its fake arrays, support runtime, and image component are still shipped to every visitor even though they are removed immediately.

The live navigation exposes roughly seventeen flat destinations to both roles. GM-only creation controls are inconsistently hidden. On mobile, the navigation has neither wrapping nor horizontal overflow behavior. Empty states mostly say “Nothing here yet” without guiding the first action. Dialogs lack explicit cancel controls. Loading is a single word. The map uses click-to-move rather than the intended direct manipulation.

**Required response:** remove the dead mock from production, split the live app into maintainable modules, then rebuild a role-specific table experience rather than continuing to add forms to the flat dashboard.

### 6. No test or release safety system exists

There is no package manifest, automated test suite, schema recreation test, multi-user test, lint/build command, deployment smoke test, or CI workflow. Syntax checks are currently the strongest repeatable verification.

**Required response:** create a minimal test harness before expanding features. Every phase below ends in a two-account GM/player test and a deployed smoke test.

### 7. Realtime coverage is incomplete

Realtime publishes sessions, messages, prompts, prompt responses, purchase requests, session events, characters, and scene objects. Normalized `session_tokens` is not published; movement currently forces a session `updated_at` change as an indirect broadcast. Other data such as notes, shops, stock, inventory, scenes, assets, and templates is not live-updated.

**Required response:** define which state must update during a game, subscribe only to that state, and test authorization for each published table.

### 8. A prompt-response display bug is present

The GM query selects response data but does not select `prompt_id`; the UI then filters responses by `r.prompt_id`. GM prompt responses can therefore render as empty even when rows exist.

### 9. Database security is promising but needs hardening and regression tests

Supabase reports 22 security notices, including 19 authenticated `SECURITY DEFINER` RPCs. These are not automatically vulnerabilities: the inspected functions restrict execution to authenticated users and contain membership, ownership, or GM checks. They are nevertheless privileged public API endpoints and require tests proving cross-campaign IDs cannot be used.

All normal public tables still retain broad default grants for `anon`; RLS currently blocks anonymous access, but least privilege would revoke unnecessary anonymous grants. The three gate tables correctly have no client policies and are accessible only to server roles. `touch_updated_at` remains executable by `anon` and should be reviewed/revoked if unnecessary.

Supabase also reports 58 performance notices, primarily missing foreign-key indexes and overlapping permissive RLS policies. These are lower priority while the database is empty, but should be resolved before real campaign data grows.

### 10. Dependency and asset hygiene need work

- Supabase JS is loaded as `@supabase/supabase-js@2`, which is not pinned to an exact version.
- `Roll30.html` is about 202 KB and loads about 130 KB of unused mock support JavaScript.
- The bundled SRD JSON is about 3.9 MB and the current compendium loads entire monster and spell files while only rendering the first 24 monsters.
- No SRD source/license/attribution file was found in the repository. The repository and Pages site are public even if the app is intended only for friends, so provenance must be documented.
- A remaining access-gate mark still displays “A,” a leftover from Aethertable branding.

## The 21 authoritative workstreams

| # | Workstream | Current evidence | Audit state | Completion test |
|---:|---|---|---|---|
| 1 | Private gate and account auth | Edge Function, IP allowlist, password hash, Supabase email auth | Partial | New IP is blocked, correct password allows it, lockout works, refresh remembers it, direct routes gate correctly, sign-up/sign-in/sign-out work. |
| 2 | Campaign lifecycle | Create, join, list, rename | Partial | Create, join, rename, regenerate code, archive, leave, and delete all work with correct ownership and recovery messaging. |
| 3 | Members, roles, and presence | GM/player membership, character assignment, presence count | Partial | Two accounts see correct roles, GM can manage players, players cannot use GM APIs, presence survives reconnects. |
| 4 | App shell and role-specific navigation | Flat live dashboard | Early | GM and player each see only relevant navigation, current location is clear, mobile and keyboard paths work, empty/loading/error states guide action. |
| 5 | Scene library and lifecycle | Create/configure/duplicate/delete/template | Partial | Full scene CRUD, folders, type, image, grid settings, trash/restore, and template creation pass refresh and permission tests. |
| 6 | Visual scene builder | Coordinate-entry object dialog | Early | GM can directly place, drag, edit, layer, snap, and remove tokens/walls/lights/objects on the map and save them. |
| 7 | Media and handouts | Private upload, signed images/audio/PDF | Partial | Upload, validate, preview/play, rename, delete, reuse, audience reveal, file limits, and expired URL recovery work. |
| 8 | Character and NPC library | Basic records and small sheet editor | Partial | PC/NPC/monster CRUD, ownership, portrait/token, complete sheet sections, import/export, refresh, and permissions work. |
| 9 | 5e rules and compendium | Bundled SRD; first 24 monsters shown; monster import | Early | Search/filter/details for spells, monsters, items, classes, races, conditions; imports map cleanly; provenance is documented. |
| 10 | Items, equipment, inventory, and resources | Basic item create/list and inventory rows | Partial | Equip, consume, stack, transfer, currency, charges, rests, slots, conditions, and server validation work. |
| 11 | Shops and purchase workflow | Stock, modes, request/approve, automatic purchase | Partial | Price modifiers, visibility, stock depletion, atomic gold/inventory updates, approve/decline, and concurrency tests pass. |
| 12 | Notes, lore, rules, and handouts | Create and reveal/hide note | Partial | Edit/delete, folders/tags, search, audience rules, live reveal, custom-rule status, and permissions work. |
| 13 | Messaging, whispers, dice, and requests | Table message, whisper, d20 | Partial | Sender identity, timestamps, dice expressions, private recipient checks, action/check requests, unread state, and realtime work. |
| 14 | Prompts and player responses | Prompt create/respond; current GM display bug | Partial/broken | Audience targeting, delivery, response/edit/close, GM result view, check requests, and realtime pass two-account tests. |
| 15 | Session lifecycle and shared state | Start/end session, active scene, rounds | Partial | Start/resume/end, unique active session, join state, reconnect, autosave, session code, and scene transitions work. |
| 16 | Map tokens and movement | Normalized tokens, ownership, speed, wall crossing | Partial/in transition | Add/remove/drag/snap, own-turn enforcement, scale conversion, terrain, collision, realtime, and refresh work without leaking hidden positions. |
| 17 | Initiative, HP, conditions, and combat | Turn RPC, HP RPC, simple attack RPC | Partial/broken | Initiative can be built from normalized tokens; rounds/turns, dice damage, AC, crits, conditions, death, resources, and audit log work. |
| 18 | Automation, objects, triggers, and reinforcements | Manual rules with fog/round effects | Early | Stored trigger-condition-delay-effect chains run automatically, are idempotent, log results, and support doors, traps, levers, and spawns. |
| 19 | History, snapshots, undo, and restore | Events plus old state-only snapshots | Broken by refactor | Snapshots include all normalized state, restore is atomic, undo/rewind works, and GM can preview recovery impact. |
| 20 | Realtime multiplayer consistency | Several Postgres subscriptions plus presence | Partial | Two browsers converge after every live action, reconnect without loss, avoid duplicate renders, and never receive unauthorized rows. |
| 21 | Fog, line of sight, lighting, and reveal | Server-filtered token range/walls | Early | Server-derived per-player visibility includes wall polygons, doors, lights, darkness, explored fog, manual reveal, and security tests. |

## Definition of done for every workstream

A workstream is only counted complete when all applicable boxes are satisfied:

1. **Data:** schema, constraints, indexes, and migration are committed and reproducible.
2. **Authorization:** GM, owner, member, other campaign member, and anonymous cases are tested.
3. **Server behavior:** multi-row or game-rule mutations are atomic RPCs where appropriate.
4. **GM experience:** the complete GM path works without SQL or developer tools.
5. **Player experience:** the complete player path works on a separate account/device.
6. **Realtime:** both clients converge or the feature is explicitly documented as non-live.
7. **Lifecycle:** empty, loading, partial, error, success, refresh, and reconnect states work.
8. **Usability:** keyboard, focus, contrast, mobile layout, and clear feedback pass review.
9. **Tests:** automated tests cover the rule and a manual two-account scenario is recorded.
10. **Deployment:** the GitHub Pages version is confirmed to contain and run the same commit.

## Phased plan of action

### Phase 0 — Stop the drift and establish proof

**Goal:** one trustworthy baseline before feature work resumes.

1. Preserve the current uncommitted token work on a dedicated recovery branch or commit.
2. Pull/reconstruct the missing Supabase baseline and align local migration history with the 31 applied remote migrations.
3. Add a project manifest, exact dependency versions, formatting/lint commands, and a small test runner.
4. Add CI for JavaScript syntax/lint, SQL checks, migration-order checks, and static-link checks.
5. Add a deployment smoke check that verifies the Pages site contains the intended commit marker.
6. Create a non-production test campaign through test setup, never as precreated user content.

**Exit gate:** a fresh environment can be created from source control and CI reports green.

### Phase 1 — Repair the active token refactor and security boundary

**Goal:** remove the current live/local incompatibility without data loss.

1. Make snapshot and restore include `session_tokens` atomically.
2. Make initiative read normalized tokens and remove every remaining dependency on `sessions.state.tokens`.
3. Add explicit token deletion and scene/session cleanup behavior.
4. Decide whether token changes publish directly or continue to broadcast through sessions; document and test the choice.
5. Test visibility and movement with GM, token owner, another player, and a user from another campaign.
6. Validate every privileged RPC with cross-campaign and role-negative tests.
7. Revoke unnecessary anonymous table/function privileges while preserving required client access.
8. Commit, push, wait for Pages, then confirm the deployed script calls the new RPC.

**Exit gate:** deployed GM and player clients can add, see, move, snapshot, restore, and initiate combat with normalized tokens.

### Phase 2 — Replace the dead mock with a maintainable application shell

**Goal:** stop building inside a hidden proof-of-concept document.

1. Remove the `<x-dc>` mock, fake arrays, fake toast handlers, unused support runtime, and unused image component from production.
2. Split the live code into modules for auth, data, realtime, views, dialogs, map, and utilities.
3. Build role-specific navigation: campaign preparation for the GM; character/table/session for players.
4. Add an app-level loading shell, actionable empty states, persistent errors, disabled/submitting states, and explicit dialog cancellation.
5. Make the navigation responsive and keyboard accessible with visible focus.
6. Remove the final Aethertable “A” mark and verify Roll30 naming everywhere.

**Exit gate:** both roles can identify where they are and reach their primary task in at most two actions on desktop and mobile.

### Phase 3 — Finish campaign preparation foundations

**Workstreams:** 2, 3, 5, 7, and 12.

Complete campaign lifecycle, membership controls, scene CRUD/folders, media management, and notes/handouts. Add recoverable deletion where practical. Ensure players never see hidden scene preparation or GM-only notes through either UI or API.

**Exit gate:** a GM can create an entirely empty campaign, invite a friend, prepare a scene and handout, refresh both browsers, and retain everything.

### Phase 4 — Build the real 5e content model

**Workstreams:** 8, 9, and 10.

1. Define a versioned character-sheet schema instead of an unrestricted miscellaneous JSON object.
2. Implement abilities, saves, skills, AC, HP/hit dice, speed, senses, proficiencies, attacks, spellcasting, slots, features, resources, conditions, equipment, currency, personality, and notes.
3. Add character ownership and GM assignment without assuming the creator must own every PC.
4. Build searchable, paginated SRD views and mapping functions for importing monsters, spells, and items.
5. Document the SRD dataset source and license.

**Exit gate:** a player can create/import a character, use its actions/resources, refresh, and see identical derived numbers.

### Phase 5 — Make the virtual table feel like a table

**Workstreams:** 6, 15, 16, and 20.

Build a direct-manipulation scene canvas with drag placement, selection, pan/zoom, grid snapping, layers, token images, object editing, and role-aware interaction. Establish authoritative shared session state and deterministic reconnect behavior before adding more rules.

**Exit gate:** a GM and two players can play an exploration scene for thirty minutes without refreshing to repair state.

### Phase 6 — Complete combat

**Workstream:** 17 plus character resources from Phase 4.

Implement initiative setup from normalized tokens, turns and rounds, movement measured in game units, attacks with dice expressions, damage types, healing, conditions, concentration, death saves, rests, spell slots, limited-use features, and GM overrides. Every state change should create a useful event entry.

**Exit gate:** a small SRD encounter can be played from initiative through defeat using separate GM and player accounts.

### Phase 7 — Complete table communication and commerce

**Workstreams:** 11, 13, and 14.

Fix prompts first, then unify messages, whispers, declared actions, check requests, prompt responses, and shop approvals into one understandable notification model. Finish shop rules and concurrency-safe purchases.

**Exit gate:** players can respond to GM requests and complete automatic or approved purchases without out-of-band coordination.

### Phase 8 — World automation and recovery

**Workstreams:** 18 and 19.

Create a constrained rules format with validated triggers, conditions, delays, and effects. Add automatic event execution, doors/traps/levers/reinforcements, complete snapshots, undo, and round rewind. Avoid arbitrary user-authored code.

**Exit gate:** a saved lever-to-door-to-reinforcement chain runs once, logs each step, and can be safely undone.

### Phase 9 — True player vision and lighting

**Workstream:** 21.

Build and test geometry separately from rendering. Derive visibility server-side from token senses, walls, doors, light sources, darkness, and GM reveal regions. Send only authorized results to each player. Add explored fog and manual overrides after the core polygon tests pass.

**Exit gate:** two players in different positions receive different correct views, hidden token/map data cannot be retrieved through the API, and the GM always has an override.

### Phase 10 — Release hardening

Run the full two-account test matrix, mobile/keyboard/accessibility review, Supabase security and performance advisors, file upload abuse checks, backup/restore drill, error logging, dependency audit, Pages cache/deploy verification, and a complete clean-campaign playthrough.

**Exit gate:** all 21 rows meet the definition of done and the final report links evidence rather than relying on estimates.

## Execution rules that prevent circular work

1. **One phase in progress at a time.** Do not start a new feature while the phase exit gate is red.
2. **Maximum two active workstreams.** Finish or explicitly block them before opening another.
3. **No “done” based on code presence.** Report “implemented, unverified” until the full acceptance test passes.
4. **Database and frontend ship together.** A breaking schema change cannot be applied remotely until its compatible frontend and rollback path are ready.
5. **Every database change is represented locally.** No permanent dashboard-only SQL.
6. **Every push is described in human terms.** Commit hashes may be included as references, never as the accomplishment itself.
7. **Every phase report uses the same format:** user-visible outcome, tests passed, deployed status, known defects, next gate.
8. **No production demo content.** Tests use disposable fixtures or a dedicated test campaign that is removed after verification.
9. **Fix regressions before features.** A red previously-passing acceptance test stops the phase.
10. **Dynamic lighting stays last.** It depends on stable maps, tokens, permissions, realtime, and geometry.

## Immediate next actions

The next implementation session should do only the following, in order:

1. Preserve the unfinished token refactor.
2. Reconstruct and commit the complete Supabase baseline.
3. Repair snapshot/restore and initiative for normalized tokens.
4. Add the first authorization and two-account test harness.
5. Deploy and verify one coherent GitHub/Supabase version.

Only after those five actions pass should UI restructuring or new gameplay features resume.
