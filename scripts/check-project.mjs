import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const fail = message => failures.push(message);

for (const file of readdirSync(root).filter(name => name.endsWith('.js'))) {
  try {
    execFileSync(process.execPath, ['--check', join(root, file)], { stdio: 'pipe' });
  } catch (error) {
    fail(`${file} has invalid JavaScript: ${error.stderr?.toString().trim() || error.message}`);
  }
}

for (const htmlName of ['index.html', 'Roll30.html']) {
  const html = readFileSync(join(root, htmlName), 'utf8');
  if (!/<html(?:\s|>)/i.test(html) || !/<\/html>/i.test(html)) fail(`${htmlName} is not a complete HTML document`);
  if (/supabase-js@2(?:["/])/.test(html)) fail(`${htmlName} uses an unpinned Supabase JS major version`);
  for (const match of html.matchAll(/(?:src|href)=["']\.\/([^"'#?]+)["']/g)) {
    const localPath = decodeURIComponent(match[1]);
    if (!existsSync(join(root, localPath))) fail(`${htmlName} references missing file ${localPath}`);
  }
}

const migrationDirectory = join(root, 'supabase', 'migrations');
const migrations = readdirSync(migrationDirectory).filter(name => name.endsWith('.sql')).sort();
const versions = migrations.map(name => name.match(/^(\d{14})_[a-z0-9_]+\.sql$/)?.[1]);
if (versions.some(version => !version)) fail('Every migration must use YYYYMMDDHHMMSS_snake_case.sql naming');
if (new Set(versions).size !== versions.length) fail('Migration versions must be unique');
if (migrations.length < 36) fail(`Expected the reconciled migration history (36+ files), found ${migrations.length}`);

const integrationTest = join(root, 'supabase', 'tests', '001_roll30_integration.sql');
if (!existsSync(integrationTest)) fail('The transactional Supabase integration test is missing');

if (failures.length) {
  console.error(`Roll30 checks failed (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Roll30 checks passed: JavaScript, HTML links, pinned CDN, ${migrations.length} ordered migrations, and database test presence.`);
