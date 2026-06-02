import { test, expect } from '@playwright/test';
import { HermesUiHelper } from '../helpers/uiHelper';
import { HermesApiHelper } from '../helpers/apiHelper';
import * as fs from 'fs';
import * as path from 'path';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH || 'data/db.json');
  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath);
      console.log('Successfully reset database to clean seed state in beforeAll.');
    } catch (e) {
      console.error('Error deleting db.json in beforeAll:', e);
    }
  }
});

test.describe('Tier 5: Adversarial Input Validation & Security Audits (Mocked UI / Client Validation)', () => {
  // test.beforeEach(async ({ page }) => {
  //   setupMockRouter(page);
  // });

  test('T5-E1: UI validation prevents submission of blank titles in lateral task drawer', async ({ page }) => {
    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();
    const uiHelper = new HermesUiHelper(page);

    // Open task drawer
    await uiHelper.clickTaskCard('t1');

    // Wait for the asynchronous fetch to populate the drawer input to avoid race conditions
    await expect(page.locator('[data-testid="task-title-input"]')).toHaveValue('Verificar cadena de suministro');

    // Fill title with whitespace
    await page.fill('[data-testid="task-title-input"]', '    ');
    
    // Intercept window.alert or alert dialogs to assert title validation rejection
    let alertMessage = '';
    page.on('dialog', async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await page.click('[data-testid="save-task-btn"]');
    expect(alertMessage).toBe('Title is mandatory');
  });

  test('T5-E2: UI attachment validation rejects unsupported file types (.exe)', async ({ page }) => {
    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('t1');

    // Upload an unsupported executable
    const fileInput = page.locator('[data-testid="attachment-file-input"]');
    await fileInput.setInputFiles({
      name: 'malware.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('MZ...')
    });

    const progress = page.locator('[data-testid="upload-progress"]');
    await expect(progress).toBeVisible();
    await expect(progress).toHaveText('Error: File type not supported');
  });

  test('T5-E3: UI attachment validation rejects files exceeding 10MB limit', async ({ page }) => {
    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('t1');

    // Upload an oversized file (11MB)
    const fileInput = page.locator('[data-testid="attachment-file-input"]');
    await fileInput.setInputFiles({
      name: 'large_payload.zip',
      mimeType: 'application/zip',
      buffer: Buffer.alloc(11 * 1024 * 1024)
    });

    const progress = page.locator('[data-testid="upload-progress"]');
    await expect(progress).toBeVisible();
    await expect(progress).toHaveText('Error: File exceeds maximum allowed size (10MB)');
  });
});

test.describe('Tier 5: Adversarial API & Database Validation Audits (Direct Server / API Rejection tests)', () => {
  // These tests perform real REST API calls to the Next.js server to verify the actual backend implementation.
  // We want to verify if the backend properly rejects invalid or unauthorized requests.
  
  test('T5-API-1: PUT /api/tasks/[id] accepts empty/whitespace title, exposing Title Bypass Vulnerability', async ({ request }) => {
    const apiHelper = new HermesApiHelper(request, 'hermes-master-secret-key');
    
    // Attempt to update task title to an empty string via PUT
    const response = await apiHelper.updateTask('t1', {
      title: '   '
    });

    // EXPECTATION: Backend should reject empty title with 400 Bad Request
    // ACTUAL CODE BEHAVIOR: Accepts the blank title and returns 200 OK!
    const status = response.status();
    const body = await response.json();

    console.log(`[T5-API-1] Status: ${status}, Body:`, body);
    
    // We assert both the current actual behavior (exposing the bug) and document it.
    // If the server is not running, we catch the fetch failure gracefully.
    expect(status).toBe(400);
  });

  test('T5-API-2: PUT /api/tasks/[id] with invalid field values corrupts the DB with undefined properties', async ({ request }) => {
    const apiHelper = new HermesApiHelper(request, 'hermes-master-secret-key');
    
    // Attempt to update status/priority/type/origin to invalid values
    const response = await apiHelper.updateTask('t1', {
      status: 'invalid-status-value' as any,
      priority: 'invalid-priority-value' as any,
      type: 'invalid-type-value' as any,
      origin: 'invalid-origin-value' as any
    });

    const status = response.status();
    const body = await response.json();

    console.log(`[T5-API-2] Status: ${status}, Body:`, body);

    expect(status).toBe(400);
  });

  test('T5-API-3: POST /api/settings allows unauthorized access, exposing Security Authorization Bypass', async ({ request }) => {
    // Attempt to read/write SMTP settings without x-api-key header
    const response = await request.post('/api/settings', {
      data: {
        host: 'smtp.malicious-hacker.com',
        port: 25
      }
    });

    const status = response.status();
    const body = await response.json();

    console.log(`[T5-API-3] Status: ${status}, Body:`, body);

    // EXPECTATION: Should be rejected with 401 Unauthorized since x-api-key is missing
    // ACTUAL CODE BEHAVIOR: Returns 200/201 OK and successfully updates the SMTP settings globally!
    expect(status).toBe(401);
  });

  test('T5-API-4: GET /data/attachments/[filename] allows unauthenticated downloads, exposing Attachment Security Bypass', async ({ request }) => {
    // Attempt to download seeded attachments or a target file without providing x-api-key
    const response = await request.get('/data/attachments/design.pdf');
    const status = response.status();

    console.log(`[T5-API-4] Status: ${status}`);

    // EXPECTATION: Private attachments should require authentication (401)
    // ACTUAL CODE BEHAVIOR: Serves the file (200 OK or 404 if not exists, but NO 401 Unauthorized rejection!)
    expect(status).toBe(401);
  });

  test('T5-API-5: POST /api/attachments has missing server-side size/type validation, allowing malicious files', async ({ request }) => {
    // In order to perform E2E multipart file upload testing
    // We send a mock request with taskId, file name as virus.exe
    const response = await request.post('/api/attachments', {
      headers: {
        'x-api-key': 'hermes-master-secret-key'
      },
      multipart: {
        taskId: 't1',
        file: {
          name: 'malware.exe',
          mimeType: 'application/x-msdownload',
          buffer: Buffer.from('EXE_PAYLOAD')
        }
      }
    });

    const status = response.status();
    const body = await response.json();

    console.log(`[T5-API-5] Status: ${status}, Body:`, body);

    // EXPECTATION: Backend should reject dangerous file extensions
    // ACTUAL CODE BEHAVIOR: Returns 201 Created and saves the executable in target directory!
    expect(status).toBe(400);
  });
});
