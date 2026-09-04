import { test, expect } from '@playwright/test';

test.describe('Captures API', () => {
  let createdCaptureId: string;

  test('GET /api/captures returns array', async ({ request }) => {
    const response = await request.get('/api/captures');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('POST /api/captures creates capture', async ({ request }) => {
    const response = await request.post('/api/captures', {
      data: {
        content: 'Test capture content',
        type: 'text',
        title: 'Test Capture',
        status: 'inbox',
      },
    });
    expect(response.status()).toBe(201);
    const capture = await response.json();
    expect(capture.id).toBeTruthy();
    expect(capture.content).toBe('Test capture content');
    expect(capture.createdAt).toBeTruthy();
    createdCaptureId = capture.id;
  });

  test('PATCH /api/captures/[id] updates capture', async ({ request }) => {
    const response = await request.patch(`/api/captures/${createdCaptureId}`, {
      data: { status: 'classified', title: 'Updated Capture' },
    });
    expect(response.ok()).toBeTruthy();
    const capture = await response.json();
    expect(capture.title).toBe('Updated Capture');
    expect(capture.status).toBe('classified');
  });

  test('DELETE /api/captures/[id] deletes capture', async ({ request }) => {
    const response = await request.delete(`/api/captures/${createdCaptureId}`);
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.success).toBeTruthy();
  });

  test('DELETE /api/captures/[id] returns 404 for deleted capture', async ({ request }) => {
    const response = await request.delete(`/api/captures/${createdCaptureId}`);
    expect(response.status()).toBe(404);
  });
});
