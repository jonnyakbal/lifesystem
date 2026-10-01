"""Authenticated office conversation consumer; transport retries never rerun tools."""
import asyncio
import hashlib
import json
import sqlite3
import uuid
from contextlib import closing

AGENTS=('hermes','vega','sirius','orion','astro','cosmo')
UNCERTAIN='Este atendimento foi interrompido. Confira os registros antes de repetir um pedido que alterava dados; não vou executar novamente automaticamente.'

def bounded_reply(text):
    byte_count=units=0
    for i,c in enumerate(text):
        byte_count+=len(json.dumps(c,ensure_ascii=False)[1:-1].encode('utf-8'));units+=2 if ord(c)>65535 else 1
        if byte_count>48000 or units>23000:
            return text[:i]+'\n\n[Resposta extensa: continuação preservada no histórico do Hermes. Peça o próximo trecho.]'
    return text

class OfficeCommands:
    def __init__(self,bridge):
        self.bridge=bridge
        self.office=bridge.office
        self.path=self.office.home/'specialists/office-chat.sqlite'
        self.path.parent.mkdir(parents=True,exist_ok=True)
        with closing(sqlite3.connect(self.path)) as db,db:
            db.execute('CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,status TEXT,response TEXT)')
            columns={r[1] for r in db.execute('PRAGMA table_info(receipts)')}
            if 'claim_session' not in columns:db.execute('ALTER TABLE receipts ADD COLUMN claim_session TEXT')
            if 'delivered' not in columns:db.execute('ALTER TABLE receipts ADD COLUMN delivered INTEGER DEFAULT 0')
        self.path.chmod(0o600)

    def record(self,id,status,response):
        with closing(sqlite3.connect(self.path)) as db,db:
            db.execute('INSERT INTO receipts(id,status,response,claim_session,delivered) VALUES (?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET status=excluded.status,response=excluded.response,delivered=0',(id,status,response,self.office.session))

    def receipt(self,id):
        with closing(sqlite3.connect(self.path)) as db:
            return db.execute('SELECT status,response,claim_session FROM receipts WHERE id=?',(id,)).fetchone()

    async def send(self,id,status,response=None):
        body={'op':'result','sessionId':self.office.session,'id':id,'status':status}
        receipt=self.receipt(id)
        if receipt and receipt[2]:body['receiptSession']=receipt[2]
        if response:body['response']=response
        await asyncio.to_thread(self.office.request,'commands',body)
        if status!='running':
            with closing(sqlite3.connect(self.path)) as db,db:
                db.execute('UPDATE receipts SET delivered=1 WHERE id=?',(id,))

    async def flush_results(self):
        with closing(sqlite3.connect(self.path)) as db:
            rows=db.execute('SELECT id,status,response FROM receipts WHERE delivered=0 LIMIT 10').fetchall()
        for id,status,response in rows:
            if status=='executing':status,response='interrupted',UNCERTAIN;self.record(id,status,response)
            await self.send(id,status,response)

    async def process(self,job):
        id,agent,text=job['id'],job['agentId'],job['text']
        uuid.UUID(id)
        if agent not in AGENTS or not isinstance(text,str) or not 1<=len(text)<=6000:raise ValueError('Invalid office command')
        prior=self.receipt(id)
        if prior:
            status,response,_=prior
            if status=='executing':status,response='interrupted',UNCERTAIN;self.record(id,status,response)
            await self.send(id,status,response)
            return
        b=self.bridge
        while len(b.pending)>=4:
            await asyncio.sleep(1)
        owner=hashlib.sha256(('lifesystem-office:personal:'+agent).encode()).hexdigest()
        key=hashlib.sha256((owner+'\0'+id).encode()).hexdigest()
        task=asyncio.current_task();b.pending[task]=owner
        accepted=False
        try:
            async with b.lock:
                if b.paused():
                    self.record(id,'failed','Hermes está pausado. Nenhum pedido foi executado.')
                else:
                    # Persist admission before inference. A process restart never replays this turn.
                    self.record(id,'executing',None)
                    await self.send(id,'running')
                    with b.router.connect() as db:
                        db.execute('INSERT INTO owners VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET agent=excluded.agent',(owner,agent))
                        db.execute('INSERT INTO receipts(key,owner,agent,status) VALUES (?,?,?,?) ON CONFLICT(key) DO NOTHING',(key,owner,agent,'running'))
                    self.office.accept(key,agent,'office');accepted=True
                    self.office.finish(key,'running')
                    try:
                        response=await b.worker(agent,owner+':0',text)
                        if not isinstance(response,str) or not response.strip():raise ValueError('Missing final reply')
                        response=bounded_reply(response)
                        status='completed'
                    except asyncio.CancelledError:
                        self.record(id,'interrupted',UNCERTAIN)
                        b.router.finish(key,'interrupted');self.office.finish(key,'interrupted');raise
                    except Exception:
                        status,response='failed','Não consegui concluir este atendimento. Confira os registros antes de repetir um pedido que alterava dados; não vou repetir automaticamente.'
                    self.record(id,status,response)
                    b.router.finish(key,status);self.office.finish(key,status)
            status,response,_=self.receipt(id)
            await self.send(id,status,response)
        finally:
            b.pending.pop(task,None)
            if accepted and self.receipt(id)[0]=='executing':
                b.router.finish(key,'interrupted');self.office.finish(key,'interrupted')

    async def run(self):
        while True:
            try:
                if self.office.session and len(self.bridge.pending)<4:
                    await self.flush_results()
                    reply=await asyncio.to_thread(self.office.request,'commands',{'op':'claim','sessionId':self.office.session})
                    if reply.get('job'):await self.process(reply['job'])
            except asyncio.CancelledError:raise
            except Exception:
                # No exception body: providers and transports may contain credentials.
                await asyncio.sleep(12)
            await asyncio.sleep(4)
