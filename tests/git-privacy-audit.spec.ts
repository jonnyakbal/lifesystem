import { expect, test } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('auditoria encontra caminhos com blobs iguais e nunca imprime conteúdo', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'lifesystem-privacy-fixture-'));
  const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' });
  try {
    git('init');
    await mkdir(join(repo, 'data'));
    await writeFile(join(repo, 'data', 'a.json'), 'synthetic-sensitive-marker');
    await writeFile(join(repo, 'data', 'b.json'), 'synthetic-sensitive-marker');
    await writeFile(join(repo, '.env.example'), 'SAMPLE=placeholder');
    git('add', '.');
    git('-c', 'user.name=QA', '-c', 'user.email=qa@example.invalid', 'commit', '-m', 'synthetic fixtures');
    git('rm', 'data/a.json', 'data/b.json');
    git('-c', 'user.name=QA', '-c', 'user.email=qa@example.invalid', 'commit', '-m', 'remove current fixtures');
    const result = spawnSync(process.execPath, [resolve('scripts/audit-git-privacy.mjs'), repo], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('synthetic-sensitive-marker');
    const report = JSON.parse(result.stdout);
    expect(report.currentRiskPaths).toEqual([]);
    expect(report.historicalRiskPaths.map((item: { path: string }) => item.path)).toEqual(['data/a.json', 'data/b.json']);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
