import asyncio
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace as NS
from specialist_router.bridge import Bridge

class BridgeTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.sent, self.calls, self.tasks = [], [], []
        def spawn(coro, **kwargs):
            task = asyncio.create_task(coro)
            self.tasks.append(task)
            return task
        async def send(**kwargs):
            self.sent.append(kwargs['content'])
            return NS(success=True)
        async def worker(agent, owner, text):
            self.calls.append((agent, text))
            await asyncio.sleep(.01)
            return 'Resposta de teste'
        self.gateway = NS(_is_user_authorized_for_source=lambda s: True,
                          _adapter_for_source=lambda s: NS(send=send))
        self.bridge = Bridge(NS(spawn_task=spawn), Path(self.temp.name), worker=worker, paused=lambda: None)

    def event(self, text, mid='1'):
        return NS(text=text, message_id=mid, internal=False, media_urls=[], prompt_response=None,
                  message_type=NS(value='text'), reply_to_text=None,
                  source=NS(platform=NS(value='whatsapp'), chat_id='self', user_id='owner',
                            thread_id=None, chat_type='dm', is_bot=False, profile_route_rejected=False))

    async def drain(self):
        await asyncio.gather(*self.tasks, return_exceptions=True)

    async def test_auth_before_any_intercept(self):
        self.gateway._is_user_authorized_for_source=lambda s: False
        self.assertIsNone(self.bridge.hook(event=self.event('Vega, contas'), gateway=self.gateway))
        await self.drain()
        self.assertFalse(self.calls)
        self.assertFalse(self.sent)

    async def test_queue_pins_identity_and_deduplicates(self):
        self.bridge.hook(event=self.event('Vega, contas'), gateway=self.gateway)
        self.bridge.hook(event=self.event('Sirius, projetos', '2'), gateway=self.gateway)
        self.bridge.hook(event=self.event('Vega, contas'), gateway=self.gateway)
        await self.drain()
        self.assertEqual([a for a,t in self.calls], ['vega', 'sirius'])
        self.assertEqual(len(self.sent), 2)
        self.assertIn('Vega', self.sent[0])
        self.assertIn('Sirius', self.sent[1])

    async def test_pause_prevents_execution(self):
        self.bridge.paused=lambda: 'Pausado'
        self.bridge.hook(event=self.event('Vega, contas'), gateway=self.gateway)
        await self.drain()
        self.assertFalse(self.calls)

    async def test_media_never_silently_becomes_text_only_request(self):
        event=self.event('Vega, lance esta nota')
        event.media_urls=['private.jpg']
        self.bridge.hook(event=event, gateway=self.gateway)
        await self.drain()
        self.assertFalse(self.calls)
        self.assertIn('texto', self.sent[0])

    async def test_failed_worker_does_not_leak_exception_secrets(self):
        async def broken(*a): raise RuntimeError('secret-key-123')
        self.bridge.worker=broken
        self.bridge.hook(event=self.event('Vega, contas'), gateway=self.gateway)
        await self.drain()
        self.assertNotIn('secret-key', ''.join(self.sent))
        self.assertIn('não vou repetir', ''.join(self.sent))

    async def test_stop_cancels_current_and_queued_work(self):
        entered=asyncio.Event()
        cancelled=asyncio.Event()
        async def slow(*args):
            entered.set()
            try: await asyncio.sleep(60)
            finally: cancelled.set()
        self.bridge.worker=slow
        self.bridge.hook(event=self.event('Vega, contas'), gateway=self.gateway)
        await entered.wait()
        self.bridge.hook(event=self.event('Sirius, projetos', '2'), gateway=self.gateway)
        self.assertIsNone(self.bridge.hook(event=self.event('/stop', '3'), gateway=self.gateway))
        await self.drain()
        self.assertTrue(cancelled.is_set())
        self.assertFalse(any('Resposta de teste' in msg for msg in self.sent))

    async def test_stop_without_specialist_passes_to_native_gateway(self):
        self.assertIsNone(self.bridge.hook(event=self.event('/stop'), gateway=self.gateway))
        self.assertFalse(self.tasks)

    async def test_transport_exception_after_worker_is_undelivered_not_failed(self):
        async def broken_send(**kwargs):
            raise TimeoutError('transport timeout')
        self.gateway._adapter_for_source=lambda source: NS(send=broken_send)
        finishes=[]
        original=self.bridge.finish
        def finish(key,status):
            finishes.append(status)
            return original(key,status)
        self.bridge.finish=finish
        self.bridge.hook(event=self.event('Vega, ver contas'),gateway=self.gateway)
        await self.drain()
        self.assertEqual(len(self.calls),1)
        self.assertEqual(finishes[-1],'undelivered')
