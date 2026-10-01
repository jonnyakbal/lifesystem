import json,tempfile,unittest,threading
from types import SimpleNamespace
from unittest.mock import patch
from pathlib import Path
from specialist_router.office import OfficePublisher

class OfficeTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.office=OfficePublisher(Path(self.tmp.name),url='https://example.invalid',token='x'*40)
 def test_outbox_contains_only_operational_fields(self):
  self.office.accept('run-1','vega','whatsapp');self.office.finish('run-1','running')
  events=self.office.pending_events();self.assertEqual(events[-1]['kind'],'run.started')
  self.assertEqual(self.office.snapshot()['runs'][0]['agentId'],'vega')
  self.assertNotIn('prompt',json.dumps(events));self.assertNotIn('owner',json.dumps(events))
  self.office.finish('run-1','undelivered');self.assertFalse(self.office.snapshot()['runs'])
 def test_restart_retains_terminal_history_but_clears_active_presence(self):
  self.office.accept('run-1','vega','whatsapp')
  self.office.finish('run-1','completed')
  self.office.accept('run-2','sirius','whatsapp')
  other=OfficePublisher(Path(self.tmp.name),url='https://example.invalid',token='x'*40)
  self.assertFalse(other.snapshot()['runs']);self.assertTrue(other.snapshot()['gap'])
  self.assertEqual([e['payload']['runId'] for e in other.pending_events()],['run-1'])
 def test_disabled_does_not_create_database(self):
  home=Path(self.tmp.name)/'disabled';p=OfficePublisher(home)
  p.accept('run','vega','whatsapp');self.assertFalse(home.exists())
 def test_sync_gateway_registration_publishes_without_an_asyncio_loop(self):
  published=threading.Event();cleanup=[]
  def request(path,body):
   if path=='events':published.set()
   return {'id':'session-sync'} if path=='sessions' else {'accepted':len(body)}
  def no_loop(coro,**kwargs):
   coro.close()
   raise RuntimeError('no running event loop')
  self.office.request=request
  with patch.dict('os.environ',{'_HERMES_GATEWAY':'1'}):
   try:self.office.start(SimpleNamespace(spawn_task=no_loop,on_unload=cleanup.append))
   except RuntimeError as error:self.fail('Synchronous gateway registration failed: '+str(error))
  self.assertTrue(published.wait(2),'Idle gateway did not publish presence')
  self.assertEqual(len(cleanup),1)
  cleanup[0]();self.office._thread.join(2)
  self.assertFalse(self.office._thread.is_alive(),'Plugin unload must stop publishing')
 def test_dashboard_and_worker_processes_never_start_a_competing_publisher(self):
  launched=[]
  def unexpected(coro,**kwargs):
   coro.close();launched.append('task')
  with patch.dict('os.environ',{'_HERMES_GATEWAY':'0'}):
   self.office.start(SimpleNamespace(spawn_task=unexpected,on_unload=lambda f:launched.append('cleanup')))
  self.assertFalse(launched)
 def test_s6_gateway_can_publish_before_gateway_module_sets_its_flag(self):
  published=threading.Event();cleanup=[]
  def request(path,body):
   if path=='events':published.set()
   return {'id':'s6-session'} if path=='sessions' else {'accepted':len(body)}
  self.office.request=request
  with patch.dict('os.environ',{'_HERMES_GATEWAY':'0','HERMES_S6_SUPERVISED_CHILD':'1'}),patch('sys.argv',['hermes','gateway','run','--replace']):
   self.office.start(SimpleNamespace(on_unload=cleanup.append))
  self.assertTrue(published.wait(2),'Supervised gateway registration must publish before module startup')
  cleanup[0]();self.office._thread.join(2)
  self.assertFalse(self.office._thread.is_alive())
 def test_failed_transport_preserves_events(self):
  self.office.accept('run-1','vega','whatsapp')
  def fail(*a):raise OSError('network')
  self.office.request=fail
  with self.assertRaises(OSError):self.office.flush()
  self.assertTrue(self.office.pending_events())
 def test_publication_registers_session_and_sends_valid_snapshot(self):
  sent=[]
  def request(path,body):
   sent.append((path,body));return {'id':'session-one'} if path=='sessions' else {'accepted':len(body)}
  self.office.request=request;self.office.accept('run-1','sirius','telegram');self.office.flush()
  self.assertEqual(sent[0][0],'sessions');self.assertEqual(sent[-1][1][0]['kind'],'snapshot')
  self.assertFalse(self.office.pending_events())
 def test_queue_limit_records_gap_without_unbounded_growth(self):
  for i in range(2010):self.office.enqueue('run.finished',{'runId':str(i)})
  self.assertLessEqual(self.office.queue_count(),2000);self.assertTrue(self.office.snapshot()['gap'])
 def test_reconnection_prioritizes_current_snapshot_over_old_backlog(self):
  self.office.accept('run-1','sirius','whatsapp');self.office.finish('run-1','running')
  self.office.enqueue('snapshot',self.office.snapshot())
  for i in range(80):self.office.enqueue('run.finished',{'runId':str(i)})
  self.office.finish('run-1','completed')
  sent=[]
  def request(path,body):
   if path=='sessions':return {'id':'new-session'}
   sent.extend(body);return {'accepted':len(body)}
  self.office.request=request;self.office.flush()
  self.assertEqual(sent[0]['kind'],'snapshot');self.assertFalse(sent[0]['payload']['runs'])
  self.assertEqual(sum(e['kind']=='snapshot' for e in sent),1)
