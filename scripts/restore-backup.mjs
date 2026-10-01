import { constants } from 'node:fs';
import { lstat, mkdtemp, open, readdir, realpath, rename, rmdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This is a rehearsal tool. It deliberately has no default target or production mode.
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const inside = (candidate, root) => {
  const relative = path.relative(root, candidate);
  return !relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
const safeName = name => typeof name === 'string' && /^[a-zA-Z0-9_][a-zA-Z0-9_.-]*\.json$/i.test(name)
  && !name.includes('..') && !/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(name);
async function plainDirectory(directory) {
  let cursor = path.resolve(directory);
  while (true) {
    const stat = await lstat(cursor);
    if (stat.isSymbolicLink()) fail('SYMLINK_REJECTED');
    if (!stat.isDirectory()) fail('DIRECTORY_REQUIRED');
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return realpath(directory);
}
async function jsonAndHash(filename) {
  // Never include parser diagnostics: they can contain personal JSON snippets.
  const handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    if (!(await handle.stat()).isFile()) fail('UNSUPPORTED_ENTRY');
    const bytes = await handle.readFile();
    let json;
    try { json = JSON.parse(bytes.toString('utf8')); } catch { fail('INVALID_JSON'); }
    return { json, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  } finally { await handle.close(); }
}

let staging;
let rollback;
let target;
let movedTarget = false;
try {
  const args = process.argv.slice(2);
  if (args.length !== 5 || !args.includes('--isolated')) fail('ISOLATED_ARGS_REQUIRED');
  const values = {};
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--isolated') continue;
    if (!['--source', '--target'].includes(args[index]) || !args[index + 1] || args[index + 1].startsWith('--') || values[args[index]]) fail('ISOLATED_ARGS_REQUIRED');
    values[args[index]] = args[++index];
  }
  if (!values['--source'] || !values['--target']) fail('ISOLATED_ARGS_REQUIRED');
  const source = await plainDirectory(values['--source']);
  target = await plainDirectory(values['--target']);
  const repo = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  const worktrees = execFileSync('git', ['-C', repo, 'worktree', 'list', '--porcelain', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .split('\0').filter(value => value.startsWith('worktree ')).map(value => path.resolve(value.slice(9)));
  if ([repo, ...worktrees].some(checkout => inside(target, checkout)) || inside(source, target) || inside(target, source)
    || target.split(path.sep).some(segment => ['data', 'runtime', 'production', 'prod'].includes(segment.toLowerCase()))
    || (process.env.LIFESYSTEM_DATA_DIR && inside(target, path.resolve(process.env.LIFESYSTEM_DATA_DIR)))) fail('TARGET_NOT_ISOLATED');
  if ((await readdir(target)).length) fail('TARGET_NOT_EMPTY');

  const names = (await readdir(source)).sort();
  const files = [];
  for (const name of names) {
    const stat = await lstat(path.join(source, name));
    if (stat.isSymbolicLink()) fail('SYMLINK_REJECTED');
    if (!stat.isFile()) fail('UNSUPPORTED_ENTRY');
    if (!safeName(name)) fail('UNSAFE_PATH');
    if (name !== 'manifest.json') files.push(name);
  }
  if (!files.length) fail('EMPTY_BACKUP');
  if (new Set(files.map(name => name.toLowerCase())).size !== files.length) fail('DUPLICATE_PATH');
  let manifest;
  if (names.includes('manifest.json')) {
    manifest = (await jsonAndHash(path.join(source, 'manifest.json'))).json;
    if (manifest?.version !== 1 || !Array.isArray(manifest.files)) fail('INVALID_MANIFEST');
    const seen = new Set();
    for (const file of manifest.files) {
      if (!safeName(file?.path) || file.path === 'manifest.json') fail('UNSAFE_PATH');
      if (seen.has(file.path.toLowerCase())) fail('DUPLICATE_PATH');
      seen.add(file.path.toLowerCase());
      if (!/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0) fail('INVALID_MANIFEST');
    }
    if (manifest.files.length !== files.length || manifest.files.some(file => !files.includes(file.path))) fail('MANIFEST_INVENTORY');
  }
  const inventory = [];
  for (const name of files) {
    const actual = await jsonAndHash(path.join(source, name));
    const expected = manifest?.files.find(file => file.path === name);
    if (expected && (expected.sha256 !== actual.sha256 || expected.size !== actual.size)) fail('INTEGRITY_MISMATCH');
    inventory.push({ path: name, size: actual.size, sha256: actual.sha256 });
  }

  staging = await mkdtemp(path.join(path.dirname(target), `.${path.basename(target)}.restore-stage-`));
  for (const file of inventory) {
    const sourceFile = path.join(source, file.path);
    if ((await lstat(sourceFile)).isSymbolicLink()) fail('SYMLINK_REJECTED');
    const input = await open(sourceFile, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      if (!(await input.stat()).isFile()) fail('UNSUPPORTED_ENTRY');
      const output = await open(path.join(staging, file.path), 'wx', 0o600);
      try { await output.writeFile(await input.readFile()); await output.sync(); }
      finally { await output.close(); }
    } finally { await input.close(); }
    const copied = await jsonAndHash(path.join(staging, file.path));
    const after = await jsonAndHash(sourceFile);
    if (copied.sha256 !== file.sha256 || after.sha256 !== file.sha256 || copied.size !== file.size) fail('INTEGRITY_MISMATCH');
  }
  // Recheck immediately before commit; never overwrite even an unexpected new file.
  await plainDirectory(target);
  if ((await readdir(target)).length) fail('TARGET_NOT_EMPTY');
  rollback = await mkdtemp(path.join(path.dirname(target), `.${path.basename(target)}.restore-rollback-`));
  await rmdir(rollback); // Empty reservation only, no recursive deletion.
  await rename(target, rollback);
  movedTarget = true;
  if ((await readdir(rollback)).length) fail('TARGET_CHANGED');
  await rename(staging, target);
  staging = undefined;
  movedTarget = false;
  await rmdir(rollback);
  rollback = undefined;
  console.log(JSON.stringify({ target, files: inventory.length, integrity: manifest ? 'manifest-sha256' : 'source-target-sha256-only',
    limitation: manifest ? 'Checksums validate the supplied manifest, not its authenticity.' : 'Legacy backup has no original checksum; source-to-target equality cannot detect pre-existing corruption.' }));
} catch (error) {
  // Keep any staged bytes and rollback directory for investigation; never erase them on failure.
  if (movedTarget && rollback) {
    try { await lstat(target); } catch (missing) {
      if (missing.code === 'ENOENT') {
        try { await rename(rollback, target); rollback = undefined; } catch { /* Preserve recovery location. */ }
      }
    }
  }
  console.error(JSON.stringify({ error: /^[A-Z_]+$/.test(error.code || '') ? error.code : 'RESTORE_FAILED', staging, rollback }));
  process.exitCode = 1;
}
