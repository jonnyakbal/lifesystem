import asyncio, tempfile, unittest, uuid
from pathlib import Path
from types import SimpleNamespace as NS
from specialist_router.office import OfficePublisher
from specialist_router.office_commands import OfficeCommands
from specialist_router.core import Router

class CommandsTests(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
  self.office=OfficePublisher(Path(self.temp.name),url='https://example.invalid',token='x'*40)
  self.office.session='session-test';self.results=[];self.calls=[]
  self.job={'id':str(uuid.uuid4()),'agentId':'sirius','text':'Leia meus projetos.','status':'claimed'}
  def request(path,body):
   if body['op']=='claim':return {'job':self.job}
   self.results.append(body);return {'job':dict(self.job,status=body['status'])}
  self.office.request=request
  async def worker(agent,owner,text):self.calls.append((agent,owner,text));return 'Resposta real persistida.'
  self.bridge=NS(office=self.office,router=Router(Path(self.temp.name)/'router.sqlite'),lock=asyncio.Lock(),pending={},paused=lambda:False,worker=worker)
  self.consumer=OfficeCommands(self.bridge)
 async def test_duplicate_delivery_does_not_repeat_worker_and_keeps_identity(self):
  await self.consumer.process(self.job);await self.consumer.process(self.job)
  self.assertEqual(len(self.calls),1);self.assertEqual(self.calls[0][0],'sirius')
  self.assertEqual(self.results[-1]['status'],'completed')
 async def test_failed_result_delivery_retries_receipt_only(self):
  original=self.office.request
  def broken(path,body):
   if body['op']=='result' and body['status']=='completed':raise OSError('offline')
   return original(path,body)
  self.office.request=broken
  with self.assertRaises(OSError):await self.consumer.process(self.job)
  self.office.request=original;await self.consumer.process(self.job)
  self.assertEqual(len(self.calls),1);self.assertEqual(self.results[-1]['status'],'completed')
 async def test_crash_after_start_never_reexecutes_uncertain_job(self):
  self.consumer.record(self.job['id'],'executing',None)
  await self.consumer.process(self.job)
  self.assertFalse(self.calls);self.assertEqual(self.results[-1]['status'],'interrupted')
 async def test_pause_prevents_execution_and_invalid_profile_never_runs(self):
  self.bridge.paused=lambda:True
  await self.consumer.process(self.job);self.assertFalse(self.calls)
  with self.assertRaises(ValueError):await self.consumer.process(dict(self.job,agentId='tunm'))
 async def test_channel_lock_is_shared(self):
  await self.bridge.lock.acquire()
  task=asyncio.create_task(self.consumer.process(self.job))
  await asyncio.sleep(.03);self.assertFalse(self.calls)
  self.bridge.lock.release();await task;self.assertEqual(len(self.calls),1)
 async def test_completed_receipt_is_recovered_after_publisher_restart(self):
  self.consumer.record(self.job['id'],'completed','Resposta persistida.')
  self.office.session='new-session'
  await self.consumer.flush_results()
  self.assertFalse(self.calls)
  self.assertEqual(self.results[-1]['receiptSession'],'session-test')
  self.assertEqual(self.results[-1]['response'],'Resposta persistida.')
 async def test_unicode_reply_respects_transport_bytes_and_browser_units(self):
  async def worker(*args):return '漢字😀'*10000
  self.bridge.worker=worker;await self.consumer.process(self.job)
  import json
  reply=self.results[-1]['response']
  self.assertLessEqual(len(reply.encode('utf-16-le'))//2,24000)
  self.assertLess(len(json.dumps(self.results[-1],ensure_ascii=False).encode()),65000)
