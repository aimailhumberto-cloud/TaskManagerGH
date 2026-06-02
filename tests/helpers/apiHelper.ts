import { APIRequestContext } from '@playwright/test';

export interface TaskPayload {
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  assigneeId?: string;
}

/**
 * HermesApiHelper encapsulates the API interaction with the Hermes Task Hub,
 * enforcing x-api-key header presence and validation.
 */
export class HermesApiHelper {
  private request: APIRequestContext;
  private defaultApiKey: string;

  constructor(request: APIRequestContext, defaultApiKey: string = '') {
    this.request = request;
    this.defaultApiKey = defaultApiKey;
  }

  /**
   * Resolves the headers for the API request, ensuring x-api-key header is validated and present.
   * @param apiKey Optional overriding API key
   * @returns Record of headers
   */
  private getHeaders(apiKey?: string): Record<string, string> {
    const key = apiKey || this.defaultApiKey;
    if (!key) {
      throw new Error('API key validation error: x-api-key header must be provided for authenticated requests.');
    }
    return {
      'Content-Type': 'application/json',
      'x-api-key': key,
    };
  }

  /**
   * Retrieves all tasks.
   * @param apiKey Optional overriding API key
   */
  async getTasks(apiKey?: string) {
    const headers = this.getHeaders(apiKey);
    return await this.request.get('/api/tasks', { headers });
  }

  /**
   * Retrieves a single task by ID.
   * @param taskId Task unique identifier
   * @param apiKey Optional overriding API key
   */
  async getTaskById(taskId: string, apiKey?: string) {
    const headers = this.getHeaders(apiKey);
    return await this.request.get(`/api/tasks/${taskId}`, { headers });
  }

  /**
   * Creates a new task.
   * @param task Task payload to create
   * @param apiKey Optional overriding API key
   */
  async createTask(task: TaskPayload, apiKey?: string) {
    const headers = this.getHeaders(apiKey);
    return await this.request.post('/api/tasks', {
      headers,
      data: task,
    });
  }

  /**
   * Updates an existing task by ID.
   * @param taskId Task unique identifier
   * @param task Partial task data to update
   * @param apiKey Optional overriding API key
   */
  async updateTask(taskId: string, task: Partial<TaskPayload>, apiKey?: string) {
    const headers = this.getHeaders(apiKey);
    return await this.request.put(`/api/tasks/${taskId}`, {
      headers,
      data: task,
    });
  }

  /**
   * Deletes a task by ID.
   * @param taskId Task unique identifier
   * @param apiKey Optional overriding API key
   */
  async deleteTask(taskId: string, apiKey?: string) {
    const headers = this.getHeaders(apiKey);
    return await this.request.delete(`/api/tasks/${taskId}`, { headers });
  }

  /**
   * Endpoint to explicitly test key status.
   * @param apiKey API key to check validation for
   */
  async validateApiKey(apiKey: string) {
    return await this.request.get('/api/auth/validate-key', {
      headers: { 'x-api-key': apiKey },
    });
  }
}
