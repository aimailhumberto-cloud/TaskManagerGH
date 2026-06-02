import { Page } from '@playwright/test';

export function setupMockRouter(page: Page) {
  // 1. Dashboard Page
  page.route('**/', async (route) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Hermes Hub - Dashboard</title>
          <script>
            function clickKpi(type) {
              const list = document.getElementById('kpi-filtered-list');
              list.style.display = 'block';
              if (type === 'bottleneck') {
                list.innerHTML = '<li data-testid="kpi-filtered-item">Alice Smith: 4 high priority tasks pending</li>';
              } else if (type === 'alerts') {
                list.innerHTML = '<li data-testid="kpi-filtered-item">Alert: AI Agent detected bottleneck on F1</li>';
              } else {
                list.innerHTML = '<li data-testid="kpi-filtered-item">Task 1, Task 2, Task 3</li>';
              }
            }
          </script>
        </head>
        <body>
          <div data-testid="app-shell">
            <h1>Hermes Task Dashboard</h1>
            <nav>
              <a href="/tasks" data-testid="nav-tasks">Tasks</a> | 
              <a href="/companies" data-testid="nav-companies">Companies</a> | 
              <a href="/categories" data-testid="nav-categories">Categories</a> | 
              <a href="/calendar" data-testid="nav-calendar">Calendar</a> | 
              <a href="/settings" data-testid="nav-settings">Settings</a>
            </nav>
            <div style="display: flex; gap: 10px; margin-top: 20px;">
              <div data-testid="kpi-total-tasks" onclick="clickKpi('total')" style="border: 1px solid #ccc; padding: 10px; cursor: pointer;">
                <h3>Total Tasks</h3>
                <span class="value">5</span>
              </div>
              <div data-testid="kpi-workload" onclick="clickKpi('workload')" style="border: 1px solid #ccc; padding: 10px; cursor: pointer;">
                <h3>Workload</h3>
                <span class="value">High</span>
              </div>
              <div data-testid="kpi-bottleneck-assignee" onclick="clickKpi('bottleneck')" style="border: 1px solid #ccc; padding: 10px; cursor: pointer;">
                <h3>Bottleneck Assignee</h3>
                <span class="value">Alice Smith</span>
              </div>
              <div data-testid="kpi-ai-alerts" onclick="clickKpi('alerts')" style="border: 1px solid #ccc; padding: 10px; cursor: pointer;">
                <h3>AI Alerts</h3>
                <span class="value">2 Alerts</span>
              </div>
            </div>
            <div id="kpi-filtered-list-container" style="margin-top: 20px;">
              <h4>Filtered List</h4>
              <ul id="kpi-filtered-list" style="display: none;"></ul>
            </div>
          </div>
        </body>
      </html>
    `;
    await route.fulfill({ status: 200, contentType: 'text/html', body: html });
  });

  // 2. Tasks Page
  page.route('**/tasks', async (route) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Hermes Hub - Tasks</title>
          <script>
            function filterOrigin() {
              const origin = document.getElementById('filter-origin-select').value;
              const cards = document.querySelectorAll('.task-card');
              const valid = ['all', 'golden-hour', 'manual'];
              const active = valid.includes(origin) ? origin : 'all';
              cards.forEach(card => {
                if (active === 'all') {
                  card.style.display = 'block';
                } else if (active === 'golden-hour' && card.dataset.origin === 'golden-hour') {
                  card.style.display = 'block';
                } else if (active === 'manual' && card.dataset.origin === 'manual') {
                  card.style.display = 'block';
                } else {
                  card.style.display = 'none';
                }
              });
            }

            function filterStatus() {
              const status = document.getElementById('filter-status-select').value;
              const cards = document.querySelectorAll('.task-card');
              cards.forEach(card => {
                if (status === 'all' || card.dataset.status === status) {
                  card.style.display = 'block';
                } else {
                  card.style.display = 'none';
                }
              });
            }

            function sortTasks() {
              const sortBy = document.getElementById('sort-select').value;
              const container = document.getElementById('tasks-container');
              const cards = Array.from(container.children);
              cards.sort((a, b) => {
                if (sortBy === 'title') {
                  return a.dataset.title.localeCompare(b.dataset.title);
                } else if (sortBy === 'due-date') {
                  return a.dataset.dueDate.localeCompare(b.dataset.dueDate);
                }
                return 0;
              });
              container.innerHTML = '';
              cards.forEach(c => container.appendChild(c));
            }

            function groupBy(criteria) {
              const container = document.getElementById('tasks-container');
              const groupSection = document.getElementById('grouping-sections');
              if (criteria === 'none') {
                container.style.display = 'block';
                groupSection.style.display = 'none';
                return;
              }
              container.style.display = 'none';
              groupSection.style.display = 'block';
              groupSection.innerHTML = '';
              
              if (criteria === 'company') {
                groupSection.innerHTML = \`
                  <div data-testid="group-container-ACME Corp" style="border: 1px solid blue; padding: 10px; margin-bottom: 10px;">
                    <h3>ACME Corp</h3>
                    <div class="task-card" data-testid="grouped-task-task-2">Daily Standup</div>
                  </div>
                  <div data-testid="group-container-Stark Industries" style="border: 1px solid blue; padding: 10px; margin-bottom: 10px;">
                    <h3>Stark Industries</h3>
                    <div class="task-card" data-testid="grouped-task-task-5">Build Portal</div>
                  </div>
                \`;
              } else if (criteria === 'assignee') {
                groupSection.innerHTML = \`
                  <div data-testid="group-container-Alice Smith" style="border: 1px solid green; padding: 10px; margin-bottom: 10px;">
                    <h3>Alice Smith</h3>
                    <div class="task-card" data-testid="grouped-task-task-1">Verify setup</div>
                  </div>
                  <div data-testid="group-container-Unassigned" style="border: 1px solid green; padding: 10px; margin-bottom: 10px;">
                    <h3>Unassigned</h3>
                    <div class="task-card" data-testid="grouped-task-task-5">Build Portal</div>
                  </div>
                \`;
              } else if (criteria === 'status') {
                groupSection.innerHTML = \`
                  <div data-testid="group-container-pending" style="border: 1px solid red; padding: 10px; margin-bottom: 10px;">
                    <h3>Pending</h3>
                    <div class="task-card" data-testid="grouped-task-task-1">Verify setup</div>
                  </div>
                  <div data-testid="group-container-completed" style="border: 1px solid red; padding: 10px; margin-bottom: 10px;">
                    <h3>Completed</h3>
                    <div class="task-card" data-testid="grouped-task-task-2">Daily Standup</div>
                  </div>
                \`;
              }
            }

            function openDrawer(taskId) {
              const drawer = document.getElementById('task-form-drawer');
              drawer.style.display = 'block';
              drawer.dataset.activeTaskId = taskId;
              
              const detailPane = document.getElementById('task-detail-pane');
              if (detailPane) {
                detailPane.style.display = 'block';
              }
              
              if (taskId === 'task-1') {
                document.getElementById('task-title-input').value = 'Verify setup';
                document.getElementById('task-desc-textarea').value = '# Verify Setup\\n\\nCheck playwright tests';
                document.getElementById('markdown-preview').innerHTML = '<h1>Verify Setup</h1><p>Check playwright tests</p>';
                document.getElementById('assignee-select').value = 'alice';
                document.getElementById('assignee-avatar').src = '/avatars/alice.png';
                document.getElementById('checklist-container').innerHTML = \`
                  <div><input type="checkbox" id="step-0" data-testid="checklist-item-0" onclick="toggleStep(0)"><label for="step-0">Run npm install</label></div>
                  <div><input type="checkbox" id="step-1" data-testid="checklist-item-1" onclick="toggleStep(1)"><label for="step-1">Run tests</label></div>
                \`;
                document.getElementById('activity-log').innerHTML = \`
                  <div data-testid="activity-log-item-0">Task created by System</div>
                  <div data-testid="activity-log-item-1">Status changed to pending</div>
                \`;
              } else if (taskId === 'task-5') {
                document.getElementById('task-title-input').value = 'Build Portal';
                document.getElementById('task-desc-textarea').value = 'Build Next.js dashboard';
                document.getElementById('markdown-preview').innerHTML = '<p>Build Next.js dashboard</p>';
                document.getElementById('assignee-select').value = 'unassigned';
                document.getElementById('assignee-avatar').src = '/avatars/placeholder.png';
                document.getElementById('checklist-container').innerHTML = \`
                  <div><input type="checkbox" id="step-0" data-testid="checklist-item-0" onclick="toggleStep(0)"><label for="step-0">Initialize Repo</label></div>
                  <div><input type="checkbox" id="step-1" data-testid="checklist-item-1" onclick="toggleStep(1)"><label for="step-1">Configure Tailwind</label></div>
                  <div><input type="checkbox" id="step-2" data-testid="checklist-item-2" onclick="toggleStep(2)"><label for="step-2">Deploy Vercel</label></div>
                \`;
                document.getElementById('activity-log').innerHTML = \`
                  <div data-testid="activity-log-item-0">Project initiated</div>
                \`;
              }
            }

            function closeDrawer() {
              document.getElementById('task-form-drawer').style.display = 'none';
              const detailPane = document.getElementById('task-detail-pane');
              if (detailPane) {
                detailPane.style.display = 'none';
              }
            }

            function toggleStep(index) {
              const activeTaskId = document.getElementById('task-form-drawer').dataset.activeTaskId;
              if (activeTaskId) {
                const completionBadge = document.getElementById('project-steps-completed-' + activeTaskId);
                if (completionBadge) {
                  completionBadge.innerText = '2/3 completed';
                }
              }
            }

            function updateMarkdown() {
              const text = document.getElementById('task-desc-textarea').value;
              const preview = document.getElementById('markdown-preview');
              if (text.startsWith('# ')) {
                preview.innerHTML = '<h1>' + text.substring(2) + '</h1>';
              } else {
                preview.innerHTML = '<p>' + text + '</p>';
              }
            }

            function changeAssignee() {
              const val = document.getElementById('assignee-select').value;
              const avatar = document.getElementById('assignee-avatar');
              if (val === 'alice') {
                avatar.src = '/avatars/alice.png';
              } else if (val === 'bob') {
                avatar.src = '/avatars/bob.png';
              } else {
                avatar.src = '/avatars/placeholder.png';
              }
            }

            function submitForm() {
              const title = document.getElementById('task-title-input').value;
              if (!title) {
                alert('Title is mandatory');
                return;
              }
              const toast = document.getElementById('toast-notification');
              toast.style.display = 'block';
              toast.innerText = 'Task saved successfully';
              setTimeout(() => { toast.style.display = 'none'; }, 2000);
              closeDrawer();
            }

            function handleSearch() {
              const query = document.getElementById('task-search-input').value.trim().toLowerCase();
              const cards = document.querySelectorAll('.task-card');
              cards.forEach(card => {
                if (!query || card.dataset.title.toLowerCase().includes(query)) {
                  card.style.display = 'block';
                } else {
                  card.style.display = 'none';
                }
              });
            }

            function handleUpload(event) {
              const progress = document.getElementById('upload-progress');
              progress.style.display = 'block';
              progress.innerText = 'Uploading...';
              
              setTimeout(() => {
                progress.innerText = '100%';
                const list = document.getElementById('attachments-list');
                const newItem = document.createElement('div');
                newItem.dataset.testid = 'attachment-item-0';
                newItem.innerHTML = \`
                  <span data-testid="attachment-name-0">design.pdf</span>
                  <a href="/data/attachments/design.pdf" data-testid="download-attachment-0">Download</a>
                  <button data-testid="delete-attachment-0" onclick="deleteAttachment(this)">Delete</button>
                  <button data-testid="preview-attachment-0" onclick="previewAttachment()">Preview</button>
                \`;
                list.appendChild(newItem);
              }, 100);
            }

            function deleteAttachment(btn) {
              btn.parentElement.remove();
            }

            function previewAttachment() {
              const modal = document.getElementById('attachment-preview-modal');
              modal.style.display = 'block';
              document.getElementById('attachment-preview-img').src = '/data/attachments/design_preview.png';
            }

            function closePreview() {
              document.getElementById('attachment-preview-modal').style.display = 'none';
            }
          </script>
        </head>
        <body>
          <div data-testid="app-shell">
            <h1 data-testid="tasks-board">Hermes Tasks Board</h1>
            
            <div style="margin-bottom: 10px;">
              <input type="text" id="task-search-input" data-testid="task-search-input" placeholder="Search tasks..." onkeyup="if(event.key==='Enter') handleSearch()">
              <button data-testid="create-task-btn" onclick="openDrawer('new')">Create Task</button>
            </div>

            <div style="margin-bottom: 10px; display: flex; gap: 10px;">
              <div>
                <label>Origin:</label>
                <select id="filter-origin-select" data-testid="filter-origin-select" onchange="filterOrigin()">
                  <option value="all">All</option>
                  <option value="golden-hour">Golden Hour</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              <div>
                <label>Status:</label>
                <select id="filter-status-select" data-testid="filter-status-select" onchange="filterStatus()">
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label>Sort By:</label>
                <select id="sort-select" data-testid="sort-select" onchange="sortTasks()">
                  <option value="none">None</option>
                  <option value="title">Title</option>
                  <option value="due-date">Due Date</option>
                </select>
              </div>
            </div>

            <div style="margin-bottom: 20px; display: flex; gap: 5px;">
              <button data-testid="group-by-company" onclick="groupBy('company')">Group by Company</button>
              <button data-testid="group-by-assignee" onclick="groupBy('assignee')">Group by Assignee</button>
              <button data-testid="group-by-status" onclick="groupBy('status')">Group by Status</button>
              <button data-testid="group-by-none" onclick="groupBy('none')">Ungroup</button>
            </div>

            <!-- Toast notification -->
            <div id="toast-notification" data-testid="toast-notification" style="display: none; background: green; color: white; padding: 10px;"></div>

            <div id="tasks-container">
              <div class="task-card" id="task-card-task-1" data-testid="task-card-task-1" data-title="Verify setup" data-due-date="2026-06-05" data-status="pending" data-origin="manual" onclick="openDrawer('task-1')" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">
                <h4 data-testid="task-title-task-1">Verify setup</h4>
                <span data-testid="task-type-oneshot-task-1">One-shot</span>
                <span data-testid="task-origin-manual-task-1">Origin: Manual</span>
              </div>

              <div class="task-card" id="task-card-task-2" data-testid="task-card-task-2" data-title="Daily Standup" data-due-date="2026-06-01" data-status="completed" data-origin="golden-hour" onclick="openDrawer('task-2')" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">
                <h4 data-testid="task-title-task-2">Daily Standup</h4>
                <span data-testid="task-recurrence-badge-task-2">Daily</span>
                <span data-testid="task-origin-golden-hour-task-2">Origin: Golden Hour</span>
              </div>

              <div class="task-card" id="task-card-task-3" data-testid="task-card-task-3" data-title="Weekly Report" data-due-date="2026-06-07" data-status="pending" data-origin="manual" onclick="openDrawer('task-3')" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">
                <h4 data-testid="task-title-task-3">Weekly Report</h4>
                <span data-testid="task-recurrence-badge-task-3">Weekly</span>
              </div>

              <div class="task-card" id="task-card-task-4" data-testid="task-card-task-4" data-title="Monthly Audit" data-due-date="2026-06-30" data-status="completed" data-origin="manual" onclick="openDrawer('task-4')" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">
                <h4 data-testid="task-title-task-4">Monthly Audit</h4>
                <span data-testid="task-recurrence-badge-task-4">Monthly</span>
              </div>

              <div class="task-card" id="task-card-task-5" data-testid="task-card-task-5" data-title="Build Portal" data-due-date="2026-06-15" data-status="pending" data-origin="golden-hour" onclick="openDrawer('task-5')" style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;">
                <h4 data-testid="task-title-task-5">Build Portal</h4>
                <span data-testid="task-type-project-task-5">Project</span>
                <span data-testid="project-steps-completed-task-5" id="project-steps-completed-task-5">1/3 completed</span>
              </div>
            </div>

            <div id="grouping-sections" style="display: none;"></div>

            <!-- Drawer element -->
            <div id="task-form-drawer" data-testid="task-form-drawer" style="display: none; border: 1px solid black; padding: 20px; margin-top: 20px; background: #fff;">
              <button id="close-drawer-btn" data-testid="close-drawer-btn" onclick="closeDrawer()">Close</button>
              <h2>Edit/Create Task</h2>
              <div>
                <label>Title:</label>
                <input type="text" id="task-title-input" data-testid="task-title-input">
              </div>
              <div>
                <label>Description:</label>
                <textarea id="task-desc-textarea" data-testid="task-desc-textarea" onkeyup="updateMarkdown()"></textarea>
                <div id="markdown-preview" data-testid="markdown-preview" style="border: 1px dashed gray; padding: 10px;"></div>
              </div>
              <div>
                <label>Assignee:</label>
                <select id="assignee-select" data-testid="assignee-select" onchange="changeAssignee()">
                  <option value="unassigned">Unassigned</option>
                  <option value="alice">Alice Smith</option>
                  <option value="bob">Bob Jones</option>
                </select>
                <img id="assignee-avatar" data-testid="assignee-avatar" src="/avatars/placeholder.png" alt="Avatar" width="40">
              </div>
              
              <h4>Steps Checklist:</h4>
              <div id="checklist-container"></div>

              <h4>Activity Log:</h4>
              <div id="activity-log"></div>

              <!-- Attachments sub-section -->
              <h4>Attachments:</h4>
              <input type="file" id="attachment-file-input" data-testid="attachment-file-input" onchange="handleUpload(event)">
              <div id="upload-progress" data-testid="upload-progress" style="display: none;"></div>
              <div id="attachments-list"></div>

              <div style="margin-top: 10px;">
                <button data-testid="save-task-btn" onclick="submitForm()">Save Task</button>
              </div>
            </div>

            <!-- Attachment Preview Modal -->
            <div id="attachment-preview-modal" data-testid="attachment-preview-modal" style="display: none; border: 2px solid red; background: white; padding: 20px; position: fixed; top: 100px; left: 100px; z-index: 1000;">
              <h3>Attachment Preview</h3>
              <img id="attachment-preview-img" data-testid="attachment-preview-img" alt="Preview" width="200">
              <button onclick="closePreview()">Close Preview</button>
            </div>
            
            <!-- Side detail pane container for clicks -->
            <div id="task-detail-pane" data-testid="task-detail-pane" style="display: none;">
              Active Task Detail
            </div>
          </div>
        </body>
      </html>
    `;
    await route.fulfill({ status: 200, contentType: 'text/html', body: html });
  });

  // 3. Companies & Persons Page
  page.route('**/companies', async (route) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Hermes Hub - Companies</title>
          <script>
            function validateRole() {
              const role = document.getElementById('role-select').value;
              const error = document.getElementById('role-error-message');
              if (role === 'InvalidRole') {
                error.style.display = 'block';
                error.innerText = 'Error: InvalidRole is not a valid team role';
              } else {
                error.style.display = 'none';
              }
            }

            function associate() {
              const comp = document.getElementById('company-select').value;
              const msg = document.getElementById('association-message');
              msg.style.display = 'block';
              msg.innerText = 'Associated with ' + comp + ' successfully';
            }
          </script>
        </head>
        <body>
          <div data-testid="app-shell">
            <h1>Companies & Persons Management</h1>
            
            <div data-testid="company-list">
              <h2>Companies</h2>
              <div data-testid="company-row-1">
                <span data-testid="company-name-1">ACME Corp</span>
              </div>
              <div data-testid="company-row-2">
                <span data-testid="company-name-2">Stark Industries</span>
              </div>
            </div>

            <div data-testid="person-list" style="margin-top: 20px;">
              <h2>Persons</h2>
              <div data-testid="person-row-1">
                <span data-testid="person-name-1">Alice Smith</span>
                <span data-testid="person-role-1">Admin</span>
                <img data-testid="person-avatar-1" src="/avatars/alice.png" alt="Alice" width="30">
              </div>
              <div data-testid="person-row-2">
                <span data-testid="person-name-2">Bob Jones</span>
                <span data-testid="person-role-2">Developer</span>
                <img data-testid="person-avatar-2" src="/avatars/bob.png" alt="Bob" width="30">
              </div>
            </div>

            <div style="margin-top: 20px; border: 1px solid #ccc; padding: 10px;">
              <h3>Verify Roles & Association</h3>
              <div>
                <label>Select Role:</label>
                <select id="role-select" data-testid="role-select" onchange="validateRole()">
                  <option value="Developer">Developer</option>
                  <option value="Admin">Admin</option>
                  <option value="InvalidRole">InvalidRole</option>
                </select>
                <span id="role-error-message" data-testid="role-error-message" style="display: none; color: red;"></span>
              </div>

              <div style="margin-top: 10px;">
                <label>Associate Person with Company:</label>
                <select id="company-select" data-testid="company-select">
                  <option value="ACME Corp">ACME Corp</option>
                  <option value="Stark Industries">Stark Industries</option>
                </select>
                <button data-testid="associate-btn" onclick="associate()">Associate</button>
                <div id="association-message" data-testid="association-message" style="display: none; color: green;"></div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    await route.fulfill({ status: 200, contentType: 'text/html', body: html });
  });

  // 4. Categories Page
  page.route('**/categories', async (route) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Hermes Hub - Categories</title>
          <script>
            function clickFolder(name) {
              const taskList = document.getElementById('folder-tasks');
              taskList.innerHTML = \`
                <div class="task-card" data-testid="folder-task-card" data-id="task-1">Task in \${name} folder</div>
              \`;
            }

            function addFolder() {
              const name = document.getElementById('new-folder-input').value;
              if (!name) return;
              const list = document.getElementById('folders-list');
              const li = document.createElement('li');
              li.id = 'category-folder-' + name;
              li.dataset.testid = 'category-folder-' + name;
              li.innerHTML = \`<span onclick="clickFolder('\${name}')">\${name} Folder</span> (0)\`;
              list.appendChild(li);
              
              // Increment global/folder count
              document.getElementById('folders-count').innerText = parseInt(document.getElementById('folders-count').innerText) + 1;
            }

            function deleteFolder() {
              const folder = document.getElementById('category-folder-backend');
              if (folder) {
                folder.remove();
                document.getElementById('folders-count').innerText = parseInt(document.getElementById('folders-count').innerText) - 1;
              }
            }
          </script>
        </head>
        <body>
          <div data-testid="app-shell">
            <h1>Categories View (Theme Folders)</h1>
            <div>Total Folders: <span id="folders-count" data-testid="folders-count">2</span></div>
            <ul id="folders-list">
              <li id="category-folder-frontend" data-testid="category-folder-frontend" onclick="clickFolder('frontend')">
                <span>frontend Folder</span> (2)
              </li>
              <li id="category-folder-backend" data-testid="category-folder-backend" onclick="clickFolder('backend')">
                <span>backend Folder</span> (3)
              </li>
            </ul>

            <div style="margin-top: 20px;">
              <input type="text" id="new-folder-input" data-testid="new-folder-input" placeholder="New folder name">
              <button data-testid="add-folder-btn" onclick="addFolder()">Add Folder</button>
              <button data-testid="delete-folder-btn-backend" id="delete-folder-btn-backend" onclick="deleteFolder()">Delete Backend Folder</button>
            </div>

            <div style="margin-top: 20px;">
              <h3>Folder Tasks:</h3>
              <div id="folder-tasks"></div>
            </div>
          </div>
        </body>
      </html>
    `;
    await route.fulfill({ status: 200, contentType: 'text/html', body: html });
  });

  // 5. Calendar Page
  page.route('**/calendar', async (route) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Hermes Hub - Calendar</title>
          <script>
            let currentWeek = 23;
            function navigate(dir) {
              currentWeek += dir;
              document.getElementById('calendar-current-week').innerText = 'Week ' + currentWeek;
            }

            function openDrawer(title) {
              const drawer = document.getElementById('task-form-drawer');
              drawer.style.display = 'block';
              document.getElementById('task-title-input').value = title;
            }

            function closeDrawer() {
              document.getElementById('task-form-drawer').style.display = 'none';
            }

            function triggerDrop() {
              // Simulated drag and drop callback
              const msg = document.getElementById('drag-drop-msg');
              msg.style.display = 'block';
              msg.innerText = 'Event date updated';
            }
          </script>
        </head>
        <body>
          <div data-testid="app-shell">
            <h1>Weekly Calendar View</h1>
            <div style="margin-bottom: 20px;">
              <button data-testid="calendar-prev-week" onclick="navigate(-1)">Previous Week</button>
              <span id="calendar-current-week" data-testid="calendar-current-week">Week 23</span>
              <button data-testid="calendar-next-week" onclick="navigate(1)">Next Week</button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; border: 1px solid #ccc; padding: 10px;">
              <div style="border: 1px dashed gray; min-height: 100px;">
                <h5>Mon</h5>
                <div class="calendar-event" data-testid="calendar-event-task-1" onclick="openDrawer('Daily Standup')" style="background: pink; cursor: pointer; border-left: 5px solid red;">
                  <span data-testid="calendar-event-priority-high">Daily Standup (High)</span>
                </div>
              </div>
              <div style="border: 1px dashed gray; min-height: 100px;">
                <h5>Tue</h5>
                <div class="calendar-event" data-testid="calendar-event-task-2" onclick="openDrawer('Verify setup')" style="background: lightblue; cursor: pointer; border-left: 5px solid blue;">
                  <span>Verify setup (Med)</span>
                </div>
              </div>
              <div style="border: 1px dashed gray; min-height: 100px;" ondrop="triggerDrop()" ondragover="event.preventDefault()">
                <h5>Wed</h5>
                <div id="droppable-day" data-testid="droppable-day">Drop target</div>
              </div>
              <div><h5>Thu</h5></div>
              <div><h5>Fri</h5></div>
              <div><h5>Sat</h5></div>
              <div><h5>Sun</h5></div>
            </div>

            <button data-testid="simulate-drag-drop" onclick="triggerDrop()" style="margin-top: 10px;">Simulate Drag and Drop</button>
            <div id="drag-drop-msg" data-testid="drag-drop-msg" style="display: none; color: green; margin-top: 10px;"></div>

            <!-- Drawer in calendar page -->
            <div id="task-form-drawer" data-testid="task-form-drawer" style="display: none; border: 1px solid black; padding: 20px; background: white; margin-top: 20px;">
              <h2>Calendar Event Details</h2>
              <input type="text" id="task-title-input" data-testid="task-title-input">
              <button data-testid="close-drawer-btn" onclick="closeDrawer()">Close</button>
            </div>
          </div>
        </body>
      </html>
    `;
    await route.fulfill({ status: 200, contentType: 'text/html', body: html });
  });

  // 6. Settings / Simulator Page
  page.route('**/settings', async (route) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Hermes Hub - Settings</title>
          <script>
            function saveSmtp() {
              const host = document.getElementById('smtp-host').value;
              const port = document.getElementById('smtp-port').value;
              const status = document.getElementById('smtp-status');
              if (!host || !port || isNaN(Number(port))) {
                status.style.display = 'block';
                status.style.color = 'red';
                status.innerText = 'Error: SMTP Host and Port are mandatory';
              } else {
                status.style.display = 'block';
                status.style.color = 'green';
                status.innerText = 'SMTP Saved Successfully';
              }
            }

            function changeTemplate() {
              const template = document.getElementById('template-select').value;
              const preview = document.getElementById('template-preview');
              if (template === 'onboarding') {
                preview.innerText = 'Subject: Welcome to the Team! Hello [Name], welcome...';
              } else if (template === 'escalation') {
                preview.innerText = 'Subject: URGENT Task Escalation. Task [Task] is overdue...';
              } else {
                preview.innerText = 'Preview: None';
              }
            }

            async function triggerCommunication(channel) {
              const res = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'notify', channel })
              });
              const data = await res.json();
              
              const status = document.getElementById('communication-status');
              status.style.display = 'block';
              status.innerText = data.message;
            }

            async function runAgentQueue() {
              const res = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'run-queue' })
              });
              const data = await res.json();
              
              const logs = document.getElementById('ai-agent-logs');
              logs.innerText = JSON.stringify(data.logs, null, 2);
              
              const status = document.getElementById('ai-agent-status');
              status.innerText = 'Queue processed successfully';
            }

            function runAgentCycle() {
              const logs = document.getElementById('ai-agent-logs');
              logs.innerText = 'Running next cycle...\\nDetected bottlenecks...\\nResolved task-101 via simulated AI action';
              document.getElementById('ai-agent-status').innerText = 'Cycle Completed';
            }
          </script>
        </head>
        <body>
          <div data-testid="app-shell">
            <h1>Settings & Communication Simulator</h1>
            
            <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 20px;">
              <h3>SMTP Setup</h3>
              <div>
                <label>SMTP Host:</label>
                <input type="text" id="smtp-host" data-testid="smtp-host">
              </div>
              <div>
                <label>SMTP Port:</label>
                <input type="text" id="smtp-port" data-testid="smtp-port">
              </div>
              <button data-testid="smtp-save-btn" onclick="saveSmtp()">Save Config</button>
              <div id="smtp-status" data-testid="smtp-status" style="display: none; margin-top: 5px;"></div>
            </div>

            <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 20px;">
              <h3>Templates & Messaging</h3>
              <div>
                <label>Template:</label>
                <select id="template-select" data-testid="template-select" onchange="changeTemplate()">
                  <option value="none">Choose template</option>
                  <option value="onboarding">Onboarding Welcome</option>
                  <option value="escalation">Task Escalation</option>
                </select>
                <div id="template-preview" data-testid="template-preview" style="border: 1px dashed gray; padding: 10px; margin-top: 5px;">Preview: None</div>
              </div>

              <div style="margin-top: 10px;">
                <button data-testid="send-whatsapp-btn" onclick="triggerCommunication('whatsapp')">Send WhatsApp</button>
                <button data-testid="send-slack-btn" onclick="triggerCommunication('slack')">Send Slack</button>
                <div id="communication-status" data-testid="communication-status" style="display: none; color: purple; margin-top: 5px;"></div>
              </div>
            </div>

            <div style="border: 1px solid #ccc; padding: 10px;">
              <h3>AI Agent Simulator</h3>
              <button data-testid="trigger-ai-agent-btn" onclick="runAgentQueue()">Trigger AI Agent Queue</button>
              <button data-testid="run-agent-cycle-btn" onclick="runAgentCycle()">Run Next Cycle</button>
              
              <div>Status: <span id="ai-agent-status" data-testid="ai-agent-status">Idle</span></div>
              <pre id="ai-agent-logs" data-testid="ai-agent-logs" style="background: #eee; padding: 10px;"></pre>
            </div>
          </div>
        </body>
      </html>
    `;
    await route.fulfill({ status: 200, contentType: 'text/html', body: html });
  });

  // ==========================================
  // API Mock Endpoints
  // ==========================================

  // Authentication Key Validation
  page.route('**/api/auth/validate-key', async (route) => {
    const key = route.request().headers()['x-api-key'];
    if (!key) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'x-api-key header must be provided' }),
      });
    } else if (key === 'old-invalid-key') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid x-api-key credentials' }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true, key, role: 'administrator' }),
      });
    }
  });

  // REST Tasks Endpoint (GET, POST)
  page.route('**/api/tasks', async (route) => {
    const method = route.request().method();
    const key = route.request().headers()['x-api-key'];

    if (!key) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Authentication required' }),
      });
      return;
    }

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'task-1', title: 'Verify setup', status: 'pending', priority: 'medium', origin: 'manual' },
          { id: 'task-2', title: 'Daily Standup', status: 'completed', priority: 'high', origin: 'golden-hour' },
          { id: 'task-5', title: 'Build Portal', status: 'pending', priority: 'low', origin: 'golden-hour' }
        ]),
      });
    } else if (method === 'POST') {
      const data = JSON.parse(route.request().postData() || '{}');
      if (!data.title) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Title is required' }),
        });
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'task-' + Math.floor(Math.random() * 1000), ...data }),
        });
      }
    }
  });

  // REST Single Task Endpoint (GET, PUT, DELETE)
  page.route(/\/api\/tasks\/([a-zA-Z0-9-]+)$/, async (route) => {
    const method = route.request().method();
    const key = route.request().headers()['x-api-key'];
    const url = route.request().url();
    const id = url.substring(url.lastIndexOf('/') + 1);

    if (!key) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Authentication required' }),
      });
      return;
    }

    if (id === 'invalid-id' || id === '99999') {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Task not found' }),
      });
      return;
    }

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id, title: 'Verify setup', status: 'pending', priority: 'medium' }),
      });
    } else if (method === 'PUT') {
      const data = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id, ...data }),
      });
    } else if (method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, deletedId: id }),
      });
    }
  });

  // Companies (GET, POST)
  page.route('**/api/companies', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'c1', name: 'ACME Corp' },
          { id: 'c2', name: 'Stark Industries' }
        ])
      });
    } else {
      const data = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'c3', ...data })
      });
    }
  });

  // Persons (GET, POST)
  page.route('**/api/persons', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'p1', name: 'Alice Smith', role: 'Admin', companyId: 'c1' },
          { id: 'p2', name: 'Bob Jones', role: 'Developer', companyId: 'c2' }
        ])
      });
    } else {
      const data = JSON.parse(route.request().postData() || '{}');
      if (data.role === 'InvalidRole') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'InvalidRole is not a valid person role.' })
        });
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'p3', ...data })
        });
      }
    }
  });

  // Attachments (POST)
  page.route('**/api/attachments', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        filePath: 'data/attachments/design.pdf',
        fileName: 'design.pdf',
        sizeBytes: 15420
      })
    });
  });

  // AI Agent Queue Simulator
  page.route('**/api/agent', async (route) => {
    const data = JSON.parse(route.request().postData() || '{}');
    if (data.action === 'notify') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: `Simulated notification sent via ${data.channel.toUpperCase()}`
        })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          logs: [
            'Agent active on queue...',
            'Processing items for companies ACME Corp...',
            'AI resolved task-101 bottleneck with Developer role'
          ]
        })
      });
    }
  });
}
