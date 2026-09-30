import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Metadata only: never read runtime JSON, environment files, or secret values.
const repo = path.resolve(process.argv[2] || '.');
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
// rev-list --objects names each blob once, hiding aliases with identical content.
const historical = git('log', '--all', '--format=', '--name-only', '--no-renames', '-z').split('\0').map(item => item.trim()).filter(Boolean);
const current = new Set(git('ls-files', '-z').split('\0').filter(Boolean));
const paths = new Map();
for (const filename of [...historical, ...current]) {
  const category = /^data\/.*\.json$/i.test(filename) ? 'runtime-data'
    : /(^|\/)(screenshots|qa-screenshots|test-results|playwright-report)\//i.test(filename) ? 'capture-artifacts'
    : /(^|\/)\.env(?:\..*)?$/i.test(filename) && !filename.endsWith('.example') ? 'environment-file'
    : null;
  if (!category) continue;
  const entry = paths.get(filename) || { path: filename, category };
  paths.set(filename, entry);
}
const findings = [...paths.values()].sort((a, b) => a.path.localeCompare(b.path));
console.log(JSON.stringify({
  head: git('rev-parse', 'HEAD'),
  refs: git('for-each-ref', '--format=%(refname)').split('\n').filter(Boolean).length,
  currentRiskPaths: findings.filter(item => current.has(item.path)),
  historicalRiskPaths: findings,
  scope: 'Path metadata only. Not a content/secret scan; screenshots and documentation need manual review before public release.',
}, null, 2));
process.exitCode = findings.length ? 1 : 0;
