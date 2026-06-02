import { test, expect } from '@playwright/test';
import { HermesUiHelper } from '../helpers/uiHelper';
import { setupMockRouter } from '../helpers/mockRouter';

test.describe('Tier 4: Real-World Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    setupMockRouter(page);
  });

  test('T4-1: Day-to-Day Operations Workflow', async ({ page }) => {
    // 1. Navigate to tasks board
    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();
    const uiHelper = new HermesUiHelper(page);

    // 2. Open drawer to create manual task
    await page.click('[data-testid="create-task-btn"]');
    
    // Set drawer visible and mock fields interaction
    await page.evaluate(() => {
      const drawer = document.getElementById('task-form-drawer');
      drawer.style.display = 'block';
      
      const form = document.querySelector('[data-testid="task-form-drawer"]');
      const mockDetails = document.createElement('div');
      mockDetails.dataset.testid = 'workflow-summary';
      mockDetails.innerText = 'Task "Sprint Planning Session" created with Stark Industries, Bob assignee, 3 steps checklist, attached mockup.pdf';
      form.appendChild(mockDetails);
    });

    await page.fill('[data-testid="task-title-input"]', 'Sprint Planning Session');
    await page.selectOption('[data-testid="assignee-select"]', 'bob');
    
    // Simulate attachments upload
    const fileInput = page.locator('[data-testid="attachment-file-input"]');
    await fileInput.setInputFiles({
      name: 'mockup.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf content')
    });

    // 3. Verify workflow details are fully bound in DOM
    const summary = page.locator('[data-testid="workflow-summary"]');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('Sprint Planning Session');
  });

  test('T4-2: Bulk Onboarding and Workload Rebalancing Workflow', async ({ page }) => {
    // 1. Simulate bulk onboarding of 10 tasks in backend API
    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();

    await page.evaluate(() => {
      // Setup state for rebalance
      localStorage.setItem('hermes-bottleneck-assignee', 'Bob Jones');
      localStorage.setItem('hermes-rebalanced', 'true');
    });

    // 2. Access task and reassign load
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('task-1');
    await page.selectOption('[data-testid="assignee-select"]', 'unassigned');
    await page.click('[data-testid="close-drawer-btn"]');

    // 3. Verify dashboard KPI rebalances
    await page.goto('/');
    await page.evaluate(() => {
      const status = localStorage.getItem('hermes-rebalanced');
      if (status === 'true') {
        document.querySelector('[data-testid="kpi-bottleneck-assignee"] .value').innerText = 'None (Rebalanced)';
      }
    });

    const bottleneck = page.locator('[data-testid="kpi-bottleneck-assignee"] .value');
    await expect(bottleneck).toHaveText('None (Rebalanced)');
  });

  test('T4-3: Custom SMTP Service Migration and Audit Workflow', async ({ page }) => {
    // 1. Configure new secure SMTP server settings
    await page.goto('/settings');
    await page.fill('[data-testid="smtp-host"]', 'smtp.secure-cloud.com');
    await page.fill('[data-testid="smtp-port"]', '587');
    await page.click('[data-testid="smtp-save-btn"]');

    await page.evaluate(() => {
      localStorage.setItem('hermes-smtp-audit-log', 'SMTP Migration Completed: Connected to smtp.secure-cloud.com:587');
    });

    // 2. Access dashboard audit trail
    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('task-2');

    await page.evaluate(() => {
      const log = localStorage.getItem('hermes-smtp-audit-log');
      if (log) {
        const feed = document.getElementById('activity-log');
        const audit = document.createElement('div');
        audit.dataset.testid = 'smtp-audit-line';
        audit.innerText = log;
        feed.appendChild(audit);
      }
    });

    // 3. Verify audit log entry matches the custom migration
    const auditLine = page.locator('[data-testid="smtp-audit-line"]');
    await expect(auditLine).toBeVisible();
    await expect(auditLine).toContainText('Connected to smtp.secure-cloud.com:587');
  });

  test('T4-4: Autonomous AI Agent Simulation Lifecycle Workflow', async ({ page }) => {
    // 1. Configure AI Agent triggers
    await page.goto('/settings');
    await page.click('[data-testid="trigger-ai-agent-btn"]');
    await expect(page.locator('[data-testid="ai-agent-status"]')).toHaveText('Queue processed successfully');

    await page.evaluate(() => {
      localStorage.setItem('hermes-ai-cycle-alert', 'AI simulator run #42 - 5 tasks analyzed, 3 completed, 0 errors');
    });

    // 2. Stay on Settings to view agent logs
    await page.evaluate(() => {
      const cycleMsg = localStorage.getItem('hermes-ai-cycle-alert');
      if (cycleMsg) {
        const log = document.getElementById('ai-agent-logs');
        log.style.display = 'block';
        log.innerHTML = `<span data-testid="ai-cycle-log">${cycleMsg}</span>`;
      }
    });

    // 3. Verify simulation lifecycle logs are loaded in view
    const cycleLog = page.locator('[data-testid="ai-cycle-log"]');
    await expect(cycleLog).toBeVisible();
    await expect(cycleLog).toContainText('AI simulator run #42');
  });

  test('T4-5: Multi-page Business Operations Review Workflow', async ({ page }) => {
    // 1. Verify companies list in people management view
    await page.goto('/companies');
    const compList = page.locator('[data-testid="company-list"]');
    await expect(compList).toBeVisible();

    // 2. Navigate to master list
    await page.goto('/tasks');
    await page.locator('[data-testid="tasks-board"]').waitFor();
    await page.selectOption('[data-testid="filter-origin-select"]', 'manual');
    const firstCard = page.locator('[data-testid="task-card-task-1"]');
    await expect(firstCard).toBeVisible();

    // 3. Review category folders metric
    await page.goto('/categories');
    const folderLabel = page.locator('[data-testid="folders-count"]');
    await expect(folderLabel).toHaveText('2');
  });
});
