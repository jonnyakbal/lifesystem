import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readHealthLedger, transactHealthLedger } from "../src/lib/health/store";

// Each worker appends a synthetic proposal id; no personal data is involved.
const workerSource = `
const ts = require('typescript');
const fs = require('node:fs');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
}).outputText, file);
const { transactHealthLedger } = require(process.env.HEALTH_STORE);
process.send('ready');
process.once('message', async () => {
  try {
    if (process.env.MODE === 'hold') {
      await transactHealthLedger(async ledger => {
        process.send('locked');
        await new Promise(resolve => process.once('message', resolve));
        ledger.receipts.push({ actor: 'holder', key: 'holder', operation: 'test', fingerprint: 'x', resultId: 'holder', recordedAt: new Date().toISOString() });
      });
    } else {
      for (let i = 0; i < 5; i++) {
        await transactHealthLedger(async ledger => {
          await new Promise(resolve => setTimeout(resolve, 30));
          ledger.receipts.push({ actor: process.env.ID, key: process.env.ID + '-' + i, operation: 'test', fingerprint: 'x', resultId: 'r', recordedAt: new Date().toISOString() });
        });
      }
    }
    process.exit(0);
  } catch (error) { console.error(error); process.exit(1); }
});
`;

function worker(dir: string, mode: "hold" | "append", id = "w") {
  const child = spawn(process.execPath, ["-e", workerSource], {
    cwd: resolve(__dirname, ".."), stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: { ...process.env, LIFESYSTEM_DATA_DIR: dir, HEALTH_STORE: resolve(__dirname, "../src/lib/health/store.ts"), MODE: mode, ID: id },
  });
  let output = "";
  child.stdout!.on("data", (d) => { output += String(d); });
  child.stderr!.on("data", (d) => { output += String(d); });
  const messages = new Set<string>();
  child.on("message", (m) => messages.add(String(m)));
  const exited = new Promise<void>((done, fail) => child.once("exit", (code, signal) => (code === 0 || signal ? done() : fail(new Error(`worker ${code}: ${output}`)))));
  void exited.catch(() => undefined);
  return { child, exited, message: (m: string) => expect.poll(() => messages.has(m)).toBe(true) };
}

let dir: string;
let previous: string | undefined;
let children: ChildProcess[];
test.beforeEach(async () => {
  previous = process.env.LIFESYSTEM_DATA_DIR;
  dir = await mkdtemp(join(tmpdir(), "health-lock-"));
  process.env.LIFESYSTEM_DATA_DIR = dir;
  children = [];
});
test.afterEach(async () => {
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill();
  if (previous === undefined) delete process.env.LIFESYSTEM_DATA_DIR;
  else process.env.LIFESYSTEM_DATA_DIR = previous;
  await rm(dir, { recursive: true, force: true });
});

test("a live long-running owner is not robbed of the health lock by age alone", async () => {
  const owner = worker(dir, "hold"); children.push(owner.child);
  await owner.message("ready"); owner.child.send("go"); await owner.message("locked");
  const old = new Date(Date.now() - 120_000);
  await utimes(join(dir, ".health-ledger.lock"), old, old);
  let finished = false;
  const waiting = transactHealthLedger((ledger) => {
    ledger.receipts.push({ actor: "waiter", key: "waiter", operation: "test", fingerprint: "x", resultId: "w", recordedAt: new Date().toISOString() });
  }).then(() => { finished = true; });
  await new Promise((r) => setTimeout(r, 400));
  expect(finished).toBe(false);
  owner.child.send("release");
  await Promise.all([waiting, owner.exited]);
  expect((await readHealthLedger()).receipts.map((r) => r.key).sort()).toEqual(["holder", "waiter"]);
});

test("concurrent processes keep every health ledger write", async () => {
  const runs = ["a", "b", "c"].map((id) => worker(dir, "append", id));
  for (const run of runs) children.push(run.child);
  await Promise.all(runs.map((r) => r.message("ready")));
  for (const run of runs) run.child.send("go");
  await Promise.all(runs.map((r) => r.exited));
  const keys = (await readHealthLedger()).receipts.map((r) => r.key);
  expect(keys).toHaveLength(15);
  expect(new Set(keys).size).toBe(15);
  expect((await readdir(dir)).filter((f) => f.endsWith(".tmp") || f.endsWith(".lock"))).toEqual([]);
});

test("the lock of a terminated owner is recovered", async () => {
  const owner = worker(dir, "hold"); children.push(owner.child);
  await owner.message("ready"); owner.child.send("go"); await owner.message("locked");
  owner.child.kill(); await owner.exited;
  const old = new Date(Date.now() - 120_000);
  await utimes(join(dir, ".health-ledger.lock"), old, old);
  await transactHealthLedger((ledger) => {
    ledger.receipts.push({ actor: "next", key: "next", operation: "test", fingerprint: "x", resultId: "n", recordedAt: new Date().toISOString() });
  });
  expect((await readHealthLedger()).receipts.map((r) => r.key)).toEqual(["next"]);
});

test("a stale lock left by the previous implementation is migrated safely", async () => {
  // The old format is an empty directory without an owner record.
  const legacy = join(dir, ".health-ledger.lock");
  await mkdir(legacy);
  const old = new Date(Date.now() - 120_000);
  await utimes(legacy, old, old);
  await transactHealthLedger((ledger) => {
    ledger.receipts.push({ actor: "after", key: "after", operation: "test", fingerprint: "x", resultId: "a", recordedAt: new Date().toISOString() });
  });
  expect((await readHealthLedger()).receipts.map((r) => r.key)).toEqual(["after"]);
});

test("a failing operation keeps the ledger unchanged and releases the lock", async () => {
  await writeFile(join(dir, "health-ledger.json"), JSON.stringify({ id: "health-v1", schemaVersion: 1, observations: [], proposals: [], receipts: [] }));
  await expect(transactHealthLedger((ledger) => {
    ledger.receipts.push({ actor: "x", key: "lost", operation: "t", fingerprint: "x", resultId: "x", recordedAt: "" });
    throw new Error("boom");
  })).rejects.toThrow("boom");
  expect(JSON.parse(await readFile(join(dir, "health-ledger.json"), "utf8")).receipts).toEqual([]);
  expect((await readdir(dir)).sort()).toEqual(["health-ledger.json"]);
});
