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
