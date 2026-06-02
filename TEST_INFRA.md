# Hermes Task Hub - E2E Testing Infrastructure

This document outlines the End-to-End (E2E) testing philosophy, architecture, feature inventory, workload scenarios, and test runner configurations for the Hermes Task Hub.

---

## 1. E2E Test Philosophy & Architecture

E2E testing in Hermes Task Hub validates that the entire application stack—from the database interfaces and security layers up to the user interface elements—functions as a cohesive unit. Our goal is to simulate genuine user journeys and API workflows with high fidelity.

### Architectural Core Concepts:
- **Type-Safe Page Interactions**: Written entirely in TypeScript, avoiding fragile CSS queries by utilizing `data-testid` selectors.
- **Opaque-Box E2E Testing**: Treating the system as a black box where assertions are made based on UI responses or API status returns.
- **Encapsulated Helpers**: 
  - **`HermesApiHelper`**: Wraps the backend REST API endpoints, enforcing strict validation of the `x-api-key` header to ensure secure access.
  - **`HermesUiHelper`**: Encapsulates common page operations (such as opening the task drawer, submitting task forms, and searching/filtering) following the Page Object Model (POM) pattern.
- **Flake Prevention**: Relying on Playwright's automatic waiting and locating mechanisms instead of manual timeouts.

---

## 2. 10-Feature Inventory with Tier Targets

To systematically cover the application, we categorize features into **Tier 1 (Critical Path)** and **Tier 2 (Extended Flows)** targets:

### Tier 1: Critical Path Features (High Priority)
1. **User Authentication & API Key Validation**: Verification of api-key presence, unauthorized (401) rejection for invalid keys, and successful authorization for valid keys.
2. **Task Creation Form & Drawer Workflow**: Testing the UI side drawer form rendering, validation of mandatory fields (like title), and successful creation triggers.
3. **Live Task Status Transitions**: Updating a task status (e.g., from `pending` to `in-progress` or `completed`) via either the dropdown select list or board actions.
4. **Keyword-Based Task Search**: Searching tasks via query parameter Matching with dynamic, immediate visual filter updates.
5. **Core REST API CRUD Operations**: Standard creation (`POST`), retrieval (`GET`), update (`PUT`), and deletion (`DELETE`) of tasks through authenticated API routes.
6. **Task Filtering by Priority**: Isolating tasks on the dashboard using low, medium, and high priority tags.

### Tier 2: Extended Flow Features (Medium/Low Priority)
7. **Task Details & Activity Log Pane**: Verifying that clicking on a task card loads the details side-pane and populated commentary feed.
8. **Tag/Category Allocation**: Attaching and filtering tasks by custom tags (e.g., `frontend`, `bug`, `security`).
9. **User Preferences & Theme Switcher**: Saving visual settings (e.g., Dark Mode) locally and ensuring it persists across page reloads.
10. **CSV Task Export**: Verifying that downloading the task list successfully yields a valid CSV payload with correct headers and task fields.

---

## 3. Real-World Workload Scenarios

To ensure the test suite reflects production-like usage, we define three end-to-end workload scenarios:

### Scenario A: "The Project Lead's Daily Standup" (UI Focus)
- **Goal**: Add new priorities and align statuses.
- **Steps**:
  1. The user logs in and navigates to the Tasks View.
  2. The user opens the Task Drawer and creates three high-priority bugs.
  3. The user searches for "setup" in the search box to locate the E2E setup task.
  4. The user clicks the task card and changes the status dropdown to `completed`.
  5. The user validates that a success toast notification appears and the card moves to the "Completed" column.

### Scenario B: "API Key Rotation and Access Recovery" (API Focus)
- **Goal**: Safely rotate credentials and verify endpoint behavior.
- **Steps**:
  1. The user makes an API call with `old-invalid-key` and asserts a `401 Unauthorized` status response is returned.
  2. The user rotates keys in their configuration to `new-valid-key`.
  3. The user queries the validation endpoint (`/api/auth/validate-key`) and asserts a `200 OK` status with key metadata.
  4. The user creates a new task using the `new-valid-key` and asserts success.

### Scenario C: "Sprint Review Cleanup" (Hybrid Focus)
- **Goal**: Audit, review details, and purge completed tasks.
- **Steps**:
  1. The user opens the task manager UI and selects the "Completed" status filter tab.
  2. The user clicks on each completed task card to verify that its details pane shows positive results.
  3. The user uses the API helper to issue a `DELETE` request for the archaic completed tasks.
  4. The user refreshes the page and verifies the completed task column is now clean.

---

## 4. Commands to Execute Tests

### Setup Dependencies
First, ensure all required packages are installed:
```bash
npm install
```

### Install Playwright Browsers
If this is your first time running Playwright on this machine:
```bash
npx playwright install chromium
```

### Run Tests via the Custom Runner (Includes Counts & Pretty Summaries)
To run all tests and get the customized summary of files and cases:
```bash
npm run test:e2e
```

### Run Raw Playwright Commands
To run the Playwright test suite using standard options:
```bash
# Run all tests headlessly
npm run test:playwright

# Run tests with a UI interactive runner
npx playwright test --ui

# Debug tests step-by-step
npx playwright test --debug
```
