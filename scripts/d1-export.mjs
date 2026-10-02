// Writes every D1 collection as <name>.json, the file backend's format.
//   node --env-file=.env.local scripts/d1-export.mjs [destination]
// The result works as a backup and as LIFESYSTEM_DATA_DIR to return to files.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { COLLECTION_NAME, d1Client, decodeCollection } from './lib/d1-rest.mjs';

const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const backupRoot = path.resolve(process.env.LIFESYSTEM_BACKUP_DIR || 'data/backups');
const destination = path.resolve(process.argv[2] || path.join(backupRoot, `d1-${stamp}`));

const query = d1Client();
const rows = (await query('SELECT name, encoding, data FROM lifesystem_collections ORDER BY name')).results || [];
await mkdir(destination, { recursive: true, mode: 0o700 });
for (const row of rows) {
  if (!COLLECTION_NAME.test(row.name)) throw new Error(`Nome de coleção inválido no D1: ${row.name}`);
  const items = decodeCollection(row.name, row.encoding, row.data);
  await writeFile(path.join(destination, `${row.name}.json`), JSON.stringify(items, null, 2), { mode: 0o600 });
  console.log(`exportado  ${row.name} (${items.length} itens)`);
}
console.log(`Exportação do D1: ${destination} (${rows.length} coleções)`);
