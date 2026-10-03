// Snapshot of the data directory with a manifest (version 1) that
// restore-backup.mjs verifies: exact inventory, size and SHA-256 per file.
//
// Consistency: every file is read and hashed, copied, then the source is
// hashed again. When the second pass matches the first for every file, all
// files held those bytes at the moment the second pass began, so the set is
// a consistent point in time. If writers keep changing files, the copy is
// retried; after the last attempt it is still published, marked
// "best-effort", so a busy app never blocks a deploy's prebuild.
//
// With LIFESYSTEM_STORAGE=d1 the collections live in Cloudflare D1, so they
// are exported into the snapshot too (and take precedence over stale files).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve(process.env.LIFESYSTEM_DATA_DIR || 'data');
const defaultBackupRoot = process.env.LIFESYSTEM_DATA_DIR
  ? path.join(path.dirname(source), 'lifesystem-backups')
  : 'data/backups';
const destinationRoot = path.resolve(process.env.LIFESYSTEM_BACKUP_DIR || defaultBackupRoot);
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const destination = path.join(destinationRoot, stamp);
const ATTEMPTS = 3;
// Same rule as the restore tool: plain, unambiguous JSON names only.
const safeName = name => /^[a-zA-Z0-9_][a-zA-Z0-9_.-]*\.json$/i.test(name) && !name.includes('..')
  && !/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(name) && name !== 'manifest.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function listSource() {
  const names = [];
  for (const name of (await readdir(source)).sort()) {
    if (!safeName(name)) continue;
    const stat = await lstat(path.join(source, name));
    if (stat.isFile() && !stat.isSymbolicLink()) names.push(name);
  }
  return names;
}

async function hashSource(names) {
  const hashes = new Map();
  for (const name of names) {
    try { hashes.set(name, sha256(await readFile(path.join(source, name)))); }
    catch (error) { if (error.code === 'ENOENT') hashes.set(name, null); else throw error; }
  }
  return hashes;
}

await mkdir(destinationRoot, { recursive: true });
let staging;
let consistency = 'best-effort';
let files = [];
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  if (staging) await rm(staging, { recursive: true, force: true });
  staging = await mkdtemp(path.join(destinationRoot, `.${stamp}.staging-`));
  const names = await listSource();
  files = [];
  for (const name of names) {
    let bytes;
    try { bytes = await readFile(path.join(source, name)); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    await writeFile(path.join(staging, name), bytes, { flag: 'wx', mode: 0o600 });
    files.push({ path: name, size: bytes.length, sha256: sha256(bytes) });
  }
  const now = await hashSource(await listSource());
  const unchanged = now.size === files.length && files.every(file => now.get(file.path) === file.sha256);
  if (unchanged) { consistency = 'verified-unchanged'; break; }
  console.warn(`Backup: arquivos mudaram durante a cópia (tentativa ${attempt} de ${ATTEMPTS}).`);
}

const storage = process.env.LIFESYSTEM_STORAGE === 'd1' ? 'd1' : 'file';
if (storage === 'd1') {
  // Collections are authoritative in D1; their export replaces stale files.
  const exportDir = path.join(staging, '.d1');
  const result = spawnSync(process.execPath, [path.resolve('scripts/d1-export.mjs'), exportDir], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (result.status !== 0) {
    console.error('Backup: falha ao exportar o D1; nada foi publicado.');
    process.exit(result.status || 1);
  }
  for (const name of (await readdir(exportDir)).filter(safeName)) {
    const bytes = await readFile(path.join(exportDir, name));
    await writeFile(path.join(staging, name), bytes, { mode: 0o600 });
    files = [...files.filter(file => file.path !== name), { path: name, size: bytes.length, sha256: sha256(bytes) }];
  }
  await rm(exportDir, { recursive: true, force: true });
}

files.sort((a, b) => a.path.localeCompare(b.path));
const manifest = { version: 1, createdAt: new Date().toISOString(), storage, consistency, files };
await writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
await rename(staging, destination);
console.log(`Backup criado: ${destination} (${files.length} arquivos, ${consistency}${storage === 'd1' ? ', inclui D1' : ''})`);
if (consistency !== 'verified-unchanged') console.warn('Backup: publicado como best-effort; houve escrita contínua durante a cópia.');
