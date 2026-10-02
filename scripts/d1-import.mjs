// Copies the JSON collections of a data directory into D1.
//   node --env-file=.env.local scripts/d1-import.mjs [--dry-run] [--force]
// Without --force an existing D1 collection is never overwritten. Run it with
// the app stopped (or still on LIFESYSTEM_STORAGE=file) so no write is lost.
// health-ledger.json and office-*.json keep their own file stores for now.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { COLLECTION_NAME, SCHEMA, d1Client, encodeCollection, newRevision } from './lib/d1-rest.mjs';

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
const source = path.resolve(process.env.LIFESYSTEM_DATA_DIR || 'data');
const separateStores = name => name === 'health-ledger' || name.startsWith('office-');

const collections = [];
for (const file of (await readdir(source)).sort()) {
  if (!file.endsWith('.json')) continue;
  const name = file.slice(0, -'.json'.length);
  if (!COLLECTION_NAME.test(name) || separateStores(name)) {
    console.log(`ignorado   ${file}`);
    continue;
  }
  const items = JSON.parse(await readFile(path.join(source, file), 'utf8'));
  if (!Array.isArray(items)) throw new Error(`${file} não contém uma lista; nada foi importado.`);
  collections.push({ name, items });
}

if (dryRun) {
  for (const { name, items } of collections) console.log(`importaria ${name} (${items.length} itens)`);
  process.exit(0);
}

const query = d1Client();
await query(SCHEMA);
let imported = 0;
for (const { name, items } of collections) {
  const { encoding, data } = encodeCollection(items);
  const conflict = force
    ? 'DO UPDATE SET rev = excluded.rev, encoding = excluded.encoding, data = excluded.data, updated_at = excluded.updated_at'
    : 'DO NOTHING';
  const result = await query(
    `INSERT INTO lifesystem_collections (name, rev, encoding, data, updated_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(name) ${conflict}`,
    [name, newRevision(), encoding, data, new Date().toISOString()],
  );
  if (result.meta?.changes === 1) { imported++; console.log(`importado  ${name} (${items.length} itens)`); }
  else console.log(`mantido    ${name} (já existe no D1; use --force para substituir)`);
}
console.log(`${imported} de ${collections.length} coleções gravadas no D1.`);
