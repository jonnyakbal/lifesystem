"""Isolated official CLI worker; no shell or channel credentials."""
import asyncio
import hashlib
import os
import sys
import re
import sqlite3
import time
from pathlib import Path
from .core import AGENTS
from .process import terminate_group

def session_name(agent, owner):
    return 'jonny-' + hashlib.sha256(owner.encode()).hexdigest()[:24] + '-' + agent

def command(agent, owner):
    if agent not in AGENTS and agent != 'hermes':
        raise ValueError('Unknown specialist')
    return [sys.executable, '-m', 'hermes_cli.main'] + ([] if agent == 'hermes' else ['-p', agent]) + ['chat', '-Q',
            '--continue', session_name(agent, owner), '--create-if-missing',
            '--query-file', '-', '--run-budget', '120']

def safe_env(parent=None):
    parent = os.environ if parent is None else parent
    env = {k: parent[k] for k in ('PATH', 'HOME', 'LANG', 'LC_ALL', 'TZ', 'SSL_CERT_FILE', 'SSL_CERT_DIR') if k in parent}
    env.update(HERMES_HOME='/opt/data', PYTHONPATH='/opt/hermes', PYTHONUNBUFFERED='1',
               HERMES_KANBAN_STOP_NUDGE='false', HERMES_ENABLE_PROJECT_PLUGINS='false')
    return env

async def run_worker(agent, owner, text):
    started=time.time()
    process = await asyncio.create_subprocess_exec(*command(agent, owner),
        cwd='/opt/hermes', env=safe_env(), stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        start_new_session=True)
    completed=False
    try:
        out, err = await asyncio.wait_for(process.communicate(text.encode('utf-8')), 160)
        if process.returncode != 0:
            raise RuntimeError('Specialist CLI failed')
        # Quiet mode still prints some dependency warnings on stdout in v0.21.1.
        # Deliver only the persisted final assistant message for the exact reported session.
        home=Path('/opt/data') if agent=='hermes' else Path('/opt/data/profiles')/agent
        result=final_from_session(home/'state.db',
                                  err.decode('utf-8', errors='replace'),started)
        completed=True
        return result
    finally:
        if not completed:await terminate_group(process)

def final_from_session(path, stderr, started):
    ids=re.findall(r'^session_id: ([A-Za-z0-9_-]{1,100})\s*$',stderr,re.M)
    if not ids:raise RuntimeError('Missing session receipt')
    db=sqlite3.connect('file:'+path.as_posix()+'?mode=ro',uri=True)
    try:
        row=db.execute('SELECT role,content,tool_calls,timestamp FROM messages WHERE session_id=? AND active=1 ORDER BY id DESC LIMIT 1',(ids[-1],)).fetchone()
    finally:db.close()
    if not row or row[0]!='assistant' or not row[1] or row[2] not in (None,'','[]') or row[3]<started:
        raise RuntimeError('Missing final assistant receipt')
    return row[1].strip()
