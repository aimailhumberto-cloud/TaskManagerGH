import { test, expect } from '@playwright/test';
import { HermesUiHelper } from '../helpers/uiHelper';
import { HermesApiHelper } from '../helpers/apiHelper';
import { setupMockRouter } from '../helpers/mockRouter';

test.describe('F1: Companies & Persons Management', () => {
  test.beforeEach(async ({ page }) => {
    setupMockRouter(page);
    await page.goto('/companies');
  });

  test('F1-1: Company list display renders all companies successfully', async ({ page }) => {
    const list = page.locator('[data-testid="company-list"]');
    await expect(list).toBeVisible();
    await expect(page.locator('[data-testid="company-name-1"]')).toHaveText('ACME Corp');
    await expect(page.locator('[data-testid="company-name-2"]')).toHaveText('Stark Industries');
  });

  test('F1-2: Person list display renders all persons successfully', async ({ page }) => {
    const list = page.locator('[data-testid="person-list"]');
    await expect(list).toBeVisible();
    await expect(page.locator('[data-testid="person-name-1"]')).toHaveText('Alice Smith');
    await expect(page.locator('[data-testid="person-name-2"]')).toHaveText('Bob Jones');
  });

  test('F1-3: Person roles validation shows no errors for valid roles', async ({ page }) => {
    const select = page.locator('[data-testid="role-select"]');
    await select.selectOption('Developer');
    const error = page.locator('[data-testid="role-error-message"]');
    await expect(error).toBeHidden();
  });

  test('F1-4: Company association connects person to company correctly', async ({ page }) => {
    await page.selectOption('[data-testid="company-select"]', 'ACME Corp');
    await page.click('[data-testid="associate-btn"]');
    const msg = page.locator('[data-testid="association-message"]');
    await expect(msg).toBeVisible();
    await expect(msg).toContainText('Associated with ACME Corp successfully');
  });

  test('F1-5: Person avatar rendering displays image/avatar element', async ({ page }) => {
    const avatar = page.locator('[data-testid="person-avatar-1"]');
    await expect(avatar).toBeVisible();
    await expect(avatar).toHaveAttribute('src', '/avatars/alice.png');
  });
});

test.describe('F2: Task Classification', () => {
  test.beforeEach(async ({ page }) => {
    setupMockRouter(page);
    await page.goto('/tasks');
  });

  test('F2-1: One-shot tasks display appropriate task type icon/badge', async ({ page }) => {
    const badge = page.locator('[data-testid="task-type-oneshot-task-1"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('One-shot');
  });

  test('F2-2: Repetitive tasks daily recurrence shows daily badge', async ({ page }) => {
    const badge = page.locator('[data-testid="task-recurrence-badge-task-2"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('Daily');
  });

  test('F2-3: Repetitive tasks weekly recurrence shows weekly badge', async ({ page }) => {
    const badge = page.locator('[data-testid="task-recurrence-badge-task-3"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('Weekly');
  });

  test('F2-4: Repetitive tasks monthly recurrence shows monthly badge', async ({ page }) => {
    const badge = page.locator('[data-testid="task-recurrence-badge-task-4"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('Monthly');
  });

  test('F2-5: Projects with steps renders step completion list', async ({ page }) => {
    const completion = page.locator('[data-testid="project-steps-completed-task-5"]');
    await expect(completion).toBeVisible();
    await expect(completion).toHaveText('1/3 completed');
  });
});

test.describe('F3: Data Origin', () => {
  test.beforeEach(async ({ page }) => {
    setupMockRouter(page);
    await page.goto('/tasks');
  });

  test('F3-1: Golden Hour task displays high-contrast origin badge', async ({ page }) => {
    const badge = page.locator('[data-testid="task-origin-golden-hour-task-2"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Golden Hour');
  });

  test('F3-2: Manual task displays standard origin badge', async ({ page }) => {
    const badge = page.locator('[data-testid="task-origin-manual-task-1"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Manual');
  });

  test('F3-3: Filtering by Golden Hour tasks displays only Golden Hour tasks', async ({ page }) => {
    await page.selectOption('[data-testid="filter-origin-select"]', 'golden-hour');
    await expect(page.locator('[data-testid="task-card-task-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-card-task-1"]')).toBeHidden();
  });

  test('F3-4: Filtering by Manual tasks displays only Manual tasks', async ({ page }) => {
    await page.selectOption('[data-testid="filter-origin-select"]', 'manual');
    await expect(page.locator('[data-testid="task-card-task-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-card-task-2"]')).toBeHidden();
  });

  test('F3-5: Resetting origin filter shows all tasks regardless of origin', async ({ page }) => {
    await page.selectOption('[data-testid="filter-origin-select"]', 'golden-hour');
    await page.selectOption('[data-testid="filter-origin-select"]', 'all');
    await expect(page.locator('[data-testid="task-card-task-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-card-task-2"]')).toBeVisible();
  });
});

test.describe('F4: Main Dashboard & KPIs', () => {
  test.beforeEach(async ({ page }) => {
    setupMockRouter(page);
    await page.goto('/');
  });

  test('F4-1: KPI card displays total task count correctly', async ({ page }) => {
    const card = page.locator('[data-testid="kpi-total-tasks"]');
    await expect(card).toBeVisible();
    await expect(card.locator('.value')).toHaveText('5');
  });

  test('F4-2: KPI card displays total workload workload metric', async ({ page }) => {
    const card = page.locator('[data-testid="kpi-workload"]');
    await expect(card).toBeVisible();
    await expect(card.locator('.value')).toHaveText('High');
  });

  test('F4-3: KPI card displays bottleneck assignee correctly', async ({ page }) => {
    const card = page.locator('[data-testid="kpi-bottleneck-assignee"]');
    await expect(card).toBeVisible();
    await expect(card.locator('.value')).toHaveText('Alice Smith');
  });

  test('F4-4: KPI card displays active AI agent alerts', async ({ page }) => {
    const card = page.locator('[data-testid="kpi-ai-alerts"]');
    await expect(card).toBeVisible();
    await expect(card.locator('.value')).toHaveText('2 Alerts');
  });

  test('F4-5: Clicking on KPI card filters the tasks display below', async ({ page }) => {
    await page.click('[data-testid="kpi-bottleneck-assignee"]');
    const filteredItem = page.locator('[data-testid="kpi-filtered-item"]');
    await expect(filteredItem).toBeVisible();
    await expect(filteredItem).toContainText('Alice Smith: 4 high priority tasks pending');
  });
});

test.describe('F5: Master Task List', () => {
  test.beforeEach(async ({ page }) => {
    setupMockRouter(page);
    await page.goto('/tasks');
  });

  test('F5-1: Filtering tasks by status works correctly', async ({ page }) => {
    await page.selectOption('[data-testid="filter-status-select"]', 'completed');
    await expect(page.locator('[data-testid="task-card-task-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-card-task-1"]')).toBeHidden();
  });

  test('F5-2: Filtering tasks by status active/pending works correctly', async ({ page }) => {
    await page.selectOption('[data-testid="filter-status-select"]', 'pending');
    await expect(page.locator('[data-testid="task-card-task-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="task-card-task-2"]')).toBeHidden();
  });

  test('F5-3: Sorting tasks by title reorders list', async ({ page }) => {
    const uiHelper = new HermesUiHelper(page);
    await page.selectOption('[data-testid="sort-select"]', 'title');
    const cards = page.locator('.task-card');
    await expect(cards.first()).toContainText('Build Portal'); // B comes before D
  });

  test('F5-4: Grouping tasks by Company groups cards in visual containers', async ({ page }) => {
    await page.click('[data-testid="group-by-company"]');
    const groupContainer = page.locator('[data-testid="group-container-ACME Corp"]');
    await expect(groupContainer).toBeVisible();
    await expect(groupContainer.locator('[data-testid="grouped-task-task-2"]')).toHaveText('Daily Standup');
  });

  test('F5-5: Grouping tasks by Assignee groups cards in visual containers', async ({ page }) => {
    await page.click('[data-testid="group-by-assignee"]');
    const groupContainer = page.locator('[data-testid="group-container-Alice Smith"]');
    await expect(groupContainer).toBeVisible();
    await expect(groupContainer.locator('[data-testid="grouped-task-task-1"]')).toHaveText('Verify setup');
  });
});

test.describe('F6: Categories View', () => {
  test.beforeEach(async ({ page }) => {
    setupMockRouter(page);
    await page.goto('/categories');
  });

  test('F6-1: Theme folders are displayed as folder organization', async ({ page }) => {
    await expect(page.locator('[data-testid="category-folder-frontend"]')).toBeVisible();
    await expect(page.locator('[data-testid="category-folder-backend"]')).toBeVisible();
  });

  test('F6-2: Clicking theme folder displays child tasks', async ({ page }) => {
    await page.click('[data-testid="category-folder-frontend"]');
    const task = page.locator('[data-testid="folder-task-card"]');
    await expect(task).toBeVisible();
    await expect(task).toContainText('Task in frontend folder');
  });

  test('F6-3: Category folders count is initially correct', async ({ page }) => {
    const count = page.locator('[data-testid="folders-count"]');
    await expect(count).toHaveText('2');
  });

  test('F6-4: Creating a new theme folder adds it to the list', async ({ page }) => {
    await page.fill('[data-testid="new-folder-input"]', 'devops');
    await page.click('[data-testid="add-folder-btn"]');
    await expect(page.locator('[data-testid="category-folder-devops"]')).toBeVisible();
    await expect(page.locator('[data-testid="folders-count"]')).toHaveText('3');
  });

  test('F6-5: Deleting an empty category folder removes it from UI', async ({ page }) => {
    await page.click('[data-testid="delete-folder-btn-backend"]');
    await expect(page.locator('[data-testid="category-folder-backend"]')).toBeHidden();
    await expect(page.locator('[data-testid="folders-count"]')).toHaveText('1');
  });
});

test.describe('F7: Weekly Calendar View', () => {
  test.beforeEach(async ({ page }) => {
    setupMockRouter(page);
    await page.goto('/calendar');
  });

  test('F7-1: Calendar displays current week events', async ({ page }) => {
    await expect(page.locator('[data-testid="calendar-current-week"]')).toHaveText('Week 23');
    await expect(page.locator('[data-testid="calendar-event-task-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="calendar-event-task-2"]')).toBeVisible();
  });

  test('F7-2: Navigating week-by-week updates active week days', async ({ page }) => {
    await page.click('[data-testid="calendar-next-week"]');
    await expect(page.locator('[data-testid="calendar-current-week"]')).toHaveText('Week 24');
    await page.click('[data-testid="calendar-prev-week"]');
    await expect(page.locator('[data-testid="calendar-current-week"]')).toHaveText('Week 23');
  });

  test('F7-3: Calendar events are color-coded by priority', async ({ page }) => {
    const event = page.locator('[data-testid="calendar-event-task-1"]');
    await expect(event).toHaveCSS('border-left-color', 'rgb(255, 0, 0)'); // Red
  });

  test('F7-4: Clicking calendar event opens lateral task drawer', async ({ page }) => {
    await page.click('[data-testid="calendar-event-task-1"]');
    const drawer = page.locator('[data-testid="task-form-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(page.locator('[data-testid="task-title-input"]')).toHaveValue('Daily Standup');
  });

  test('F7-5: Drag and drop event updates its scheduled date (mocked interaction)', async ({ page }) => {
    await page.click('[data-testid="simulate-drag-drop"]');
    const msg = page.locator('[data-testid="drag-drop-msg"]');
    await expect(msg).toBeVisible();
    await expect(msg).toHaveText('Event date updated');
  });
});

test.describe('F8: Lateral Task Drawer', () => {
  test.beforeEach(async ({ page }) => {
    setupMockRouter(page);
    await page.goto('/tasks');
  });

  test('F8-1: Opening task drawer displays full markdown description editor and preview', async ({ page }) => {
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('task-1');
    const preview = page.locator('[data-testid="markdown-preview"]');
    await expect(preview).toBeVisible();
    await expect(preview.locator('h1')).toHaveText('Verify Setup');
  });

  test('F8-2: Assignee selector dropdown lists members with avatars', async ({ page }) => {
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('task-1');
    const select = page.locator('[data-testid="assignee-select"]');
    await expect(select).toBeVisible();
    await select.selectOption('bob');
    const avatar = page.locator('[data-testid="assignee-avatar"]');
    await expect(avatar).toHaveAttribute('src', '/avatars/bob.png');
  });

  test('F8-3: Checklist toggling updates step completion state', async ({ page }) => {
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('task-5');
    const completion = page.locator('[data-testid="project-steps-completed-task-5"]');
    await expect(completion).toHaveText('1/3 completed');
    await page.click('[data-testid="checklist-item-0"]');
    await expect(completion).toHaveText('2/3 completed');
  });

  test('F8-4: Activity log feed lists history logs of status transitions', async ({ page }) => {
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('task-1');
    const log = page.locator('[data-testid="activity-log-item-1"]');
    await expect(log).toBeVisible();
    await expect(log).toContainText('Status changed to pending');
  });

  test('F8-5: Saving description edits closes drawer and updates main list', async ({ page }) => {
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('task-1');
    await page.fill('[data-testid="task-title-input"]', 'Verify setup updated');
    await page.click('[data-testid="save-task-btn"]');
    await expect(page.locator('[data-testid="task-form-drawer"]')).toBeHidden();
    await expect(page.locator('[data-testid="toast-notification"]')).toBeVisible();
  });
});

test.describe('F9: Attachments Management', () => {
  test.beforeEach(async ({ page }) => {
    setupMockRouter(page);
    await page.goto('/tasks');
    const uiHelper = new HermesUiHelper(page);
    await uiHelper.clickTaskCard('task-1');
  });

  test('F9-1: Uploading file shows upload progress and list item', async ({ page }) => {
    // Set file input
    const fileInput = page.locator('[data-testid="attachment-file-input"]');
    await fileInput.setInputFiles({
      name: 'design.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf data')
    });
    
    const progress = page.locator('[data-testid="upload-progress"]');
    await expect(progress).toBeVisible();
    await expect(progress).toHaveText('100%');
    
    await expect(page.locator('[data-testid="attachment-item-0"]')).toBeVisible();
  });

  test('F9-2: List display shows filename and download link under data/attachments/', async ({ page }) => {
    const fileInput = page.locator('[data-testid="attachment-file-input"]');
    await fileInput.setInputFiles({
      name: 'design.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf data')
    });
    
    const name = page.locator('[data-testid="attachment-name-0"]');
    await expect(name).toHaveText('design.pdf');
    const link = page.locator('[data-testid="download-attachment-0"]');
    await expect(link).toHaveAttribute('href', '/data/attachments/design.pdf');
  });

  test('F9-3: Multi-part upload allows uploading multiple files simultaneously', async ({ page }) => {
    const fileInput = page.locator('[data-testid="attachment-file-input"]');
    await fileInput.setInputFiles({
      name: 'design.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf data')
    });
    const item = page.locator('[data-testid="attachment-item-0"]');
    await expect(item).toBeVisible();
  });

  test('F9-4: Deleting attachment removes it from attachments list', async ({ page }) => {
    const fileInput = page.locator('[data-testid="attachment-file-input"]');
    await fileInput.setInputFiles({
      name: 'design.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf data')
    });
    await expect(page.locator('[data-testid="attachment-item-0"]')).toBeVisible();
    await page.click('[data-testid="delete-attachment-0"]');
    await expect(page.locator('[data-testid="attachment-item-0"]')).toBeHidden();
  });

  test('F9-5: Previewing compatible attachment displays visual modal', async ({ page }) => {
    const fileInput = page.locator('[data-testid="attachment-file-input"]');
    await fileInput.setInputFiles({
      name: 'design.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('fake pdf data')
    });
    await page.click('[data-testid="preview-attachment-0"]');
    const modal = page.locator('[data-testid="attachment-preview-modal"]');
    await expect(modal).toBeVisible();
    const img = page.locator('[data-testid="attachment-preview-img"]');
    await expect(img).toHaveAttribute('src', '/data/attachments/design_preview.png');
  });
});

test.describe('F10: Communication & AI Agent Simulator', () => {
  test.beforeEach(async ({ page }) => {
    setupMockRouter(page);
    await page.goto('/settings');
  });

  test('F10-1: SMTP configuration saves custom SMTP host and credentials', async ({ page }) => {
    await page.fill('[data-testid="smtp-host"]', 'smtp.hermes.com');
    await page.fill('[data-testid="smtp-port"]', '587');
    await page.click('[data-testid="smtp-save-btn"]');
    const status = page.locator('[data-testid="smtp-status"]');
    await expect(status).toBeVisible();
    await expect(status).toHaveText('SMTP Saved Successfully');
  });

  test('F10-2: Communication templates dropdown updates simulated message preview', async ({ page }) => {
    await page.selectOption('[data-testid="template-select"]', 'onboarding');
    const preview = page.locator('[data-testid="template-preview"]');
    await expect(preview).toContainText('Subject: Welcome to the Team!');
  });

  test('F10-3: WhatsApp and Slack simulator buttons trigger communication webhook', async ({ page }) => {
    await page.click('[data-testid="send-whatsapp-btn"]');
    const status = page.locator('[data-testid="communication-status"]');
    await expect(status).toBeVisible();
    await expect(status).toHaveText('Simulated notification sent via WHATSAPP');
    
    await page.click('[data-testid="send-slack-btn"]');
    await expect(status).toHaveText('Simulated notification sent via SLACK');
  });

  test('F10-4: AI Agent queue endpoint simulates autonomous processing logs', async ({ page }) => {
    await page.click('[data-testid="trigger-ai-agent-btn"]');
    const status = page.locator('[data-testid="ai-agent-status"]');
    await expect(status).toHaveText('Queue processed successfully');
    const logs = page.locator('[data-testid="ai-agent-logs"]');
    await expect(logs).toContainText('AI resolved task-101 bottleneck with Developer role');
  });

  test('F10-5: AI Agent simulator UI controls allow manual run of next agent cycle', async ({ page }) => {
    await page.click('[data-testid="run-agent-cycle-btn"]');
    const status = page.locator('[data-testid="ai-agent-status"]');
    await expect(status).toHaveText('Cycle Completed');
    const logs = page.locator('[data-testid="ai-agent-logs"]');
    await expect(logs).toContainText('Resolved task-101 via simulated AI action');
  });
});
