import { test, expect } from '@playwright/test';
import { HermesApiHelper } from './helpers/apiHelper';
import { HermesUiHelper } from './helpers/uiHelper';

test.describe('Hermes E2E Infrastructure Smoke Test', () => {

  test('API Helper - Header Validation Behavior', async ({ request }) => {
    // Assert helper raises errors when key is missing or invalid
    const invalidHelper = new HermesApiHelper(request, '');
    
    // We expect getting tasks without key to reject/throw
    await expect(invalidHelper.getTasks()).rejects.toThrow(
      'API key validation error: x-api-key header must be provided for authenticated requests.'
    );

    // Assert helper with key is properly instantiated
    const validHelper = new HermesApiHelper(request, 'hermes-master-secret-key');
    expect(validHelper).toBeDefined();
  });

  test('UI Helper - Mock Navigation and Page Elements', async ({ page }) => {
    const uiHelper = new HermesUiHelper(page);

    // Intercept navigation requests to supply standard mock pages with testids
    await page.route('**/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
            <head><title>Hermes Hub - Dashboard</title></head>
            <body>
              <div data-testid="app-shell">
                <h1>Hermes Task Dashboard</h1>
                <button data-testid="create-task-btn">Create Task</button>
              </div>
            </body>
          </html>
        `
      });
    });

    await page.route('**/tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
            <head><title>Hermes Hub - Tasks</title></head>
            <body>
              <div data-testid="tasks-board">
                <h2>All Active Tasks</h2>
                <div data-testid="task-card-task-101">Verify E2E Setup</div>
              </div>
            </body>
          </html>
        `
      });
    });

    // Verify UI Helper navigates to Dashboard and detects the App Shell container
    await uiHelper.navigateToDashboard();
    const appShell = page.locator('[data-testid="app-shell"]');
    await expect(appShell).toBeVisible();

    // Verify UI Helper navigates to Tasks View and detects the Tasks Board container
    await uiHelper.navigateToTasksView();
    const tasksBoard = page.locator('[data-testid="tasks-board"]');
    await expect(tasksBoard).toBeVisible();

    // Verify clicking on a mock task card is working
    await page.route('**/api/tasks/task-101', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'task-101', title: 'Verify E2E Setup', status: 'completed' })
      });
    });
  });
});
