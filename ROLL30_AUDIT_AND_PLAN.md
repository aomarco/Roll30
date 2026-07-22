# Roll30 Completed Audit

**Audit date:** 22 July 2026  
**Scope:** repository, GitHub Pages, GitHub Actions, live Supabase project, schema history, security advisors, storage, Edge Functions, SRD assets, and all 26 implementation areas
**Result:** **26 / 26 areas implemented and evidenced**

## Executive result

Roll30 is no longer the proof-of-concept described by the original handoff. It is a functioning private virtual tabletop backed by a reproducible Supabase database and deployed from GitHub. The first deep audit exposed structural failures; those were corrected. A second audit then rechecked the repaired system from security, data, deployment, UX, and operational perspectives and fixed the final material gap it found: Storage had browser-side upload limits but lacked equivalent bucket-side enforcement.

The production state at closeout is:

| Measure | Verified result |
|---|---:|
| Completed implementation areas | **26 / 26** |
| Ordered database migrations | **82** |
| Transactional database assertion calls | **104** |
| Explicit expected authorization failures | **22** |
| Public application tables with RLS | **33 / 33** |
| Anonymous table grants | **0** |
| Missing frontend RPC references | **0** |
| Pre-created user/GM content in production | **0 rows** |
| Latest GitHub quality result at audit start | **Passed** |
| Latest GitHub Pages deployment at audit start | **Passed** |

## Evidence standard

“Implemented” here does not mean merely that a button or table exists. Evidence was drawn from:

- source inspection and JavaScript parse/link checks;
- a clean database rebuild from all migrations in GitHub Actions;
- a transactional live integration suite using isolated GM, player, and outsider identities;
- positive behavior assertions and explicit permission-denial assertions;
- schema, grant, RLS, Storage, Realtime, and function inventory queries;
- live Edge Function CORS/gate checks;
- live project health, migration alignment, and empty-content queries;
- exact SHA-256 comparison between release files and GitHub Pages;
- static accessibility, responsive, loading, error, dialog, and role-navigation review.

No controllable browser was connected to the audit environment—the browser runtime explicitly reported an empty browser list. Therefore this audit **does not claim an interactive visual click-through**. That boundary is recorded in the master guide along with a human two-browser smoke script. It does not invalidate the database, HTTP, CI, deployment-byte, or static UI evidence.

## First audit: findings and remediation

The original deep audit correctly scored the early build at 0/21 under a strict definition of done. Its findings and the implemented resolutions are below.

| Original finding | Resolution now present |
|---|---|
| Local, GitHub, deployed frontend, and Supabase were out of sync. | Local `main`, GitHub `main`, migration ledger, live project, and Pages are reconciled. CI verifies deployed bytes after database success. |
| Repository could not recreate the live database. | Complete ordered migration history now rebuilds PostgreSQL 17 from zero; GitHub CI does this on every change. |
| Token normalization broke snapshots and initiative. | `session_tokens` is the source of truth; snapshots, restore, initiative, scene states, duplicates, and templates preserve token arrangements. |
| Vision was secure token filtering, not full fog/lighting. | Server vision geometry, wall occlusion, ranges, manual reveals, explored fog, concealed-token protection, and private per-player map tiles were added. |
| Live UI was a flat replacement dashboard with dead mock assets. | Production mock runtimes and demo content were removed; role-specific grouped navigation, table actions, dialogs, guided states, responsive drawer, and direct map interactions replaced them. |
| No automated test/release safety existed. | Node checks, 26-area acceptance audit, clean Supabase CI rebuild, integration suite, and post-deploy hash verification now gate releases. |
| Realtime coverage was incomplete. | Presence and change subscriptions cover live/session content across gameplay, preparation, media, communication, commerce, recovery, and membership tables. |
| Sensitive behavior trusted the browser. | Movement, turns, combat, HP, resources, purchases, automation, visibility, snapshot recovery, and campaign deletion are server-validated. |
| Media and campaign deletion were incomplete. | Private signed media, audience rules, trash/restore, owner-only deletion, batched storage cleanup, and accurate partial-failure messaging are implemented. |
| Fonts and demonstration content contradicted the requested product. | UI uses readable sans-serif system fonts; Aethertable branding and AI-created campaign content are absent from production. |

## Completion matrix

| # | Workstream | Status | Key evidence |
|---:|---|---|---|
| 1 | Private gate/auth | **Complete** | Both routes block; server hash verification; IP memory; lockout; strict origin; Auth sessions. |
| 2 | Campaign lifecycle | **Complete** | Create/join/rename/code/archive/leave/trash/restore/delete paths and owner checks. |
| 3 | Members/roles/presence | **Complete** | GM/player roles, PC assignment, removal/leave, presence count, RLS boundary. |
| 4 | App shell/role navigation | **Complete** | Separate grouped nav, live shortcut, mobile drawer, guided states, retry, cancelable dialogs. |
| 5 | Scene library/lifecycle | **Complete** | Folder/filter, duplicate, templates, trash/restore/delete, named states, token preservation. |
| 6 | Visual scene builder | **Complete** | Direct token/object placement and configuration for walls, doors, terrain, hazards, portals, switches, loot, notes, and triggers. |
| 7 | Media/handouts | **Complete** | Private bucket, signed URLs, audience, image/audio/PDF, 25 MiB and MIME enforcement. |
| 8 | Characters/NPCs | **Complete** | CRUD, ownership, assignment, structured sheets/state, versioned update, portraits, JSON import/export. |
| 9 | 5e compendium | **Complete** | Lazy SRD categories, search/filter/details, campaign import, license attribution. |
| 10 | Items/inventory/resources | **Complete** | Grant/equip/consume/transfer/charges/slots/resources/rest and server validation. |
| 11 | Shops | **Complete** | Audience, stock, price/modes, bargaining, approval, atomic resolution, stock locking. |
| 12 | Notes/lore/rules | **Complete** | Private/player notes, handouts, rules library, world flags, SRD link. |
| 13 | Messaging/whispers/dice | **Complete** | Table/whisper messages, read state, dice/results, checks, Realtime notices. |
| 14 | Prompts/responses | **Complete** | Audience, player response, GM status, live updates. |
| 15 | Session lifecycle/shared state | **Complete** | Start/resume/end, active scene, presentation, weather/time/light/audio/portrait and durable state. |
| 16 | Map tokens/movement | **Complete** | Normalized tokens, prepared tokens, drag/click movement, server speed/terrain/wall/collision rules, reach guide. |
| 17 | Initiative/HP/conditions/combat | **Complete** | Add/remove, previous/next turns, rounds, attacks, HP, conditions, concentration, death saves, spells. |
| 18 | Automation/objects/triggers | **Complete** | Activations, chained actions, delayed execution, reinforcements, safeguards, control and history. |
| 19 | History/snapshots/undo | **Complete** | Events, scene states, snapshots/previews/restore, undo, rewind, custom outcomes, full token arrangements. |
| 20 | Realtime consistency | **Complete** | Presence and subscriptions; database remains refresh/reconnect source of truth. |
| 21 | Fog/LOS/lighting/reveal | **Complete** | Server geometry/range/walls, explored fog, manual reveal, concealed tokens, private player map tiles. |
| 22 | Security/privacy | **Complete** | 33/33 RLS, zero anon grants, private storage, safe Edge Functions, internal RPC authorization. |
| 23 | Reproducible DB/CI | **Complete** | 82 migrations, clean CI start, transactional tests, pinned toolchain. |
| 24 | Deployment integrity | **Complete** | Main-to-Pages release plus nine-file exact-byte hash gate. |
| 25 | Accessibility/responsive UX | **Complete** | Sans-serif type, focus/ARIA, semantic states, responsive navigation/layout, reduced motion. |
| 26 | Operations/documentation | **Complete** | Master implementation guide, audit report, attribution, acceptance script, runbooks and recovery. |

## Second audit: method and results

### 1. Security and authorization

- All **33 public tables** have RLS enabled.
- No public table grants access to `anon`.
- The only RLS-without-policy advisor notices are the three server-only gate tables; their lack of browser policy is deliberate deny-by-default behavior.
- No anonymous-executable `SECURITY DEFINER` function was found.
- Authenticated definer functions are an intentional RPC API. A focused audit found no such gameplay function lacking internal authentication/campaign authorization patterns.
- `validate_access_password` safely includes `public, extensions` in its search path because password hashing uses `extensions.crypt`.
- The browser contains the publishable key, which is intended for public clients; it contains no service-role key or shared-password literal.
- The access-gate and deletion functions restrict requests to `https://aomarco.github.io` and use server credentials only inside Supabase.

### 2. Storage and deletion

The second audit identified one real defence-in-depth gap: the UI rejected files larger than 25 MiB and unsupported MIME types, but the live bucket metadata did not enforce those restrictions. Migration `20260722025537_enforce_campaign_media_upload_limits.sql` now makes the private `campaign-media` bucket enforce both. The integration test verifies the metadata.

The audit also corrected permanent deletion wording. Because storage is removed in batches, a later batch can fail after earlier batches succeeded. The function now says that the campaign row remains but some files may already be gone and that retrying is safe; it no longer falsely claims nothing changed.

### 3. Database integrity and schema contract

- Local and remote migration histories contain the same ordered **82** versions.
- The complete integration SQL passes against the live project and rolls test data back.
- The frontend makes **81 distinct RPC calls** and all referenced RPCs exist.
- All genuine frontend table references resolve; the only lexical false positive in the inventory query was the Storage bucket name `campaign-media`.
- Transaction-sensitive paths use row locks/versioning or server transactions where needed, including purchase stock and character sheet updates.
- Production project status is `ACTIVE_HEALTHY` on PostgreSQL 17.

### 4. Production-data cleanliness

Counts for campaigns, members, characters, scenes, sessions, messages, items, shops, assets, notes, objects, tokens, templates, and events were all zero during the closeout audit. The application therefore ships no AI-made campaign, character, scene, encounter, or other user-authored proof content.

### 5. Realtime and visibility

Realtime publication/subscription coverage was reconciled with the frontend. Token positions and player vision are obtained through server-filtered functions. Player fog includes current visible polygons and durable explored regions; private map tiles are released through player-specific access rather than sending a hidden full map to the browser.

### 6. UX, accessibility, and responsive behavior

Static inspection confirmed:

- normal-weight system sans-serif font stacks with no serif or ultra-light production typography;
- GM/player navigation differences and GM-only destructive/creation controls;
- semantic forms/buttons, labels, ARIA live/busy/current/expanded/pressed states, and named icon controls;
- visible focus handling, reduced-motion rules, mobile navigation, wrapping/stacking layouts, and usable overflow;
- skeleton/loading feedback, guided empty states, retryable errors, notices, confirmations, and cancelable dialogs;
- live player action bar, turn feedback, movement remaining/reach preview, and readable GM override grouping.

This is code-level UI evidence. A real-browser visual and two-user smoke pass remains the release operator’s human check because no browser was connected to the audit runtime.

### 7. GitHub and deployed site

- Repository: <https://github.com/aomarco/Roll30>
- Site: <https://aomarco.github.io/Roll30/>
- Both the landing page and table page returned HTTP 200.
- Gate CORS preflight from the exact Pages origin returned 204 with that origin; a wrong origin returned 403.
- A live gate check from the authorized audit network returned `allowed: true`.
- GitHub quality starts a clean Supabase instance, applies all migrations, runs the GM/player/outsider suite, and blocks deployed-byte verification until it passes.
- The deployment script compares SHA-256 hashes for both HTML routes, core CSS/JS/backend, three modules, and SRD attribution.

## Advisor classification

| Advisor type | Severity | Audit disposition |
|---|---|---|
| RLS enabled with no policy on gate tables | Info | **Intentional.** Browser access must be denied; Edge Functions use service credentials. |
| Authenticated executable security-definer RPCs | Warning | **Intentional and audited.** This is the trusted gameplay API; anonymous grants are revoked and functions check identity/role. |
| Unused indexes | Info | **Expected on an empty database.** Do not remove schema indexes until representative usage statistics exist. |

No finding above is being re-labelled as “fixed” merely to make a dashboard green. The disposition describes why it is safe in this application’s architecture and what would cause it to be revisited.

## Final risks and honest boundaries

| Boundary | Treatment |
|---|---|
| No controllable browser in audit environment | Explicitly documented; human two-browser release script provided. No interactive claim is made. |
| Shared IP gate is not user authentication | Supabase Auth and RLS remain the real security boundary. The gate is a private-table perimeter. |
| GitHub Pages is public static hosting | No secrets or trusted decisions are placed in the frontend; Supabase performs them. |
| Production is empty | Integration coverage uses rollback-only fixtures. Index usefulness must be reassessed after real play data exists. |
| Game-rule breadth is open-ended | The 26 agreed workstreams are complete; future homebrew/rule expansion is product evolution, not a hidden unfinished mock. |

## Automated regression guard

`npm run audit` checks concrete source/test/deployment evidence for every numbered area and refuses to pass below the audited migration/assertion baseline. It is included in `npm test` and therefore GitHub Actions. This does not replace behavioral tests; it prevents large implementation areas or documentation from silently disappearing while the transactional suite verifies the important multi-role behavior.

## Final conclusion

The original plan’s critical problems—split schema history, broken normalized-token consumers, shallow vision, mock UI residue, browser-trusted actions, incomplete Realtime, missing tests, and deployment drift—have been resolved. The independent second pass found and fixed backend media-limit enforcement and deletion-message accuracy. Roll30 now has a coherent source of truth, private security model, reproducible database, multi-role integration suite, deployed-byte gate, empty production slate, and an operations manual.

Under the documented evidence standard, **Roll30 is complete across all 26 agreed implementation areas**. Future work should be driven by real tabletop play feedback, not by continuing to expand the old proof-of-concept checklist.
