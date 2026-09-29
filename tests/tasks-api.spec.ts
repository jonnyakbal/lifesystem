import { test, expect } from '@playwright/test';

test.describe('Tasks API', () => {
  let createdTaskId: string;

  test('GET /api/tasks returns array', async ({ request }) => {
    const response = await request.get('/api/tasks');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('POST /api/tasks creates single task', async ({ request }) => {
    const response = await request.post('/api/tasks', {
      data: {
        title: 'Test Task',
        description: 'Test description',
        priority: 'normal',
        status: 'todo',
        tags: ['test'],
        checklist: [],
        sortOrder: 0,
      },
    });
    expect(response.status()).toBe(201);
    const task = await response.json();
    expect(task.id).toBeTruthy();
    expect(task.title).toBe('Test Task');
    expect(task.createdAt).toBeTruthy();
    createdTaskId = task.id;
  });

  test('POST /api/tasks creates batch tasks', async ({ request }) => {
    const response = await request.post('/api/tasks', {
      data: [
        { title: 'Batch Task 1', priority: 'normal', status: 'todo', tags: [], checklist: [], sortOrder: 0 },
        { title: 'Batch Task 2', priority: 'urgent', status: 'todo', tags: [], checklist: [], sortOrder: 1 },
      ],
    });
    expect(response.status()).toBe(201);
    const tasks = await response.json();
    expect(Array.isArray(tasks)).toBeTruthy();
    expect(tasks.length).toBe(2);
    await Promise.all(tasks.map((task: { id: string }) => request.delete(`/api/tasks/${task.id}`)));
  });

  test('GET /api/tasks/[id] returns task', async ({ request }) => {
    const response = await request.get(`/api/tasks/${createdTaskId}`);
    expect(response.ok()).toBeTruthy();
    const task = await response.json();
    expect(task.id).toBe(createdTaskId);
    expect(task.title).toBe('Test Task');
  });

  test('PATCH /api/tasks/[id] updates task', async ({ request }) => {
    const response = await request.patch(`/api/tasks/${createdTaskId}`, {
      data: { title: 'Updated Task', status: 'doing' },
    });
    expect(response.ok()).toBeTruthy();
    const task = await response.json();
    expect(task.title).toBe('Updated Task');
    expect(task.status).toBe('doing');
  });

  test('PATCH /api/tasks/[id] accepts a configured custom stage', async ({ request }) => {
    const response = await request.patch(`/api/tasks/${createdTaskId}`, {
      data: { status: 'prioritized' },
    });
    expect(response.ok()).toBeTruthy();
    const task = await response.json();
    expect(task.status).toBe('prioritized');
  });

  test('PATCH /api/tasks/[id] can return a scheduled task to planning', async ({ request }) => {
    const scheduled = await request.patch(`/api/tasks/${createdTaskId}`, {
      data: { dueDate: '2026-09-15' },
    });
    expect(scheduled.ok()).toBeTruthy();
    expect((await scheduled.json()).dueDate).toBe('2026-09-15');

    const unscheduled = await request.patch(`/api/tasks/${createdTaskId}`, {
      data: { dueDate: null },
    });
    expect(unscheduled.ok()).toBeTruthy();
    expect((await unscheduled.json()).dueDate).toBeUndefined();
  });

  test('editar o prazo mantém o dia planejado alinhado e protege blocos com horário', async ({ request }) => {
    const created = await (await request.post('/api/tasks', { data: { title: 'Prazo único', dueDate: '2026-09-26' } })).json();
    try {
      expect((await request.put(`/api/tasks/${created.id}/planning`, { data: {
        date: '2026-09-29', timeZone: 'America/Sao_Paulo', syncToGoogle: false,
      } })).ok()).toBe(true);
      const moved = await request.patch(`/api/tasks/${created.id}`, { data: { dueDate: '2026-09-30' } });
      expect(moved.ok()).toBe(true);
      expect((await moved.json()).planning.date).toBe('2026-09-30');

      expect((await request.put(`/api/tasks/${created.id}/planning`, { data: {
        date: '2026-09-30', startAt: '2026-09-30T14:00:00.000Z', endAt: '2026-09-30T14:30:00.000Z', timeZone: 'America/Sao_Paulo', syncToGoogle: false,
      } })).ok()).toBe(true);
      const blocked = await request.patch(`/api/tasks/${created.id}`, { data: { dueDate: '2026-10-01' } });
      expect(blocked.status()).toBe(409);
      const unchanged = await (await request.get(`/api/tasks/${created.id}`)).json();
      expect(unchanged.dueDate).toBe('2026-09-30');
    } finally {
      await request.delete(`/api/tasks/${created.id}/planning`, { data: {} });
      await request.delete(`/api/tasks/${created.id}`);
    }
  });

  test('DELETE /api/tasks/[id] deletes task', async ({ request }) => {
    const response = await request.delete(`/api/tasks/${createdTaskId}`);
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.success).toBeTruthy();
  });

  test('GET /api/tasks/[id] returns 404 for deleted task', async ({ request }) => {
    const response = await request.get(`/api/tasks/${createdTaskId}`);
    expect(response.status()).toBe(404);
  });
});
