import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Read tracked Git blobs only. Never open working-tree .env, runtime data, or images.
const args = process.argv.slice(2);
const repoIndex = args.indexOf('--repo');
const repo = path.resolve(repoIndex >= 0 ? args[repoIndex + 1] : '.');
const git = (...gitArgs) => execFileSync('git', ['-C', repo, ...gitArgs], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
const rules = [
  ['PRIVATE_KEY', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['OPENAI_KEY', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b/],
  ['GITHUB_TOKEN', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['AWS_ACCESS_KEY', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['SLACK_TOKEN', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['GOOGLE_API_KEY', /\bAIza[A-Za-z0-9_-]{35}\b/],
  ['BEARER_LITERAL', /\bBearer\s+[A-Za-z0-9_.-]{32,}/],
  ['SECRET_ASSIGNMENT', /\b(?:api[_-]?key|secret|access[_-]?token|password)\s*[:=]\s*["'][A-Za-z0-9_+/.=-]{24,}["']/i],
];
const textExtension = /\.(?:[cm]?[jt]sx?|md|mdx|json|css|html|ya?ml|toml|sh|ps1|sql|txt)$/i;
function metadataReason(filename) {
  if (/(^|\/)\.env(?:\..*)?$/i.test(filename)) return 'environment';
  if (/^(?:data|screenshots|qa-screenshots|test-results|playwright-report|artifacts|uploads)\//i.test(filename)) return 'runtime-or-artifact';
  if (/^docs\/analise-sistema-/i.test(filename)) return 'personal-analysis-review';
  if (!textExtension.test(filename) && !/(^|\/)(?:LICENSE|Dockerfile|\.gitignore)$/.test(filename)) return 'binary-or-unclassified';
  return null;
}
try {
  const entries = git('ls-tree', '-r', '-z', 'HEAD').toString('utf8').split('\0').filter(Boolean);
  const metadataOnly = [];
  const findings = [];
  let scannedFiles = 0;
  for (const entry of entries) {
    const tab = entry.indexOf('\t');
    const filename = entry.slice(tab + 1);
    const [mode, type, object] = entry.slice(0, tab).split(' ');
    const reason = mode !== '100644' && mode !== '100755' ? 'link-or-nonregular' : metadataReason(filename);
    if (reason || type !== 'blob') { metadataOnly.push({ path: filename, reason: reason || 'nonblob' }); continue; }
    const size = Number(git('cat-file', '-s', object).toString('utf8'));
    if (size > 2 * 1024 * 1024) { metadataOnly.push({ path: filename, reason: 'oversized', size }); continue; }
    const bytes = git('cat-file', 'blob', object);
    if (bytes.includes(0)) { metadataOnly.push({ path: filename, reason: 'binary', size }); continue; }
    const content = bytes.toString('utf8');
    scannedFiles++;
    const matched = rules.filter(([, pattern]) => pattern.test(content)).map(([id]) => id);
    if (matched.length) findings.push({ path: filename, rules: matched });
  }
  console.log(JSON.stringify({ head: git('rev-parse', 'HEAD').toString('utf8').trim(), scannedFiles, findingFiles: findings.length,
    ruleIds: rules.map(([id]) => id), findings, metadataOnly,
    scope: 'Tracked HEAD text blobs only; no matched values, working-tree .env, runtime contents or image rendering.',
    limitation: 'Heuristic and incomplete. Not a certification of absence of secrets, personal information, historical exposures, remote PR refs, forks or caches.' }, null, 2));
  process.exitCode = findings.length ? 1 : 0;
} catch {
  console.error(JSON.stringify({ error: 'AUDIT_FAILED', limitation: 'No completeness or absence claim is possible.' }));
  process.exitCode = 2;
}
