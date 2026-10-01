"""Optional operational telemetry. Never exports prompts or blocks model work on network I/O."""
import asyncio
import hashlib
import json
import logging
import os
import random
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger(__name__)
AGENTS = ['vega', 'sirius', 'orion', 'astro', 'cosmo']

def now():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise OSError('Office redirects are disabled')

class OfficePublisher:
    def __init__(self, home, url=None, token=None):
        self.home, self.url, self.token = Path(home), url, token
        self.enabled = bool(url and token and len(token) >= 32)
        self.boot = uuid.uuid4().hex
        self.session = None
        self.runs = {}
        self.gap = False
        self.catalog = None
        self.lock = threading.RLock()
        self.last_flush = 0
        self.path = self.home/'specialists/office.sqlite'
        if not self.enabled:
            return
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != 'https' or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('Office endpoint must be HTTPS without embedded credentials')
        self.url = url.rstrip('/')
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self.connect()) as db, db:
            db.execute('CREATE TABLE IF NOT EXISTS outbox (sequence INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT, created REAL)')
            # Preserve terminal receipts, but never replay stale presence after restart.
            discard = [(seq,) for seq, raw in db.execute('SELECT sequence,event FROM outbox').fetchall()
                       if json.loads(raw)['kind'] != 'run.finished']
            self.gap = bool(discard)
            db.executemany('DELETE FROM outbox WHERE sequence=?', discard)
        self.path.chmod(0o600)
        self.load_catalog()

    @classmethod
    def from_env(cls, home):
        try:
            return cls(home, os.getenv('HERMES_OFFICE_URL'), os.getenv('HERMES_OFFICE_TOKEN'))
        except Exception:
            log.warning('Office telemetry disabled: invalid configuration or storage')
            return cls(home)

    def connect(self):
        return sqlite3.connect(self.path, timeout=.1)

    def load_catalog(self):
        path = self.home/'specialists/office-catalog.json'
        try:
            if path.stat().st_size > 60000:
                return
            catalog = json.loads(path.read_text(encoding='utf-8'))
            # Only explicitly packaged, hash-matching sources attest deployed metadata.
            verified = True
            for profile in catalog['profiles']:
                for source in profile['sources']:
                    ref = source['reference']
                    if source['kind']=='connector' and ref=='lifesystem:mcp:'+profile['id']:
                        source['verifiedAt']=None
                        continue
                    parts = Path(ref).parts
                    permitted = ref.startswith(('profiles/', 'skills/', 'documentation/personal-specialists/', 'plugins/jonny-specialists/'))
                    if not permitted or '..' in parts or Path(ref).is_absolute():
                        verified = False
                        continue
                    target = (self.home/ref).resolve()
                    if not target.is_relative_to(self.home.resolve()) or not target.is_file():
                        verified = False
                        continue
                    digest = hashlib.sha256(target.read_bytes()).hexdigest()
                    if source.get('revision') != digest:
                        verified = False
                        source['verifiedAt'] = None
                    else:
                        source['verifiedAt'] = now()
            catalog['provenance'] = 'deployed' if verified else 'local'
            self.catalog = catalog
        except (OSError, ValueError, KeyError, TypeError):
            log.info('Office catalog unavailable; presence remains usable')

    def enqueue(self, kind, payload):
        if not self.enabled:
            return
        with self.lock, closing(self.connect()) as db, db:
            if kind == 'snapshot':
                db.execute("DELETE FROM outbox WHERE json_extract(event, '$.kind') = 'snapshot'")
            db.execute('INSERT INTO outbox(event,created) VALUES (?,?)', (json.dumps({'kind':kind,'emittedAt':now(),'payload':payload}, ensure_ascii=False), time.time()))
            count = db.execute('SELECT COUNT(*) FROM outbox').fetchone()[0]
            if count > 2000:
                db.execute('DELETE FROM outbox WHERE sequence IN (SELECT sequence FROM outbox ORDER BY sequence LIMIT ?)', (count-2000,))
                self.gap = True
            expired = db.execute('DELETE FROM outbox WHERE created < ?', (time.time()-7*86400,)).rowcount
            if expired:
                self.gap = True

    def accept(self, key, agent, channel):
        if not self.enabled:
            return
        try:
            with self.lock:
                run = {'runId':key, 'agentId':agent, 'channel':channel, 'status':'accepted', 'acceptedAt':now()}
                self.runs[key] = run
                self.enqueue('run.accepted', dict(run))
        except Exception:
            self.gap = True
            log.warning('Office admission telemetry unavailable')

    def finish(self, key, status):
        if not self.enabled:
            return
        try:
            with self.lock:
                run = self.runs.get(key)
                if not run:
                    return
                run['status'] = status
                if status == 'running':
                    run['startedAt'] = now()
                else:
                    run['finishedAt'] = now()
                    self.runs.pop(key, None)
                self.enqueue('run.started' if status == 'running' else 'run.finished', dict(run))
        except Exception:
            self.gap = True
            log.warning('Office completion telemetry unavailable')

    def snapshot(self):
        with self.lock:
            return {'monitored':AGENTS, 'runs':[dict(r) for r in self.runs.values()], 'catalogRevision':self.catalog['revision'] if self.catalog else None, 'gap':self.gap}

    def pending_events(self):
        with self.lock, closing(self.connect()) as db:
            rows = db.execute("SELECT sequence,event FROM outbox ORDER BY CASE json_extract(event, '$.kind') WHEN 'snapshot' THEN 0 WHEN 'catalog.updated' THEN 1 ELSE 2 END, sequence LIMIT 48").fetchall()
        return [dict(json.loads(raw), schemaVersion=1, sessionId=self.session, sequence=seq) for seq,raw in rows]

    def queue_count(self):
        with self.lock, closing(self.connect()) as db:
            return db.execute('SELECT COUNT(*) FROM outbox').fetchone()[0]

    def request(self, path, body):
        raw = json.dumps(body, ensure_ascii=False).encode('utf-8')
        if len(raw) > 65536:
            raise ValueError('Office payload exceeds limit')
        request = urllib.request.Request(self.url+'/'+path, raw, {'Content-Type':'application/json','Authorization':'Bearer '+self.token}, method='POST')
        with urllib.request.build_opener(NoRedirect).open(request, timeout=5) as response:
            return json.loads(response.read(65536))

    def flush(self):
        if not self.session:
            self.session = self.request('sessions', {'bootId':self.boot})['id']
            if self.catalog:
                self.enqueue('catalog.updated', self.catalog)
        self.enqueue('snapshot', self.snapshot())
        events = self.pending_events()
        # A full catalog gets its own request; every batch stays within the body bound.
        batch=[]
        for event in events:
            if len(json.dumps(batch+[event], ensure_ascii=False).encode('utf-8')) > 65000:
                break
            batch.append(event)
        if not batch:
            raise ValueError('Unpublishable office event')
        self.request('events', batch)
        with self.lock, closing(self.connect()) as db, db:
            db.executemany('DELETE FROM outbox WHERE sequence=?', [(e['sequence'],) for e in batch])
        self.last_flush = time.monotonic()

    async def run(self):
        delay = 3
        while True:
            try:
                if self.queue_count() or time.monotonic()-self.last_flush >= 30:
                    await asyncio.to_thread(self.flush)
                delay = 3
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                delay = min(60, max(6, delay*2))
                if isinstance(exc, urllib.error.HTTPError):
                    if exc.code == 409:
                        log.warning('Office publisher retired; stopping publication')
                        return
                    retry = exc.headers.get('Retry-After', '')
                    if retry.isdigit():
                        delay = max(delay, min(300, int(retry)))
                log.warning('Office publication unavailable (%s)', type(exc).__name__)
            await asyncio.sleep(delay+random.uniform(0,.5))

    def start(self, ctx):
        if self.enabled:
            ctx.spawn_task(self.run(), name='specialist:office-publisher')
