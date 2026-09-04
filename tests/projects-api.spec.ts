import { test, expect } from '@playwright/test';

test.describe('Projects API', () => {
  let createdProjectId: string;

  test('GET /api/projects returns array', async ({ request }) => {
    const response = await request.get('/api/projects');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('POST /api/projects creates project', async ({ request }) => {
    const response = await request.post('/api/projects', {
      data: {
        name: 'Test Project',
        description: 'Test project description',
        status: 'active',
        tags: ['test', 'api'],
        needs: 'Testing needs',
        links: [{ label: 'GitHub', url: 'https://github.com' }],
      },
    });
    expect(response.status()).toBe(201);
    const project = await response.json();
    expect(project.id).toBeTruthy();
    expect(project.name).toBe('Test Project');
    expect(project.status).toBe('active');
    expect(project.tasksCount).toBe(0);
    expect(project.tasksDone).toBe(0);
    createdProjectId = project.id;
  });

  test('PATCH /api/projects/[id] updates project', async ({ request }) => {
    const response = await request.patch(`/api/projects/${createdProjectId}`, {
      data: { name: 'Updated Project', status: 'development' },
    });
    expect(response.ok()).toBeTruthy();
    const project = await response.json();
    expect(project.name).toBe('Updated Project');
    expect(project.status).toBe('development');
  });

  test('DELETE /api/projects/[id] deletes project', async ({ request }) => {
    const response = await request.delete(`/api/projects/${createdProjectId}`);
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.success).toBeTruthy();
  });

  test('DELETE /api/projects/[id] returns 404 for deleted project', async ({ request }) => {
    const response = await request.delete(`/api/projects/${createdProjectId}`);
    expect(response.status()).toBe(404);
  });
});
