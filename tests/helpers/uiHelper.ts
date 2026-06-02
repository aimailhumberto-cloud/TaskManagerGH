import { Page } from '@playwright/test';

/**
 * HermesUiHelper provides basic helper routines for UI interactions in E2E tests,
 * promoting standard POM (Page Object Model) practices.
 */
export class HermesUiHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigates to the home or dashboard view.
   */
  async navigateToDashboard() {
    await this.page.goto('/');
    // Standard wait for initial app loader/shell to be ready
    await this.page.locator('[data-testid="app-shell"]').waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Navigates to the tasks page.
   */
  async navigateToTasksView() {
    await this.page.goto('/tasks');
    await this.page.locator('[data-testid="tasks-board"]').waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Opens the creation drawer for tasks.
   */
  async openCreateTaskDrawer() {
    const createBtn = this.page.locator('[data-testid="create-task-btn"]');
    await createBtn.click();
    // Wait for drawer to slide in or become visible
    await this.page.locator('[data-testid="task-form-drawer"]').waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Closes any open side drawer or modal.
   */
  async closeActiveDrawer() {
    const closeBtn = this.page.locator('[data-testid="close-drawer-btn"]');
    await closeBtn.click();
    // Wait for drawer to be removed or hidden from viewport
    await this.page.locator('[data-testid="task-form-drawer"]').waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Fills and submits the task form inside the drawer.
   */
  async submitTaskForm(task: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
  }) {
    await this.page.locator('[data-testid="task-title-input"]').fill(task.title);

    if (task.description) {
      await this.page.locator('[data-testid="task-desc-textarea"]').fill(task.description);
    }

    if (task.status) {
      await this.page.locator('[data-testid="task-status-select"]').selectOption({ value: task.status });
    }

    if (task.priority) {
      await this.page.locator('[data-testid="task-priority-select"]').selectOption({ value: task.priority });
    }

    const saveBtn = this.page.locator('[data-testid="save-task-btn"]');
    await saveBtn.click();
  }

  /**
   * Searches for a specific task using the search bar.
   */
  async searchTasks(query: string) {
    const searchInput = this.page.locator('[data-testid="task-search-input"]');
    await searchInput.fill(query);
    await this.page.keyboard.press('Enter');
  }

  /**
   * Filters the tasks by a given status category or tab.
   */
  async filterTasksByStatus(statusTab: string) {
    const tabLocator = this.page.locator(`[data-testid="status-tab-${statusTab}"]`);
    await tabLocator.click();
  }

  /**
   * Wait for a toast alert notification to appear and match the exact text.
   */
  async waitForToastNotification(message: string, timeout = 5000) {
    const toast = this.page.locator('[data-testid="toast-notification"]', { hasText: message });
    await toast.waitFor({ state: 'visible', timeout });
  }

  /**
   * Click on a task card to open details.
   */
  async clickTaskCard(taskId: string) {
    const card = this.page.locator(`[data-testid="task-card-${taskId}"]`);
    await card.click();
    await this.page.locator('[data-testid="task-detail-pane"]').waitFor({ state: 'visible', timeout: 5000 });
  }
}
