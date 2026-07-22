# Roll30 Master Implementation Guide

**Document status:** authoritative implementation and operations reference  
**Last verified:** 22 July 2026 (Australia/Sydney)  
**Application:** Roll30, a private D&D 5e virtual tabletop for Marcelo and friends  
**Production site:** <https://aomarco.github.io/Roll30/>  
**Source repository:** <https://github.com/aomarco/Roll30>  
**Supabase project:** `eujhtcnnjtwsthscdfqk` (`Roll30`, `ap-northeast-2`, PostgreSQL 17)

## 1. Product intent

Roll30 is a private, browser-based replacement for Roll20. It is deliberately not a public SaaS product: there is no billing, public campaign discovery, marketplace, analytics network, or multi-tenant administration console. A static frontend is hosted free on GitHub Pages; Supabase supplies authentication, PostgreSQL, Row Level Security (RLS), Realtime, private file storage, and trusted Edge Functions.

The production database contains **no pre-created campaigns, characters, scenes, sessions, notes, tokens, templates, or other user-authored demo content**. Every campaign object must be made or imported by a real GM or player.

## 2. Architecture

```text
Browser at GitHub Pages
  ├─ access-gate Edge Function ── service-only IP/password tables
  ├─ Supabase Auth ────────────── email/password identity and JWT
  ├─ PostgREST + RPC ──────────── RLS reads; server-authoritative game actions
  ├─ Realtime ─────────────────── table changes and online presence
  └─ private Storage ──────────── signed URLs for maps, portraits, audio, PDFs
```

The browser receives only a **publishable Supabase key**. The service-role key exists only inside Supabase Edge Functions. Important mutations use database RPC functions that validate `auth.uid()`, campaign membership, GM ownership, the active session, turn ownership, visibility, available resources, collision rules, or concurrency as appropriate.

## 3. Runtime files

| File | Responsibility |
|---|---|
| `index.html` | Landing screen, private access gate, authentication, campaign create/join/trash/restore/delete. |
| `Roll30.html` | Authenticated table shell; also runs the private gate before loading the app. |
| `roll30-backend.js` | Pinned Supabase client, session/profile helpers, campaign queries. |
| `roll30-live.js` | Main tabletop views, server calls, signed media, Realtime subscriptions, live interactions. |
| `roll30/ui.js` | Role-specific navigation, accessible dialogs, empty/loading/error states, common UI rendering. |
| `roll30/gate.js` | Blocking private-gate flow for the table route. |
| `roll30/compendium.js` | Lazy SRD category loading, search/filter/details, campaign import. |
| `roll30-live.css` | Normal sans-serif design system, responsive layout, table/map UI, focus and reduced-motion handling. |
| `DND 5E Data/` | Bundled SRD 5.1 JSON reference library. |
| `supabase/migrations/` | Complete, ordered database history. Never edit an applied migration. |
| `supabase/functions/` | Trusted access-gate and permanent campaign deletion functions. |
| `supabase/tests/001_roll30_integration.sql` | Transactional GM/player/outsider integration and authorization suite. |
| `scripts/check-project.mjs` | JavaScript, HTML, dependency, migration, and mock-removal checks. |
| `scripts/audit-project.mjs` | Permanent 26-area acceptance evidence check. |
| `scripts/check-deployment.mjs` | SHA-256 comparison between the checkout and GitHub Pages. |
| `.github/workflows/quality.yml` | Frontend checks, clean Supabase rebuild/test, and post-deploy byte verification. |

## 4. The 26 completed implementation areas

| # | Area | Implemented result |
|---:|---|---|
| 1 | Private gate and auth | Every entry route blocks on a server-side IP check. The shared password is verified against a database hash; success remembers the IP. Rate limiting, strict origin checks, Supabase email/password accounts, and durable sessions are present. |
| 2 | Campaign lifecycle | Create, join by code, rename, rotate code, archive, leave, trash, restore, and owner-only permanent deletion with storage cleanup. |
| 3 | Members, roles, presence | Owner/GM/player roles, assignment of PCs, removal/leave rules, online presence, and campaign-scoped access. |
| 4 | Application shell | Separate GM/player navigation, live-table shortcut, responsive drawer, skeletons, retries, guided empty states, and dialogs with cancel/close behavior. |
| 5 | Scene library | Create, edit, folder/filter, duplicate, template, trash, restore, permanent delete, and saved scene states. Duplicates/templates include objects and prepared tokens. |
| 6 | Scene builder | Background/grid controls, direct object and token positioning, walls, doors, hazards, terrain, portals, loot, switches, notes, concealment, audience, and trigger configuration. |
| 7 | Media/handouts | Private images, audio, and PDFs; 25 MB client and bucket limits; allowed MIME types; signed URLs; player visibility; map, portrait, handout, and ambience use. |
| 8 | Characters/NPCs | PC/NPC CRUD, ownership, player assignment, sheets, attacks, spells, abilities, resources, portraits, JSON import/export, and server-versioned updates. |
| 9 | 5e compendium | Searchable lazy-loaded SRD categories, record details, filters, and import of supported records into campaigns with required attribution. |
| 10 | Items/inventory/resources | Campaign items, grants, quantities, equip/unequip, consume, transfer, charges, spell slots, resources, short/long rests, and recovery. |
| 11 | Shops | NPC/shopkeeper link, audience, stock, quantity, price adjustment, automatic/approval/manual modes, bargaining checks, atomic purchase resolution, and concurrency protection. |
| 12 | Notes/lore/rules | GM notes, player-visible handouts, campaign rules library, world flags, and SRD reference access. |
| 13 | Messaging/dice | Table messages, whispers, unread tracking, dice expressions/results, GM check requests, and live notifications. |
| 14 | Prompts/responses | GM prompts, selected or whole-table audience, player responses, status changes, and Realtime updates. |
| 15 | Session lifecycle | Start/resume/end sessions, active scene, round/turn state, table code, presentation, ambience, weather, time, lighting, portrait dialogue, and world state. |
| 16 | Tokens/movement | Normalized server-side tokens, prepared scene tokens, add/remove/configure, drag/click movement, speed budget, terrain cost, wall/collision checks, remaining-distance display, and reach preview. |
| 17 | Combat | Initiative add/remove/reorder flow, previous/next turn with round boundaries, attacks, damage/healing, HP, conditions, concentration, death saves, spell use, and GM overrides. |
| 18 | Automation | Interactive object activation, triggers, chained actions, reinforcements, immediate/delayed executions, cancellation/disable controls, loop/depth safeguards, and audit records. |
| 19 | History/recovery | Session event history, automatic reversible records, scene states, snapshots, previews, restore, undo, rewind round, and custom outcomes. Token arrangements are included. |
| 20 | Realtime | Presence plus subscriptions for sessions, messages, characters, prompts, objects, purchases, notes, assets, items, shops, inventory, scenes, states, snapshots, reveals, exploration, automation, events, and membership. |
| 21 | Vision/fog/lighting | Server-calculated player vision, wall occlusion, dim/bright range, concealed-token protection, manual reveals, explored fog, light/weather presentation, and per-player private map-tile delivery. |
| 22 | Security/privacy | RLS on every public table, no anonymous table grants, private storage, signed media, server-side authorization, restricted Edge Function origins, no browser service key, and rate-limited gate. |
| 23 | Reproducible DB/CI | 82 ordered migrations rebuild a clean PostgreSQL 17 project; transactional integration tests cover GM/player/outsider paths and expected denials; CI runs both. |
| 24 | Deployment integrity | Main pushes trigger GitHub Pages; quality waits for database checks, then hashes nine production files against the deployed bytes with retries. |
| 25 | Accessibility/responsive UX | Readable system sans-serif fonts, visible focus, semantic controls, ARIA state/live regions, keyboard-capable buttons/dialogs, mobile navigation/layout, loading/error/empty feedback, and reduced motion. |
| 26 | Operations/documentation | This guide, the completed audit, SRD attribution, automated acceptance audit, troubleshooting, backup/recovery, and safe change procedure. |

## 5. Database schema

All application tables are in `public`, have RLS enabled, and use UUID identities unless a different natural key is required.

### Access control and campaigns

| Table | Purpose and key relationships |
|---|---|
| `authorized_ips` | Server-only remembered network addresses for the private gate. |
| `access_gate_config` | Server-only password hash and gate configuration. The plaintext password is never stored in source. |
| `access_gate_attempts` | Server-only failed-attempt counters and temporary lockout timestamps. |
| `profiles` | Display identity keyed to `auth.users.id`. |
| `campaigns` | Owner, name, system, join code, archive/trash timestamps, and campaign settings. |
| `campaign_members` | `(campaign_id,user_id)` membership, role, assigned character, and campaign permissions. |

The three access-gate tables intentionally have RLS but no browser policies: only trusted server code uses them. Campaign helper functions centralize membership and GM decisions.

### World preparation and media

| Table | Purpose and key relationships |
|---|---|
| `scenes` | Campaign scenes, folders, background reference, grid and presentation configuration, and trash state. |
| `scene_objects` | Walls, doors, terrain, portals, hazards, switches, loot, notes, position, geometry, visibility, and behavior. |
| `scene_triggers` | Trigger/action definitions attached to a scene or object. |
| `scene_templates` | Reusable scene configuration plus object and prepared-token definitions. |
| `scene_states` | Named arrangements of a scene's objects and tokens. |
| `campaign_assets` | Metadata and audience for private Storage objects such as maps, portraits, audio, and PDFs. |
| `campaign_notes` | Campaign notes/handouts and player-visibility state. |
| `scene_map_tiles` | Private tiled-map storage paths and scene grid coordinates. |

### Characters, equipment, and commerce

| Table | Purpose and key relationships |
|---|---|
| `characters` | PC/NPC identity, owner, structured sheet JSON, current state, portrait, and optimistic version. |
| `items` | Campaign-local item definitions and structured effect data. |
| `character_inventory` | Character/item quantities, equipment state, charges, and metadata. |
| `shops` | Shopkeeper, audience, transaction mode, pricing, bargaining, and approval rules. |
| `shop_stock` | Per-shop item price, available quantity, and hidden state. |
| `purchase_requests` | Requested/approved/rejected/fulfilled purchases and resolution details. |

### Communication

| Table | Purpose and key relationships |
|---|---|
| `messages` | Campaign chat, whispers, rolls, and check-request payloads. |
| `message_reads` | Per-user read position/status. |
| `prompts` | GM prompts, audience, state, and structured request data. |
| `prompt_responses` | Per-player response content and roll/result data. |

### Live table, vision, and recovery

| Table | Purpose and key relationships |
|---|---|
| `sessions` | Campaign live-session state, active scene, round/turn, initiative, flags, and presentation. |
| `session_tokens` | Normalized live tokens, character link, ownership, position, size, speed, visibility, and presentation. |
| `session_events` | Append-only gameplay/audit history and reversible payloads. |
| `session_snapshots` | Named recoverable copies of session, token, object, and related state. |
| `session_event_undos` | Records linking an action to its undo and preventing double undo. |
| `session_reveals` | GM-authored manual reveal polygons. |
| `session_exploration` | Per-player explored-fog polygons. |
| `session_map_tile_access` | Short-lived authorization for private per-player tile delivery. |
| `automation_executions` | Scheduled/completed/cancelled automation runs with depth and outcome. |

## 6. Server-authoritative RPC catalogue

The migration history defines the complete SQL contract. Its functions fall into these operational groups:

- **Authorization/helpers:** `is_campaign_member`, `is_campaign_gm`, `validate_access_password`, `touch_updated_at`.
- **Campaign/member:** `create_roll30_campaign`, `join_roll30_campaign`, `regenerate_roll30_join_code`, `set_roll30_campaign_archived`, `trash_roll30_campaign`, `restore_roll30_campaign`, `list_roll30_trashed_campaigns`, `leave_roll30_campaign`, `set_roll30_member_role`, `set_roll30_member_character`, `assign_roll30_character`, `remove_roll30_campaign_member`.
- **Scenes/preparation:** `duplicate_roll30_scene`, `trash_roll30_scene`, `restore_roll30_scene`, `list_roll30_trashed_scenes`, `delete_roll30_scene_permanently`, `save_roll30_scene_template`, `create_roll30_scene_from_template`, `save_roll30_scene_state`, `apply_roll30_scene_state`, `save_roll30_scene_token`.
- **Session/tokens:** `start_roll30_session`, `resume_roll30_session`, `end_roll30_session`, `change_roll30_session_scene`, `set_roll30_session_presentation`, `present_roll30_portrait`, `add_roll30_session_token`, `remove_roll30_session_token`, `configure_roll30_session_token`, `configure_roll30_token_presentation`, `move_roll30_token`.
- **Vision/fog:** `get_visible_roll30_tokens`, `get_roll30_player_vision`, `get_roll30_visible_map_tiles`, `set_roll30_manual_reveal`, `set_roll30_manual_reveal_enabled`, `clear_roll30_exploration`.
- **Combat/character state:** `add_roll30_initiative_entry`, `remove_roll30_initiative_entry`, `advance_roll30_turn`, `retreat_roll30_turn`, `rewind_roll30_round`, `change_roll30_hp`, `resolve_roll30_hp_change`, `resolve_roll30_attack`, `resolve_roll30_combat_attack`, `set_roll30_condition`, `roll_roll30_death_save`, `cast_roll30_spell`, `use_roll30_spell_slot`, `use_roll30_character_ability`, `use_roll30_character_resource`, `rest_roll30_character`, `update_roll30_character_sheet`.
- **Inventory/shops:** `grant_roll30_item`, `mutate_roll30_inventory`, `use_roll30_inventory_item`, `use_roll30_item_charge`, `configure_roll30_shop`, `create_roll30_shop`, `set_roll30_shop_stock`, `remove_roll30_shop_stock`, `request_roll30_purchase`, `resolve_roll30_purchase`.
- **Communication:** `send_roll30_message`, `mark_roll30_messages_read`, `create_roll30_prompt`, `submit_roll30_prompt_response`, `respond_roll30_check_request`, `set_roll30_prompt_status`.
- **Objects/automation:** `activate_roll30_scene_object`, `move_roll30_scene_object`, `execute_roll30_trigger`, `create_roll30_automation_rule`, `run_due_roll30_automations`, `set_roll30_world_flag`.
- **Recovery/audit:** `snapshot_roll30_session`, `preview_roll30_snapshot`, `restore_roll30_snapshot`, `preview_roll30_last_undo`, `undo_roll30_last_action`, `record_roll30_custom_outcome`.
- **Media:** `set_roll30_asset_audience`.

`SECURITY DEFINER` RPCs set a controlled search path, revoke anonymous execution, grant only the needed authenticated role, and perform their own membership/GM/ownership checks. Direct RLS remains the second line of defence.

## 7. Storage and media

`campaign-media` is a **private** bucket. Backend policy permits authenticated campaign members to read allowed media and GMs to manage it. The bucket enforces **25 MiB** and `image/*`, `audio/*`, or `application/pdf`; the browser performs the same early validation. Files are retrieved through expiring signed URLs.

Permanent campaign deletion inventories asset and map-tile paths, deletes them in batches of 100, then deletes the campaign row so foreign-key cascades clean its data. If storage removal fails partway, the database record remains and the response accurately warns that file removal may be partial, allowing a safe retry.

## 8. Security model

1. **Network gate:** both pages call the Edge Function before exposing the app. Only the GitHub Pages origin is accepted. A remembered IP passes; otherwise a password must validate server-side. Five failed attempts produce a temporary lockout.
2. **Account identity:** Supabase Auth supplies the JWT and durable session.
3. **Campaign boundary:** table policies require membership; GM/owner operations require the stronger role.
4. **Action validation:** sensitive gameplay uses RPCs, not browser-trusted calculations.
5. **Media boundary:** bucket is private and signed URLs expire.
6. **Secret boundary:** only a publishable key ships to the browser. Password hash and service role remain in Supabase.

The shared gate password must be changed only by updating its **hash** in the live server configuration. Do not commit the plaintext password, a service-role key, or user credentials.

## 9. Realtime and consistency

The app joins one campaign presence channel keyed by the signed-in user. It listens to relevant table changes and refreshes only the affected view. Database writes remain the source of truth; Realtime is notification, not authorization. Refresh/reconnect therefore reconstructs state from PostgreSQL rather than relying on browser memory.

Movement, purchases, HP, combat, resources, turns, scene application, snapshots, and automation are transactionally validated on the server. This prevents two browsers from safely bypassing stock, turn, movement, or ownership restrictions merely by changing frontend code.

## 10. D&D 5e data and provenance

The `DND 5E Data` directory contains SRD 5.1 JSON including monsters, spells, equipment, rules and related reference categories. The compendium fetches one category on demand, searches locally, displays details, and imports supported records into a campaign. Attribution and license information are maintained in `SRD_ATTRIBUTION.md` and linked from the interface.

## 11. Testing and acceptance

`npm test` performs syntax/link/migration checks and the permanent 26-point evidence audit. The database suite is transactional and creates isolated GM, player, and outsider identities. It currently contains **104 assertion calls** and **22 expected authorization failures**, then rolls everything back.

CI performs three gates:

1. `npm ci` and `npm test` on Node 22.
2. Start a completely clean local Supabase, apply every migration, and run `supabase test db`.
3. After those pass on `main`, SHA-256 compare the checkout with nine files served by GitHub Pages. The deploy check retries for up to five minutes to allow Pages propagation.

The environment available for the final audit had no connected controllable browser, so it could not honestly perform an interactive visual click-through. This is an explicit testing boundary, not hidden evidence. Static accessibility/UX inspection, live HTTP/CORS checks, the integration suite, clean CI rebuild, and exact deployed-byte verification were completed. A human should still conduct the short release smoke path below on a real browser.

## 12. Human release smoke path

1. Open both `/Roll30/` and `/Roll30/Roll30.html` in a private window; confirm the gate appears before any app content.
2. On an unremembered network, enter a wrong password once and then the correct one; confirm the next visit skips the password.
3. Sign in as a GM, create a campaign, scene, PC, NPC, item, shop, note, and session.
4. Sign in as a second player, join, accept character assignment, and keep both browsers open.
5. Verify a token move, message, prompt, HP change, purchase, turn change, reveal, and scene-state apply update on the other browser.
6. Refresh both browsers and confirm the state survives.
7. Test phone-width navigation and keyboard focus. Check that a player cannot see GM notes, hidden media, concealed tokens, or controls.
8. Trash and restore test content, then permanently delete it and confirm its private files no longer open.

## 13. Local development

Prerequisites are Node 22+, Docker Desktop, Git, and Supabase CLI access.

```powershell
npm ci
npx supabase start
npm test
npx supabase test db
npm run serve
```

Open the local URL printed by `serve`. The production Edge Functions restrict CORS to the production GitHub Pages origin, so local gate/function work should use a deliberate local configuration and must never weaken production origin checks by accident.

## 14. Database change procedure

1. Create a migration with `npx supabase migration new descriptive_name`.
2. Add the schema/RPC/RLS change; never rewrite an applied migration.
3. Extend `supabase/tests/001_roll30_integration.sql` with a positive role path and relevant denial path.
4. Run a clean local reset/test, not only a live patch.
5. Apply to the linked Roll30 project and compare local/remote migration ledgers.
6. Run the live transactional suite, inspect security/performance advisors, and verify production remains empty unless real users have intentionally added content.
7. Commit and push; wait for both quality and Pages workflows; verify deployed bytes.

## 15. GitHub release procedure

```powershell
npm test
git status --short
git add <intentional-files>
git commit -m "Describe the completed behavior"
git push origin main
gh run list --limit 4
node scripts/check-deployment.mjs https://aomarco.github.io/Roll30/
```

Do not commit unrelated user changes. The deployment check must say the Pages site matches the checkout before the release is called current.

## 16. Backup, recovery, and deletion

- Supabase is the durable source of campaign state. Use the project backup facilities before risky production migrations.
- Session snapshots and action undo provide game-level recovery, not database disaster recovery.
- Scene and campaign trash are reversible until permanent deletion.
- Permanent campaign deletion removes Storage objects and cascades database content; it is intentionally owner-only and requires the literal confirmation word `DELETE`.
- If permanent deletion reports partial storage removal, retry while the campaign record remains in trash.
- Never use destructive local Git or filesystem commands as a substitute for a migration or documented cleanup.

## 17. Advisor interpretation

The final audit found no unexplained high-severity condition. Expected informational findings are:

- RLS-without-policy notices on the three service-only gate tables. This deliberately denies browser access.
- Authenticated `SECURITY DEFINER` notices on the RPC surface. Each audited RPC revokes anonymous use and performs internal authorization.
- Unused-index notices while production has no gameplay data. Keep the indexes until representative workloads exist; reassess using real query statistics rather than deleting them for a green dashboard.

## 18. Troubleshooting

| Symptom | Check |
|---|---|
| Gate never unlocks | Confirm the request origin is exactly `https://aomarco.github.io`, inspect Edge Function logs, and check rate-limit/IP records server-side. |
| Sign-in works but campaign is absent | Verify the user is in `campaign_members` and the campaign is not trashed. Do not bypass RLS. |
| A live change appears stale | Confirm Realtime subscription status, then refresh; PostgreSQL should reconstruct the canonical state. |
| Media will not upload | Confirm type is image/audio/PDF, size is at most 25 MiB, user is a campaign GM, and the path begins with the campaign ID. |
| Map is visible to the wrong player | Stop sharing the session and inspect reveal/exploration/tile-access RPC results; never expose the untiled private map URL to players under fog. |
| Database CI fails | Reproduce with `npx supabase stop --no-backup`, `npx supabase start`, then `npx supabase test db`; fix migration history rather than patching only the live database. |
| Pages looks old | Check Pages/quality runs, then run the exact-byte deployment script. Browser cache is not proof of deployment state. |

## 19. Intentional constraints and non-goals

- Roll30 is private and optimized for one friend group, not arbitrary public tenants.
- GitHub Pages is static; trusted work belongs in PostgreSQL functions or Supabase Edge Functions.
- The gate is a convenience/privacy perimeter, while Supabase Auth plus RLS remains the actual campaign security boundary.
- SRD data is reference content, not a replacement for non-SRD copyrighted rulebooks.
- There is no claim that automated checks replace human tabletop playtesting or a visual browser smoke test.

## 20. Definition of done

A future change is complete only when its database authorization, GM path, player path, outsider denial, refresh/reconnect behavior, error/empty state, responsive/accessibility behavior, clean migration rebuild, GitHub CI, and deployed Pages bytes are all addressed in proportion to its risk. A table or button alone is never enough.
