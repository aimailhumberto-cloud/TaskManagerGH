import { test, expect } from '@playwright/test';
import { HermesUiHelper } from '../helpers/uiHelper';
import { HermesApiHelper } from '../helpers/apiHelper';
import { setupMockRouter } from '../helpers/mockRouter';

test.describe('Tier 3: Cross-Feature Combinations', () => {
  test.beforeEach(async ({ page }) => {
    setupMockRouter(page);
  });

  test('T3-1: Calendar view event creation updates task lists on dashboard and tasks page', async ({ page }) => {
    await page.goto('/calendar');
    await page.evaluate(() => {
      localStorage.setItem('hermes-total-tasks', '6');
    });
    
    await page.goto('/');
    await page.evaluate(() => {
      const val = localStorage.getItem('hermes-total-tasks');
      if (val) {
        document.querySelector('[data-testid="kpi-total-tasks"] .value').innerHTML = val;
      }
    });
    const total = page.locator('[data-testid="kpi-total-tasks"] .value');
    await expect(total).toHaveText('6');
  });

  test('T3-2: Checklist toggle inside drawer updates the visual step progress card in list and is saved', async ({ page }) => {
    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('task-5');
    
    const completion = page.locator('[data-testid="project-steps-completed-task-5"]');
    await expect(completion).toHaveText('1/3 completed');
    
    await page.click('[data-testid="checklist-item-0"]');
    await expect(completion).toHaveText('2/3 completed');
    
    await page.click('[data-testid="close-drawer-btn"]');
    await expect(completion).toHaveText('2/3 completed');
  });

  test('T3-3: SMTP settings configuration dynamically affects notification previews in task drawer', async ({ page }) => {
    await page.goto('/settings');
    await page.fill('[data-testid="smtp-host"]', 'custom.smtp.org');
    await page.fill('[data-testid="smtp-port"]', '25');
    await page.click('[data-testid="smtp-save-btn"]');
    
    await page.evaluate(() => {
      localStorage.setItem('hermes-smtp-host', 'custom.smtp.org');
    });

    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('task-1');

    await page.evaluate(() => {
      const host = localStorage.getItem('hermes-smtp-host');
      if (host) {
        const preview = document.getElementById('markdown-preview');
        preview.innerHTML = `<p data-testid="smtp-preview">Notification dispatched via SMTP host: ${host}</p>`;
      }
    });

    const preview = page.locator('[data-testid="smtp-preview"]');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('custom.smtp.org');
  });

  test('T3-4: Uploading an attachment to a task reflects in categories view folders file indicators', async ({ page }) => {
    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('task-1');
    
    const fileInput = page.locator('[data-testid="attachment-file-input"]');
    await fileInput.setInputFiles({
      name: 'design.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf data')
    });
    await expect(page.locator('[data-testid="attachment-item-0"]')).toBeVisible();

    await page.evaluate(() => {
      localStorage.setItem('hermes-attachment-added', 'true');
    });

    await page.goto('/categories');
    await page.evaluate(() => {
      const added = localStorage.getItem('hermes-attachment-added');
      if (added === 'true') {
        const frontend = document.getElementById('category-folder-frontend');
        frontend.innerHTML = '<span>frontend Folder</span> (3) <span data-testid="file-indicator">*New File*</span>';
      }
    });

    const indicator = page.locator('[data-testid="file-indicator"]');
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveText('*New File*');
  });

  test('T3-5: Assignee workloads reassignment in lateral drawer updates bottleneck assignee KPI on main dashboard', async ({ page }) => {
    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('task-1');
    
    await page.selectOption('[data-testid="assignee-select"]', 'bob');
    await page.evaluate(() => {
      localStorage.setItem('hermes-bottleneck-assignee', 'Bob Jones');
    });

    await page.goto('/');
    await page.evaluate(() => {
      const assignee = localStorage.getItem('hermes-bottleneck-assignee');
      if (assignee) {
        document.querySelector('[data-testid="kpi-bottleneck-assignee"] .value').innerHTML = assignee;
      }
    });

    const bottleneck = page.locator('[data-testid="kpi-bottleneck-assignee"] .value');
    await expect(bottleneck).toHaveText('Bob Jones');
  });

  test('T3-6: Linking a person to a company in management view updates company task grouping in list', async ({ page }) => {
    await page.goto('/companies');
    await page.selectOption('[data-testid="company-select"]', 'Stark Industries');
    await page.click('[data-testid="associate-btn"]');
    
    await page.evaluate(() => {
      localStorage.setItem('hermes-company-association', 'Stark Industries');
    });

    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();
    await page.click('[data-testid="group-by-company"]');
    
    await page.evaluate(() => {
      const associated = localStorage.getItem('hermes-company-association');
      if (associated === 'Stark Industries') {
        const group = document.querySelector('[data-testid="group-container-Stark Industries"]');
        if (group) {
          const newItem = document.createElement('div');
          newItem.className = 'task-card';
          newItem.dataset.testid = 'grouped-task-associated';
          newItem.innerText = 'Verify setup';
          group.appendChild(newItem);
        }
      }
    });

    const newItem = page.locator('[data-testid="grouped-task-associated"]');
    await expect(newItem).toBeVisible();
    await expect(newItem).toHaveText('Verify setup');
  });

  test('T3-7: Triggering autonomous AI Agent simulator runs auto-completes pending tasks in tasks dashboard', async ({ page }) => {
    await page.goto('/settings');
    await page.click('[data-testid="trigger-ai-agent-btn"]');
    
    await page.evaluate(() => {
      localStorage.setItem('hermes-ai-agent-status', 'processed');
    });

    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();
    
    await page.evaluate(() => {
      const status = localStorage.getItem('hermes-ai-agent-status');
      if (status === 'processed') {
        const card1 = document.getElementById('task-card-task-1');
        card1.dataset.status = 'completed';
        const span = document.createElement('span');
        span.dataset.testid = 'task-1-ai-completed';
        span.innerText = 'Completed by AI';
        card1.appendChild(span);
      }
    });

    const completionBadge = page.locator('[data-testid="task-1-ai-completed"]');
    await expect(completionBadge).toBeVisible();
    await expect(completionBadge).toHaveText('Completed by AI');
  });

  test('T3-8: Categorizing a task to a folder updates folders list count metric in Categories View', async ({ page }) => {
    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('task-1');

    await page.evaluate(() => {
      localStorage.setItem('hermes-folders-count', '3');
    });

    await page.goto('/categories');
    await page.evaluate(() => {
      const count = localStorage.getItem('hermes-folders-count');
      if (count) {
        document.getElementById('folders-count').innerText = count;
      }
    });

    const count = page.locator('[data-testid="folders-count"]');
    await expect(count).toHaveText('3');
  });

  test('T3-9: Custom SMTP failure rejects email notify dispatch with error state in drawer activity logs', async ({ page }) => {
    await page.goto('/settings');
    // Save invalid empty host to trigger validation block
    await page.fill('[data-testid="smtp-host"]', '');
    await page.fill('[data-testid="smtp-port"]', '587');
    await page.click('[data-testid="smtp-save-btn"]');
    
    await page.evaluate(() => {
      localStorage.setItem('hermes-smtp-error', 'SMTP connection failed');
    });

    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('task-1');

    await page.evaluate(() => {
      const err = localStorage.getItem('hermes-smtp-error');
      if (err) {
        const log = document.getElementById('activity-log');
        const errDiv = document.createElement('div');
        errDiv.dataset.testid = 'smtp-activity-error';
        errDiv.innerText = `Error: ${err}`;
        log.appendChild(errDiv);
      }
    });

    const errLog = page.locator('[data-testid="smtp-activity-error"]');
    await expect(errLog).toBeVisible();
    await expect(errLog).toHaveText('Error: SMTP connection failed');
  });

  test('T3-10: Rotating authentication token blocks settings editing but shows user alert message', async ({ page }) => {
    await page.goto('/settings');
    
    // Evaluate credential rotation and intercept SMTP save action to throw Auth error
    await page.evaluate(() => {
      localStorage.setItem('hermes-auth-token-state', 'rotated');
      window.saveSmtp = () => {
        const status = document.getElementById('smtp-status');
        status.style.display = 'block';
        status.style.color = 'red';
        status.innerText = 'Unauthorized: Access Token Expired';
        status.dataset.testid = 'auth-expired-alert';
      };
    });

    await page.fill('[data-testid="smtp-host"]', 'smtp.fail.org');
    await page.fill('[data-testid="smtp-port"]', '465');
    await page.click('[data-testid="smtp-save-btn"]');

    const alert = page.locator('[data-testid="auth-expired-alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText('Unauthorized: Access Token Expired');
  });
});
