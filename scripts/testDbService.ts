/**
 * testDbService.ts - Lightweight Unit Verification Script for dbService.ts
 * 
 * This script verifies all CRUD operations and queue methods of `dbService.ts` using
 * the native Node.js `node:assert` library. It operates on a temporary test database file
 * (`data/db.test.json`) to avoid corrupting development or production data.
 * 
 * Execution:
 *   npx tsx scripts/testDbService.ts
 *   or
 *   npx ts-node scripts/testDbService.ts
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// Set environment variable to target the test database before importing the service.
// This requires `dbService.ts` to dynamically select the database path using
// process.env.DATABASE_PATH or fallback to 'data/db.json'.
const TEST_DB_PATH = path.join(process.cwd(), 'data', 'db.test.json');
process.env.DATABASE_PATH = TEST_DB_PATH;

// Import the service under test.
import { DBService } from '../src/services/dbService';

async function runTests() {
  console.log('=== STARTING DB_SERVICE UNIT VERIFICATION ===');
  
  // Ensure the data directory exists
  const dataDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 1. Reset / Setup Phase
  // Delete the test file if it already exists to ensure a clean state
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Instantiate the database service
  const db = new DBService();

  // 2. Seeding Logic Verification
  console.log('Testing seeding logic on empty database...');
  // Reading tasks should trigger initial seeding if the database file is empty/non-existent
  const initialTasks = await db.getTasks();
  
  assert.ok(fs.existsSync(TEST_DB_PATH), 'Database file should be created automatically upon first read/write.');
  
  // Verify seeded tasks
  assert.ok(initialTasks.length > 0, 'Seeding should load at least one default task.');
  const supplyTask = initialTasks.find(t => t.id === 't1');
  assert.ok(supplyTask, 'Seeded tasks should include task "t1".');
  assert.strictEqual(supplyTask.title, 'Verificar cadena de suministro');
  assert.strictEqual(supplyTask.origin, 'Golden Hour');
  
  // Verify seeded companies
  const companies = await db.getCompanies();
  assert.ok(companies.length >= 2, 'Should seed at least 2 companies.');
  const goldenHourCo = companies.find(c => c.id === 'c1');
  assert.ok(goldenHourCo, 'Should include ACME Corp');
  assert.strictEqual(goldenHourCo.name, 'ACME Corp');

  // Verify seeded people
  const people = await db.getPeople();
  assert.ok(people.length >= 4, 'Should seed at least 4 people (Admin, Member, AIAgent, External).');
  const hermesAI = people.find(p => p.id === 'p3');
  assert.ok(hermesAI, 'Should include Hermes AI agent.');
  assert.strictEqual(hermesAI.role, 'AIAgent');

  // Verify seeded templates
  const templates = await db.getEmailTemplates();
  assert.ok(templates.length >= 1, 'Should seed at least 1 email template.');
  assert.strictEqual(templates[0].id, 'tpl1');

  // Verify seeded SMTP Config
  const smtpConfig = await db.getSMTPConfig();
  assert.strictEqual(smtpConfig.host, 'smtp.mailtrap.io');
  assert.strictEqual(smtpConfig.port, 587);

  console.log('✓ Seeding logic verified successfully.');

  // 3. Task CRUD Verification
  console.log('Testing Task CRUD operations...');

  // A. Create Task
  const newTaskPayload = {
    title: 'Verify supply chain backup',
    description: '# Supply Chain Verification\nChecking redundancy options.',
    type: 'One-shot' as const,
    companyId: 'c1',
    assigneeId: 'p2',
    status: 'Pending' as const,
    priority: 'High' as const,
    origin: 'Manual' as const,
    dueDate: '2026-06-10T18:00:00.000Z',
    steps: [
      { id: 'step-1', text: 'Contact alternative suppliers', completed: false }
    ],
    attachments: []
  };

  const createdTask = await db.createTask(newTaskPayload);
  assert.ok(createdTask.id, 'Created task should be assigned an auto-generated id.');
  assert.strictEqual(createdTask.title, newTaskPayload.title);
  assert.strictEqual(createdTask.status, newTaskPayload.status);
  assert.ok(Array.isArray(createdTask.activityLog), 'Activity log should be initialized as an array.');
  assert.ok(createdTask.activityLog.length > 0, 'Activity log should have at least one entry.');
  assert.strictEqual(createdTask.activityLog[0].action, 'Tarea creada');

  // Confirm it exists in list
  const currentTasks = await db.getTasks();
  const foundInList = currentTasks.find(t => t.id === createdTask.id);
  assert.ok(foundInList, 'Created task should be returned in getTasks list.');

  // B. Read Task
  const fetchedTask = await db.getTaskById(createdTask.id);
  assert.ok(fetchedTask, 'Should fetch task by id.');
  assert.strictEqual(fetchedTask.title, newTaskPayload.title);

  // Fetch non-existent
  const nonExistentTask = await db.getTaskById('non-existent-id');
  assert.strictEqual(nonExistentTask, null, 'Fetching non-existent task should return null.');

  // C. Update Task
  const taskUpdates = {
    title: 'Verify supply chain backup - Updated',
    status: 'In Progress' as const,
    steps: [
      { id: 'step-1', text: 'Contact alternative suppliers', completed: true },
      { id: 'step-2', text: 'Analyze cost differences', completed: false }
    ]
  };

  const updatedTask = await db.updateTask(createdTask.id, taskUpdates);
  assert.strictEqual(updatedTask.title, taskUpdates.title);
  assert.strictEqual(updatedTask.status, taskUpdates.status);
  assert.strictEqual(updatedTask.steps.length, 2);
  assert.strictEqual(updatedTask.steps[0].completed, true);

  // Verify persistent storage read again
  const fetchedUpdated = await db.getTaskById(createdTask.id);
  assert.ok(fetchedUpdated, 'Should fetch updated task.');
  assert.strictEqual(fetchedUpdated.title, taskUpdates.title);
  assert.strictEqual(fetchedUpdated.status, taskUpdates.status);

  // D. Delete Task
  const deleteResult = await db.deleteTask(createdTask.id);
  assert.strictEqual(deleteResult, true, 'Deleting an existing task should return true.');

  const fetchedDeleted = await db.getTaskById(createdTask.id);
  assert.strictEqual(fetchedDeleted, null, 'Deleted task should no longer exist.');

  // Try to delete again
  const deleteResult2 = await db.deleteTask(createdTask.id);
  assert.strictEqual(deleteResult2, false, 'Deleting a non-existent task should return false.');

  console.log('✓ Task CRUD operations verified successfully.');

  // 4. Queue Operations Verification (Agent Queue)
  console.log('Testing Agent Queue operations...');

  const initialQueue = await db.getQueue();
  assert.ok(Array.isArray(initialQueue), 'Queue should be an array.');

  // A. Push to queue
  const queuePayload = {
    taskId: 't1',
    command: 'analyze_task',
    payload: { comment: 'Need status audit' }
  };

  const queueItem = await db.pushToQueue(queuePayload);
  assert.ok(queueItem.id, 'Queue item should be assigned an auto-generated id.');
  assert.strictEqual(queueItem.taskId, queuePayload.taskId);
  assert.strictEqual(queueItem.command, queuePayload.command);
  assert.strictEqual(queueItem.status, 'Pending', 'New queue item status should default to Pending.');
  assert.ok(queueItem.timestamp, 'Queue item should contain a timestamp.');

  // Confirm in list
  const queueAfterPush = await db.getQueue();
  const foundQueueItem = queueAfterPush.find(item => item.id === queueItem.id);
  assert.ok(foundQueueItem, 'Pushed item should be returned in getQueue list.');

  // B. Process queue item
  const processResult = await db.processQueueItem(queueItem.id);
  assert.strictEqual(processResult, true, 'Processing a valid queue item should return true.');

  // Check updated status
  const queueAfterProcess = await db.getQueue();
  const processedItem = queueAfterProcess.find(item => item.id === queueItem.id);
  assert.ok(processedItem, 'Queue item should still be in the queue.');
  assert.strictEqual(processedItem.status, 'Processed', 'Queue item status should change to Processed.');

  // Try to process non-existent queue item
  const processResultNonExistent = await db.processQueueItem('non-existent-id');
  assert.strictEqual(processResultNonExistent, false, 'Processing non-existent item should return false.');

  console.log('✓ Queue operations verified successfully.');

  // 5. Person CRUD & Custom Roles Verification
  console.log('Testing Person CRUD & Custom Roles/companyId operations...');

  // A. Create Person with companyId and custom role
  const newPersonPayload = {
    name: 'Gaston',
    role: 'Operaciones',
    avatar: '/avatars/gaston.png',
    companyId: 'c1'
  };
  const createdPerson = await db.createPerson(newPersonPayload);
  assert.ok(createdPerson.id, 'Created person should be assigned an auto-generated id.');
  assert.strictEqual(createdPerson.name, newPersonPayload.name);
  assert.strictEqual(createdPerson.role, newPersonPayload.role);
  assert.strictEqual(createdPerson.companyId, newPersonPayload.companyId);

  // B. Update Person
  const personUpdates = {
    role: 'Gerente',
    companyId: 'c2'
  };
  const updatedPerson = await db.updatePerson(createdPerson.id, personUpdates);
  assert.strictEqual(updatedPerson.role, personUpdates.role);
  assert.strictEqual(updatedPerson.companyId, personUpdates.companyId);
  assert.strictEqual(updatedPerson.name, newPersonPayload.name, 'Name should remain unchanged');

  // Verify updates persist
  const peopleList = await db.getPeople();
  const foundPerson = peopleList.find(p => p.id === createdPerson.id);
  assert.ok(foundPerson, 'Updated person should exist in getPeople list.');
  assert.strictEqual(foundPerson.role, personUpdates.role);
  assert.strictEqual(foundPerson.companyId, personUpdates.companyId);

  // C. Update Non-Existent Person should throw
  await assert.rejects(
    async () => {
      await db.updatePerson('non-existent-person-id', { role: 'CEO' });
    },
    /Person with id "non-existent-person-id" not found\./
  );

  // D. Delete Person
  const deletePersonResult = await db.deletePerson(createdPerson.id);
  assert.strictEqual(deletePersonResult, true, 'Deleting an existing person should return true.');

  const peopleListAfterDelete = await db.getPeople();
  const foundPersonAfterDelete = peopleListAfterDelete.find(p => p.id === createdPerson.id);
  assert.strictEqual(foundPersonAfterDelete, undefined, 'Deleted person should no longer exist in getPeople list.');

  console.log('✓ Person operations verified successfully.');

  // 6. Configs & Templates Verification
  console.log('Testing email configs and templates updates...');

  // Update Templates
  const templateUpdates = [
    {
      id: 'tpl1',
      name: 'Notificación de Asignación',
      subject: 'Nueva tarea asignada: {{task_title}} - Urgente',
      body: 'Hola {{assignee_name}}, se te ha asignado {{task_title}}.'
    }
  ];
  await db.updateEmailTemplates(templateUpdates);
  const updatedTemplates = await db.getEmailTemplates();
  assert.strictEqual(updatedTemplates.length, 1);
  assert.strictEqual(updatedTemplates[0].subject, templateUpdates[0].subject);

  // Update SMTP config
  const smtpUpdate = {
    host: 'smtp.custom.io',
    port: 465,
    secure: true,
    user: 'test_user',
    pass: 'test_pass'
  };
  await db.updateSMTPConfig(smtpUpdate);
  const updatedSmtp = await db.getSMTPConfig();
  assert.deepStrictEqual(updatedSmtp, smtpUpdate, 'SMTP config updates should persist.');

  console.log('✓ Configs and templates updates verified successfully.');

  // 6.5 User Credentials Verification
  console.log('Testing User Credentials CRUD operations...');

  // A. Create User credentials
  const newUserCredentials = {
    personId: 'p1', // Alice Smith (already seeded in initialData)
    email: 'alice@holding.com',
    passwordPlain: 'alicePass123',
    isActive: true
  };

  const createdUser = await db.createUser(newUserCredentials);
  assert.ok(createdUser.id, 'Created user should be assigned an auto-generated id.');
  assert.strictEqual(createdUser.email, newUserCredentials.email);
  assert.strictEqual(createdUser.personId, newUserCredentials.personId);
  assert.strictEqual(createdUser.isActive, true);
  assert.ok(createdUser.passwordHash, 'Created user should have a passwordHash.');
  assert.ok(createdUser.salt, 'Created user should have a salt.');

  // B. Verify email uniqueness validation
  await assert.rejects(
    async () => {
      await db.createUser({
        personId: 'p2',
        email: 'alice@holding.com', // Duplicate
        passwordPlain: 'somepassword',
        isActive: true
      });
    },
    /Email "alice@holding.com" is already registered\./
  );

  // C. Verify personId existence validation
  await assert.rejects(
    async () => {
      await db.createUser({
        personId: 'non-existent-person-id', // Invalid
        email: 'someother@holding.com',
        passwordPlain: 'password123',
        isActive: true
      });
    },
    /Foreign key constraint failed: Person with id "non-existent-person-id" does not exist\./
  );

  // D. Read User by Email
  const fetchedUser = await db.getUserByEmail('alice@holding.com');
  assert.ok(fetchedUser, 'Should fetch user credentials by email.');
  assert.strictEqual(fetchedUser.id, createdUser.id);

  // E. Update User Credentials (change password and email)
  const userUpdates = {
    email: 'alice.smith@holding.com',
    passwordPlain: 'newAlicePass789',
    isActive: false
  };

  const updatedUser = await db.updateUser(createdUser.id, userUpdates);
  assert.strictEqual(updatedUser.email, userUpdates.email);
  assert.strictEqual(updatedUser.isActive, false);
  assert.notStrictEqual(updatedUser.passwordHash, createdUser.passwordHash, 'Password hash should be re-generated when password is changed.');

  // F. Delete User Credentials
  const deleteUserResult = await db.deleteUser(createdUser.id);
  assert.strictEqual(deleteUserResult, true, 'Deleting existing user credentials should return true.');

  const fetchedUserAfterDelete = await db.getUserById(createdUser.id);
  assert.strictEqual(fetchedUserAfterDelete, null, 'Deleted user credentials should no longer exist.');

  console.log('✓ User Credentials CRUD operations verified successfully.');

  // 7. Teardown / Clean-up
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  console.log('=== ALL DB_SERVICE TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('❌ DB_SERVICE UNIT VERIFICATION FAILED:', err);
  // Clean up if error occurs
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  process.exit(1);
});
