import { expect, test } from '@playwright/test';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const restoreScript = resolve('scripts/restore-backup.mjs');
const scanScript = resolve('scripts/audit-public-content.mjs');
const restore = (source: string, target: string, extra: string[] = ['--isolated']) =>
  spawnSync(process.execPath, [restoreScript, '--source', source, '--target', target, ...extra], { encoding: 'utf8' });
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'lifesystem-restore-'));
  const source = join(root, 'snapshot');
  const target = join(root, 'review');
  await mkdir(source);
  await mkdir(target);
  return { root, source, target };
};

test('restaura backup produzido pelo comando real e verifica conteúdo sem imprimir valores', async () => {
  const { root, source, target } = await fixture();
  try {
    await writeFile(join(source, 'tasks.json'), '{"synthetic":"private-fixture-marker"}');
    const backups = join(root, 'snapshots');
    const backup = spawnSync(process.execPath, [resolve('scripts/backup-data.mjs')], {
      env: { ...process.env, LIFESYSTEM_DATA_DIR: source, LIFESYSTEM_BACKUP_DIR: backups }, encoding: 'utf8',
    });
    expect(backup.status).toBe(0);
    const snapshot = join(backups, (await readdir(backups))[0]);
    const result = restore(snapshot, target);
    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toContain('private-fixture-marker');
    // The producer now writes a manifest, so the restore verifies original checksums.
    expect(JSON.parse(result.stdout).integrity).toBe('manifest-sha256');
    expect(await readFile(join(target, 'tasks.json'), 'utf8')).toBe('{"synthetic":"private-fixture-marker"}');
    expect(await readdir(root)).not.toContain('review.rollback');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('recusa corrupção que diverge do checksum declarado sem alterar destino', async () => {
  const { root, source, target } = await fixture();
  try {
    const payload = '{"fixture":true}';
    await writeFile(join(source, 'tasks.json'), '{"fixture":false}');
    await writeFile(join(source, 'manifest.json'), JSON.stringify({ version: 1, files: [
      { path: 'tasks.json', size: Buffer.byteLength(payload), sha256: createHash('sha256').update(payload).digest('hex') },
    ] }));
    const result = restore(source, target);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('INTEGRITY_MISMATCH');
    expect(await readdir(target)).toEqual([]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('restaura manifesto válido e recusa inventário incompleto', async () => {
  const { root, source, target } = await fixture();
  try {
    const payload = '{"fixture":true}';
    await writeFile(join(source, 'tasks.json'), payload);
    await writeFile(join(source, 'manifest.json'), JSON.stringify({ version: 1, files: [
      { path: 'tasks.json', size: Buffer.byteLength(payload), sha256: createHash('sha256').update(payload).digest('hex') },
    ] }));
    const result = restore(source, target);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).integrity).toBe('manifest-sha256');
    expect(await readdir(target)).toEqual(['tasks.json']);
    const second = join(root, 'second'); await mkdir(second);
    await writeFile(join(source, 'extra.json'), '{}');
    expect(restore(source, second).stderr).toContain('MANIFEST_INVENTORY');
    expect(await readdir(second)).toEqual([]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('recusa destino ocupado, sobreposição e ausência de opt-in de isolamento', async () => {
  const { root, source, target } = await fixture();
  try {
    await writeFile(join(source, 'tasks.json'), '{}');
    expect(restore(source, target, []).status).toBe(1);
    expect(restore(source, source).status).toBe(1);
    expect(restore(source, resolve('.')).stderr).toContain('TARGET_NOT_ISOLATED');
    const registered = execFileSync('git', ['worktree', 'list', '--porcelain', '-z'], { encoding: 'utf8' })
      .split('\0').find(item => item.startsWith('worktree '));
    expect(restore(source, registered!.slice(9)).stderr).toContain('TARGET_NOT_ISOLATED');
    await writeFile(join(target, 'keep.txt'), 'keep');
    expect(restore(source, target).stderr).toContain('TARGET_NOT_EMPTY');
    expect(await readFile(join(target, 'keep.txt'), 'utf8')).toBe('keep');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('não substitui arquivo criado no destino durante o staging', async () => {
  const { root, source, target } = await fixture();
  try {
    for (let index = 0; index < 200; index++) await writeFile(join(source, `item-${String(index).padStart(3, '0')}.json`), '{}');
    const child = spawn(process.execPath, [restoreScript, '--source', source, '--target', target, '--isolated']);
    let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
    const completion = new Promise<number | null>((done, reject) => { child.on('close', done); child.on('error', reject); });
    for (let attempts = 0; attempts < 200; attempts++) {
      if ((await readdir(root)).some(name => name.includes('restore-stage-'))) break;
      await new Promise(done => setTimeout(done, 2));
    }
    await writeFile(join(target, 'keep.txt'), 'concurrent-marker', { flag: 'wx' });
    expect(await completion).toBe(1);
    expect(stderr).toContain('TARGET_NOT_EMPTY');
    expect(await readFile(join(target, 'keep.txt'), 'utf8')).toBe('concurrent-marker');
    expect(await readdir(target)).toEqual(['keep.txt']);
    expect(JSON.parse(stderr).staging).toContain('restore-stage-');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('recusa traversal, JSON inválido e diretórios dentro do snapshot', async () => {
  const { root, source, target } = await fixture();
  try {
    await writeFile(join(source, 'tasks.json'), '{}');
    await writeFile(join(source, 'manifest.json'), JSON.stringify({ version: 1, files: [{ path: '../escape.json', sha256: 'a'.repeat(64), size: 2 }] }));
    expect(restore(source, target).stderr).toContain('UNSAFE_PATH');
    await rm(join(source, 'manifest.json'));
    await writeFile(join(source, 'tasks.json'), 'invalid-private-marker');
    const badJson = restore(source, target);
    expect(badJson.stderr).toContain('INVALID_JSON');
    expect(badJson.stderr).not.toContain('invalid-private-marker');
    await writeFile(join(source, 'tasks.json'), '{}');
    await mkdir(join(source, 'nested'));
    expect(restore(source, target).stderr).toContain('UNSUPPORTED_ENTRY');
    expect(await readdir(target)).toEqual([]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('recusa junction de diretório no snapshot sem seguir destino', async () => {
  const { root, source, target } = await fixture();
  try {
    await mkdir(join(root, 'outside'));
    await symlink(join(root, 'outside'), join(source, 'linked.json'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(restore(source, target).stderr).toContain('SYMLINK_REJECTED');
    expect(await readdir(target)).toEqual([]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('retém staging e destino vazio se o snapshot mudar durante a cópia', async () => {
  const { root, source, target } = await fixture();
  try {
    for (let index = 0; index < 200; index++) await writeFile(join(source, `item-${String(index).padStart(3, '0')}.json`), '{"fixture":true}');
    const child = spawn(process.execPath, [restoreScript, '--source', source, '--target', target, '--isolated']);
    let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
    const completion = new Promise<number | null>((done, reject) => { child.on('close', done); child.on('error', reject); });
    for (let attempts = 0; attempts < 200; attempts++) {
      if ((await readdir(root)).some(name => name.includes('restore-stage-'))) break;
      await new Promise(done => setTimeout(done, 2));
    }
    await writeFile(join(source, 'item-199.json'), '{"fixture":false}');
    expect(await completion).toBe(1);
    expect(stderr).toContain('INTEGRITY_MISMATCH');
    expect(await readdir(target)).toEqual([]);
    const retained = JSON.parse(stderr).staging;
    expect(retained).toContain('restore-stage-');
    expect((await readdir(retained)).length).toBeGreaterThan(0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('scanner redige achados e trata environment, runtime e binários somente por metadados', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lifesystem-public-scan-'));
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { stdio: 'pipe' });
  try {
    git('init'); await mkdir(join(root, 'src')); await mkdir(join(root, 'data'));
    await writeFile(join(root, 'src', 'sample.ts'), 'const token = "sk-proj-' + 'syntheticsecret'.repeat(4) + '";');
    await writeFile(join(root, '.env'), 'private-env-marker');
    await writeFile(join(root, 'data', 'personal.json'), 'private-runtime-marker');
    await writeFile(join(root, 'image.png'), Buffer.from([0, 1, 2, 3]));
    git('add', '.'); git('-c', 'user.name=QA', '-c', 'user.email=qa@example.invalid', 'commit', '-m', 'synthetic');
    const result = spawnSync(process.execPath, [scanScript, '--repo', root], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('syntheticsecret');
    expect(result.stdout).not.toContain('private-env-marker');
    expect(result.stdout).not.toContain('private-runtime-marker');
    const report = JSON.parse(result.stdout);
    expect(report.findings).toEqual([{ path: 'src/sample.ts', rules: ['OPENAI_KEY'] }]);
    expect(report.metadataOnly.map((item: { path: string }) => item.path).sort()).toEqual(['.env', 'data/personal.json', 'image.png']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('backup publica manifesto verificado, ignora travas e temporários e não deixa staging', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lifesystem-backup-'));
  try {
    const data = join(root, 'data-source'); const backups = join(root, 'snapshots');
    await mkdir(data);
    await writeFile(join(data, 'tasks.json'), '[{"id":"a"}]');
    await writeFile(join(data, 'office-abc.archive-0123456789abcdef01234567.json'), '{"id":"seg","jobs":[]}');
    await writeFile(join(data, '.tasks.123.tmp'), 'partial');
    await mkdir(join(data, '.tasks.lock'));
    const backup = spawnSync(process.execPath, [resolve('scripts/backup-data.mjs')], { env: { ...process.env, LIFESYSTEM_DATA_DIR: data, LIFESYSTEM_BACKUP_DIR: backups, LIFESYSTEM_STORAGE: 'file' }, encoding: 'utf8' });
    expect(backup.status).toBe(0);
    expect(backup.stdout).toContain('verified-unchanged');
    expect(await readdir(backups)).toHaveLength(1);
    const snapshot = join(backups, (await readdir(backups))[0]);
    expect((await readdir(snapshot)).sort()).toEqual(['manifest.json', 'office-abc.archive-0123456789abcdef01234567.json', 'tasks.json']);
    const manifest = JSON.parse(await readFile(join(snapshot, 'manifest.json'), 'utf8'));
    expect(manifest).toEqual(expect.objectContaining({ version: 1, storage: 'file', consistency: 'verified-unchanged' }));
    expect(manifest.files.find((f: { path: string }) => f.path === 'tasks.json').sha256).toBe(createHash('sha256').update('[{"id":"a"}]').digest('hex'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('backup com escritor ativo nunca falha o deploy e o snapshot continua íntegro', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lifesystem-backup-busy-'));
  try {
    const data = join(root, 'data-source'); const backups = join(root, 'snapshots');
    await mkdir(data);
    for (let i = 0; i < 40; i++) await writeFile(join(data, `c${i}.json`), JSON.stringify({ i, pad: 'x'.repeat(20000) }));
    const writer = spawn(process.execPath, ['-e', `const fs=require('fs');let n=0;setInterval(()=>{const t=${JSON.stringify(join(data, 'c0.json'))}+'.tmp';fs.writeFileSync(t,JSON.stringify({n:n++}));fs.renameSync(t,${JSON.stringify(join(data, 'c0.json'))});},1);`]);
    try {
      const backup = spawnSync(process.execPath, [resolve('scripts/backup-data.mjs')], { env: { ...process.env, LIFESYSTEM_DATA_DIR: data, LIFESYSTEM_BACKUP_DIR: backups, LIFESYSTEM_STORAGE: 'file' }, encoding: 'utf8' });
      expect(backup.status).toBe(0);
      expect(backup.stdout).toMatch(/verified-unchanged|best-effort/);
    } finally { writer.kill(); }
    const snapshot = join(backups, (await readdir(backups)).find(name => !name.startsWith('.'))!);
    const target = join(root, 'review'); await mkdir(target);
    const result = restore(snapshot, target);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).integrity).toBe('manifest-sha256');
    expect((await readdir(backups)).filter(name => name.includes('staging'))).toEqual([]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
