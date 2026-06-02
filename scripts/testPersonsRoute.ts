import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { NextRequest } from 'next/server';

async function runRouteTests() {
  console.log('=== STARTING PERSONS ROUTE UNIT VERIFICATION ===');

  // Set environment variable to target the test database before importing the handler.
  const TEST_DB_PATH = path.join(process.cwd(), 'data', 'db.route.test.json');
  process.env.DATABASE_PATH = TEST_DB_PATH;
  
  // Setup clean database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Dynamically import to avoid ES module hoisting
  const { PUT } = await import('../src/app/api/persons/[id]/route');
  const { dbService } = await import('../src/services/dbService');

  // Seed first by accessing people to initialize db
  const people = await dbService.getPeople();
  console.log('Seeded people:', people);
  assert.ok(people.length > 0, 'Database should be seeded');
  
  // Find a person to update
  const person = people.find(p => p.id === 'p1');
  assert.ok(person, 'Should find Alice Smith (p1)');

  // 1. Test PUT with missing API Key
  const reqNoKey = new NextRequest('http://localhost/api/persons/p1', {
    method: 'PUT',
    headers: {},
    body: JSON.stringify({ role: 'Operaciones' })
  });
  
  const resNoKey = await PUT(reqNoKey, { params: { id: 'p1' } });
  assert.strictEqual(resNoKey.status, 401, 'Should return 401 for missing key');
  const bodyNoKey = await resNoKey.json();
  assert.strictEqual(bodyNoKey.error, 'x-api-key header must be provided');

  // 2. Test PUT with invalid API Key
  const reqBadKey = new NextRequest('http://localhost/api/persons/p1', {
    method: 'PUT',
    headers: { 'x-api-key': 'bad-key-xyz' },
    body: JSON.stringify({ role: 'Operaciones' })
  });
  
  const resBadKey = await PUT(reqBadKey, { params: { id: 'p1' } });
  assert.strictEqual(resBadKey.status, 401, 'Should return 401 for invalid key');
  const bodyBadKey = await resBadKey.json();
  assert.strictEqual(bodyBadKey.error, 'Invalid x-api-key credentials');

  // 3. Test PUT with valid API Key & valid ID
  const reqValid = new NextRequest('http://localhost/api/persons/p1', {
    method: 'PUT',
    headers: { 'x-api-key': 'hermes-master-secret-key' },
    body: JSON.stringify({ role: 'Gerente', companyId: 'comp-1' })
  });
  
  const resValid = await PUT(reqValid, { params: { id: 'p1' } });
  assert.strictEqual(resValid.status, 200, 'Should return 200 for successful update');
  const bodyValid = await resValid.json();
  assert.strictEqual(bodyValid.id, 'p1');
  assert.strictEqual(bodyValid.role, 'Gerente');
  assert.strictEqual(bodyValid.companyId, 'comp-1');

  // 4. Test PUT with non-existent person ID
  const reqNonExistent = new NextRequest('http://localhost/api/persons/non-existent', {
    method: 'PUT',
    headers: { 'x-api-key': 'hermes-master-secret-key' },
    body: JSON.stringify({ role: 'CEO' })
  });
  
  const resNonExistent = await PUT(reqNonExistent, { params: { id: 'non-existent' } });
  assert.strictEqual(resNonExistent.status, 404, 'Should return 404 for non-existent person');
  const bodyNonExistent = await resNonExistent.json();
  assert.ok(bodyNonExistent.error.includes('not found'), 'Error message should indicate not found');

  // Clean up
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  console.log('=== ALL PERSONS ROUTE TESTS PASSED SUCCESSFULLY! ===');
}

runRouteTests().catch(err => {
  console.error('❌ PERSONS ROUTE TESTS FAILED:', err);
  const TEST_DB_PATH = path.join(process.cwd(), 'data', 'db.route.test.json');
  if (fs.existsSync(TEST_DB_PATH)) {
    try {
      fs.unlinkSync(TEST_DB_PATH);
    } catch (_) {}
  }
  process.exit(1);
});
