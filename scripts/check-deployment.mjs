import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const baseUrl = (process.argv[2] || 'https://aomarco.github.io/Roll30/').replace(/\/?$/, '/');
const files = ['index.html', 'Roll30.html', 'roll30-live.css', 'roll30-live.js', 'roll30-backend.js', 'roll30/ui.js', 'roll30/gate.js', 'roll30/compendium.js', 'SRD_ATTRIBUTION.md'];
const hash = value => createHash('sha256').update(value).digest('hex');

for (let attempt = 1; attempt <= 18; attempt += 1) {
  const mismatches = [];
  for (const file of files) {
    const local = await readFile(new URL(`../${file}`, import.meta.url));
    const response = await fetch(new URL(file, baseUrl), { cache: 'no-store' });
    if (!response.ok) {
      mismatches.push(`${file}: HTTP ${response.status}`);
      continue;
    }
    const remote = Buffer.from(await response.arrayBuffer());
    if (hash(local) !== hash(remote)) mismatches.push(`${file}: deployed bytes differ`);
  }
  if (!mismatches.length) {
    console.log(`GitHub Pages matches this checkout at ${baseUrl}`);
    process.exit(0);
  }
  if (attempt === 18) {
    console.error(`Deployment smoke check failed after ${attempt} attempts:\n- ${mismatches.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`Deployment not current yet (attempt ${attempt}/18); retrying in 10 seconds.`);
  await new Promise(resolve => setTimeout(resolve, 10_000));
}
