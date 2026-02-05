// Test the Vercel API endpoint directly

const API_URL = 'https://workflow-manager-hazel.vercel.app/api/storage';

console.log('Testing Vercel API endpoint...\n');

// Test 1: Admin Login
console.log('1. Testing admin login...');
try {
  const response = await fetch(API_URL + '?action=auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      empId: 'TEAM',
      password: 'Pooja852',
      role: 'admin'
    })
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));

  if (response.ok) {
    console.log('✅ Admin login SUCCESSFUL!\n');
  } else {
    console.log('❌ Admin login FAILED\n');
  }
} catch (error) {
  console.error('❌ Request failed:', error.message, '\n');
}

// Test 2: User Registration
console.log('2. Testing user registration...');
try {
  const response = await fetch(API_URL + '?action=register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      empId: 'TEST123',
      name: 'Test User',
      password: 'test123',
      role: 'user'
    })
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));

  if (response.ok) {
    console.log('✅ User registration SUCCESSFUL!\n');
  } else {
    console.log('❌ User registration FAILED\n');
  }
} catch (error) {
  console.error('❌ Request failed:', error.message, '\n');
}

// Test 3: Get Users
console.log('3. Testing get users...');
try {
  const response = await fetch(API_URL + '?action=getUsers', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(data, null, 2));

  if (response.ok) {
    console.log('✅ Get users SUCCESSFUL!');
    console.log('   Found', data.users?.length || 0, 'users\n');
  } else {
    console.log('❌ Get users FAILED\n');
  }
} catch (error) {
  console.error('❌ Request failed:', error.message, '\n');
}

console.log('===================================');
console.log('Test completed!');
console.log('===================================');
