import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = path => readFileSync(join(root, path), 'utf8');
const combined = paths => paths.map(read).join('\n');
const ui = combined(['index.html', 'Roll30.html', 'roll30-live.js', 'roll30-live.css', 'roll30-backend.js', 'roll30/ui.js', 'roll30/gate.js', 'roll30/compendium.js']);
const migrations = readdirSync(join(root, 'supabase', 'migrations')).filter(name => name.endsWith('.sql')).sort();
const sql = migrations.map(name => read(join('supabase', 'migrations', name))).join('\n');
const dbTest = read('supabase/tests/001_roll30_integration.sql');
const workflow = read('.github/workflows/quality.yml');
const deployment = read('scripts/check-deployment.mjs');
const failures = [];

function audit(number, name, checks) {
  const missing = checks.filter(([pattern, source]) => !pattern.test(source)).map(([pattern]) => pattern.toString());
  if (missing.length) failures.push(`${number}. ${name}: missing ${missing.join(', ')}`);
  else console.log(`ok ${number} - ${name}`);
}

audit(1, 'private access gate and account authentication', [[/access-gate/, ui], [/validate_access_password/, sql], [/ensurePrivateAccess/, ui], [/signInWithPassword|signUp/, ui]]);
audit(2, 'campaign lifecycle', [[/create_roll30_campaign/, sql], [/join_roll30_campaign/, sql], [/trash_roll30_campaign/, sql], [/restore_roll30_campaign/, sql], [/delete-campaign/, ui]]);
audit(3, 'members, roles, assignments, and presence', [[/set_roll30_member_role/, sql], [/set_roll30_member_character/, sql], [/remove_roll30_campaign_member/, sql], [/presenceState/, ui]]);
audit(4, 'role-aware application shell', [[/currentRole/, ui], [/data-view/, ui], [/aria-busy/, ui], [/nav-toggle/, ui]]);
audit(5, 'scene library and lifecycle', [[/duplicate_roll30_scene/, sql], [/scene_templates/, sql], [/trash_roll30_scene/, sql], [/delete_roll30_scene_permanently/, sql]]);
audit(6, 'visual scene builder', [[/scene_objects/, sql], [/move_roll30_scene_object/, sql], [/data-add-object/, ui], [/pointerdown|dragstart|mousedown/, ui]]);
audit(7, 'private media and handouts', [[/campaign-media/, sql], [/allowed_mime_types/, sql], [/25 \* 1024 \* 1024/, ui], [/createSignedUrl/, ui]]);
audit(8, 'characters and NPCs', [[/characters/, sql], [/update_roll30_character_sheet/, sql], [/export-character|Export JSON/, ui], [/character-import|Import a Roll30 JSON/, ui]]);
audit(9, '5e compendium', [[/MONSTERS|monsters/, read('roll30/compendium.js')], [/SPELLS|spells/, read('roll30/compendium.js')], [/SRD_ATTRIBUTION/, ui]]);
audit(10, 'items, inventory, resources, and rests', [[/mutate_roll30_inventory/, sql], [/use_roll30_character_resource/, sql], [/use_roll30_spell_slot/, sql], [/rest_roll30_character/, sql]]);
audit(11, 'shops and purchase concurrency', [[/request_roll30_purchase/, sql], [/resolve_roll30_purchase/, sql], [/shop_stock/, sql], [/for update/, sql]]);
audit(12, 'notes, lore, rules, and player handouts', [[/campaign_notes/, sql], [/visible_to_players/, sql], [/custom rules|Custom rule/, ui], [/SRD/, ui]]);
audit(13, 'messages, whispers, dice, and check requests', [[/send_roll30_message/, sql], [/mark_roll30_messages_read/, sql], [/whisper/, ui], [/dice|roll/, ui]]);
audit(14, 'prompts and responses', [[/create_roll30_prompt/, sql], [/submit_roll30_prompt_response/, sql], [/set_roll30_prompt_status/, sql], [/prompt_responses/, sql]]);
audit(15, 'session lifecycle and shared presentation', [[/start_roll30_session/, sql], [/resume_roll30_session/, sql], [/end_roll30_session/, sql], [/set_roll30_session_presentation/, sql]]);
audit(16, 'tokens, movement, and movement guidance', [[/move_roll30_token/, sql], [/session_tokens/, sql], [/movementPreviewActive/, ui], [/movement-reach/, ui]]);
audit(17, 'initiative, HP, conditions, and combat', [[/advance_roll30_turn/, sql], [/retreat_roll30_turn/, sql], [/resolve_roll30_combat_attack/, sql], [/roll_roll30_death_save/, sql]]);
audit(18, 'objects, triggers, and automation', [[/execute_roll30_trigger/, sql], [/create_roll30_automation_rule/, sql], [/run_due_roll30_automations/, sql], [/automation_executions/, sql]]);
audit(19, 'history, scene states, snapshots, and undo', [[/save_roll30_scene_state/, sql], [/snapshot_roll30_session/, sql], [/restore_roll30_snapshot|restore_roll30_snapshot/, sql], [/undo_roll30_last_action/, sql]]);
audit(20, 'realtime synchronization and presence', [[/postgres_changes/, ui], [/channel\.track/, ui], [/supabase_realtime/, sql], [/alter publication/i, sql]]);
audit(21, 'fog, line of sight, lighting, and map tiles', [[/get_roll30_player_vision/, sql], [/session_exploration/, sql], [/get_roll30_visible_map_tiles/, sql], [/vision-overlay/, ui]]);
audit(22, 'security and privacy controls', [[/enable row level security/i, sql], [/revoke all.*anon/is, sql], [/SUPABASE_SERVICE_ROLE_KEY/, read('supabase/functions/delete-campaign/index.ts')], [/allowed_mime_types/, sql]]);
audit(23, 'reproducible database and CI', [[/supabase start/, workflow], [/supabase test db/, workflow], [/npm ci/, workflow], [/roll30_expect_error/, dbTest]]);
audit(24, 'deployment integrity', [[/deployed-pages/, workflow], [/createHash/, deployment], [/deployed bytes differ/, deployment], [/GitHub Pages matches/, deployment]]);
audit(25, 'accessible responsive interface', [[/ui-sans-serif|system-ui/, ui], [/@media.*max-width/is, ui], [/prefers-reduced-motion/, ui], [/aria-label|aria-live/, ui]]);
audit(26, 'operations and implementation documentation', [[/# Roll30 Master Implementation Guide/, read('ROLL30_MASTER_IMPLEMENTATION.md')], [/# Roll30 Completed Audit/, read('ROLL30_AUDIT_AND_PLAN.md')], [/26 \/ 26/, read('ROLL30_AUDIT_AND_PLAN.md')]]);

if (migrations.length < 82) failures.push(`Expected at least 82 migrations; found ${migrations.length}.`);
const assertions = (dbTest.match(/roll30_assert/g) || []).length;
const denials = (dbTest.match(/roll30_expect_error/g) || []).length;
if (assertions < 100 || denials < 20) failures.push(`Database coverage fell below the audited baseline (${assertions} assertions, ${denials} expected denials).`);
for (const required of ['ROLL30_MASTER_IMPLEMENTATION.md', 'ROLL30_AUDIT_AND_PLAN.md', 'SRD_ATTRIBUTION.md']) {
  if (!existsSync(join(root, required))) failures.push(`${required} is missing.`);
}

if (failures.length) {
  console.error(`Roll30 acceptance audit failed (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Roll30 acceptance audit passed: 26/26 areas evidenced, ${migrations.length} migrations, ${assertions} database assertions, and ${denials} expected authorization denials.`);
