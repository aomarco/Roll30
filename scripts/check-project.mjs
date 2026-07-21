import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const fail = message => failures.push(message);

function javascriptFiles(directory) {
  return readdirSync(directory, { withFileTypes:true }).flatMap(entry => {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'DND 5E Data') return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(path) : entry.name.endsWith('.js') ? [path] : [];
  });
}

for (const file of javascriptFiles(root)) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    fail(`${file.slice(root.length + 1)} has invalid JavaScript: ${error.stderr?.toString().trim() || error.message}`);
  }
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    if (!existsSync(resolve(dirname(file), match[1]))) fail(`${file.slice(root.length + 1)} imports missing module ${match[1]}`);
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
for (const removedMockFile of ['support.js', 'image-slot.js', 'doc-page.js']) {
  if (existsSync(join(root, removedMockFile))) fail(`Legacy mock runtime ${removedMockFile} must not return to production`);
}

if (failures.length) {
  console.error(`Roll30 checks failed (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Roll30 checks passed: JavaScript, HTML links, pinned CDN, ${migrations.length} ordered migrations, and database test presence.`);
