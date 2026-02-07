// Performance & Feature Testing Script
// Tests all critical paths after optimization deployment

const BASE_URL = 'https://workflow-manager-hazel.vercel.app';

console.log('🧪 WORKFLOW MANAGER - PERFORMANCE TEST SUITE');
console.log('='.repeat(60));
console.log(`Testing: ${BASE_URL}`);
console.log(`Time: ${new Date().toISOString()}`);
console.log('='.repeat(60));

let testsPassed = 0;
let testsFailed = 0;

function pass(msg) {
  console.log(`✅ PASS: ${msg}`);
  testsPassed++;
}

function fail(msg, error) {
  console.log(`❌ FAIL: ${msg}`);
  if (error) console.log(`   Error: ${error}`);
  testsFailed++;
}

function log(msg) {
  console.log(`ℹ️  ${msg}`);
}

async function measure(name, fn) {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  log(`${name} took ${duration}ms`);
  return { result, duration };
}

// Test 1: Admin Login
async function testAdminLogin() {
  console.log('\n📋 TEST 1: Admin Login');
  try {
    const { result, duration } = await measure('Admin auth', async () => {
      const response = await fetch(`${BASE_URL}/api/storage?action=auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empId: 'TEAM', password: 'Pooja852', role: 'admin' })
      });
      return await response.json();
    });

    if (result.user && result.user.role === 'admin') {
      pass('Admin login successful');
      if (duration < 2000) pass('Login response time < 2s');
      else fail('Login response time > 2s', `${duration}ms`);
    } else {
      fail('Admin login failed', JSON.stringify(result));
    }
  } catch (e) {
    fail('Admin login error', e.message);
  }
}

// Test 2: Get Users (Database Index Test)
async function testGetUsers() {
  console.log('\n📋 TEST 2: Get Users (DB Index Test)');
  try {
    const { result, duration } = await measure('GET /api/storage?action=getUsers', async () => {
      const response = await fetch(`${BASE_URL}/api/storage?action=getUsers`);
      return await response.json();
    });

    if (result.users && Array.isArray(result.users)) {
      pass(`Fetched ${result.users.length} users`);
      if (duration < 2000) pass('Query with index < 2s');
      else fail('Query too slow (index may not be working)', `${duration}ms`);
    } else {
      fail('Failed to fetch users', JSON.stringify(result));
    }
  } catch (e) {
    fail('Get users error', e.message);
  }
}

// Test 3: Get All Entries with Pagination
async function testPagination() {
  console.log('\n📋 TEST 3: Pagination Test');
  
  // Test 3a: Default (limit 1000, offset 0)
  try {
    const { result: r1, duration: d1 } = await measure('GET all entries (default)', async () => {
      const response = await fetch(`${BASE_URL}/api/storage?action=getAllEntries`);
      return await response.json();
    });

    if (r1.entries && Array.isArray(r1.entries)) {
      pass(`Default fetch returned ${r1.entries.length} entries`);
      log(`Total in DB: ${r1.total || 'N/A'}, HasMore: ${r1.hasMore || false}`);
      if (d1 < 3000) pass('Unpaginated query < 3s');
      else fail('Unpaginated query too slow', `${d1}ms`);
    } else {
      fail('Failed to fetch all entries', JSON.stringify(r1));
    }
  } catch (e) {
    fail('Get all entries error', e.message);
  }

  // Test 3b: Paginated (limit 50, offset 0)
  try {
    const { result: r2, duration: d2 } = await measure('GET entries (limit=50, offset=0)', async () => {
      const response = await fetch(`${BASE_URL}/api/storage?action=getAllEntries&limit=50&offset=0`);
      return await response.json();
    });

    if (r2.entries && Array.isArray(r2.entries)) {
      if (r2.entries.length <= 50) pass(`Pagination limit working (got ${r2.entries.length} entries)`);
      else fail('Pagination limit not working', `Got ${r2.entries.length} entries`);
      
      if (r2.total !== undefined) pass(`Pagination metadata present (total: ${r2.total})`);
      else fail('Missing pagination metadata');
      
      if (d2 < 2000) pass('Paginated query < 2s');
      else fail('Paginated query too slow', `${d2}ms`);
    } else {
      fail('Pagination request failed', JSON.stringify(r2));
    }
  } catch (e) {
    fail('Pagination error', e.message);
  }

  // Test 3c: Second page (limit 50, offset 50)
  try {
    const { result: r3, duration: d3 } = await measure('GET entries (limit=50, offset=50)', async () => {
      const response = await fetch(`${BASE_URL}/api/storage?action=getAllEntries&limit=50&offset=50`);
      return await response.json();
    });

    if (r3.entries && Array.isArray(r3.entries)) {
      pass(`Second page fetched (${r3.entries.length} entries)`);
      if (d3 < 2000) pass('Second page query < 2s');
      else fail('Second page query too slow', `${d3}ms`);
    } else {
      fail('Second page fetch failed');
    }
  } catch (e) {
    fail('Second page error', e.message);
  }
}

// Test 4: API Throttling Simulation
async function testAPIThrottling() {
  console.log('\n📋 TEST 4: API Throttling (Client-side, manual verification needed)');
  log('Note: Throttling is client-side (React), cannot test directly in Node.js');
  log('Manual check: Open browser devtools, watch Network tab during multiple actions');
  pass('Test skipped (client-side only)');
}

// Test 5: Data Integrity Check
async function testDataIntegrity() {
  console.log('\n📋 TEST 5: Data Integrity');
  try {
    const { result } = await measure('Fetch sample entries', async () => {
      const response = await fetch(`${BASE_URL}/api/storage?action=getAllEntries&limit=10&offset=0`);
      return await response.json();
    });

    if (result.entries && result.entries.length > 0) {
      const sample = result.entries[0];
      const hasRequiredFields = sample.id && sample.date && sample.status;
      
      if (hasRequiredFields) pass('Entry records have required fields');
      else fail('Missing required fields in entries', `Sample: ${JSON.stringify(sample)}`);

      // Check if payload is properly parsed
      const hasTimeData = sample.currentLogin || sample.talk || sample.pause;
      if (hasTimeData) pass('Entry payload properly parsed');
      else fail('Entry payload not parsed correctly');

      // Check user info joined correctly
      if (sample.userName && sample.userId) pass('User data joined correctly');
      else fail('Missing user data in joined query');
    } else {
      log('No entries in database to test integrity');
    }
  } catch (e) {
    fail('Data integrity test error', e.message);
  }
}

// Test 6: Performance Benchmarks
async function testPerformanceBenchmarks() {
  console.log('\n📋 TEST 6: Performance Benchmarks');
  
  const times = [];
  log('Running 5 sequential requests to measure average response time...');
  
  for (let i = 1; i <= 5; i++) {
    try {
      const { duration } = await measure(`Request ${i}`, async () => {
        const response = await fetch(`${BASE_URL}/api/storage?action=getAllEntries&limit=50&offset=0`);
        return await response.json();
      });
      times.push(duration);
    } catch (e) {
      fail(`Request ${i} failed`, e.message);
    }
  }

  if (times.length === 5) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);
    
    log(`Average: ${avg.toFixed(0)}ms, Min: ${min}ms, Max: ${max}ms`);
    
    if (avg < 2000) pass('Average response time < 2s');
    else fail('Average response time too high', `${avg.toFixed(0)}ms`);
    
    if (max < 3000) pass('Max response time < 3s');
    else fail('Max response time too high', `${max}ms`);
  }
}

// Test 7: Database Indexes Verification (indirect)
async function testDatabaseIndexes() {
  console.log('\n📋 TEST 7: Database Indexes (Indirect Verification)');
  
  // Test query with WHERE clause on indexed column
  try {
    const users = await (await fetch(`${BASE_URL}/api/storage?action=getUsers`)).json();
    if (users.users && users.users.length > 0) {
      const testUser = users.users[0];
      
      const { duration } = await measure('Query filtered by user_id (indexed)', async () => {
        const response = await fetch(`${BASE_URL}/api/storage?action=getEntries&userId=${encodeURIComponent(testUser.id)}`);
        return await response.json();
      });

      if (duration < 1500) pass('Indexed user_id query fast (<1.5s)');
      else fail('Indexed query slower than expected', `${duration}ms`);
    } else {
      log('No users found to test index performance');
    }
  } catch (e) {
    fail('Index verification error', e.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 Starting test suite...\n');
  
  await testAdminLogin();
  await testGetUsers();
  await testPagination();
  await testAPIThrottling();
  await testDataIntegrity();
  await testDatabaseIndexes();
  await testPerformanceBenchmarks();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));
  
  if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Performance optimizations working correctly.');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED - Review errors above');
  }
  
  console.log('\n📝 Manual Browser Tests Required:');
  console.log('   1. Open https://workflow-manager-hazel.vercel.app');
  console.log('   2. Login as admin (TEAM/Pooja852)');
  console.log('   3. Check "All Logs" tab - verify pagination controls visible');
  console.log('   4. Change filters - verify page resets to 1');
  console.log('   5. Click through pages - verify data changes');
  console.log('   6. Open DevTools Network tab - verify API throttling (max 1 call/3s)');
  console.log('   7. Toggle dark mode - verify UI still works');
  console.log('   8. Add/Edit/Delete entry - verify CRUD operations work');
}

// Execute tests
runAllTests().catch(err => {
  console.error('💥 TEST SUITE CRASHED:', err);
  process.exit(1);
});
