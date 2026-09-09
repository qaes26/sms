import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Starting E2E API & Route Verification Tests...\n');

  // 1. Test Homepage
  console.log('1. Checking Homepage HTML and German copy...');
  const homeRes = await fetch(`${BASE_URL}/`);
  assert.strictEqual(homeRes.status, 200, 'Homepage should return 200');
  const homeHtml = await homeRes.text();
  assert(homeHtml.includes('Willkommen'), 'Home must contain "Willkommen"');
  assert(homeHtml.includes('Telefonnummer'), 'Home must contain "Telefonnummer"');
  assert(homeHtml.includes('Weiter'), 'Home must contain "Weiter"');
  assert(homeHtml.includes('lang="de"'), 'HTML must have lang="de"');
  console.log('✅ Homepage German text and structure verified.');

  // 2. Test Invalid Phone validation
  console.log('\n2. Testing Phone Validation API with invalid number...');
  const invalidPhoneRes = await fetch(`${BASE_URL}/api/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: '123' })
  });
  assert.strictEqual(invalidPhoneRes.status, 400, 'Invalid phone should return 400');
  const invalidPhoneJson = await invalidPhoneRes.json();
  const errMsg = invalidPhoneJson.error || invalidPhoneJson.message;
  assert.strictEqual(errMsg, 'Bitte geben Sie eine gültige Telefonnummer ein.');
  console.log('✅ Phone validation correctly rejects invalid numbers with exact German message.');

  // 3. Test Valid SMS Sending and Session creation with local Jordan number (079...)
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const testPhone = `079${randomSuffix}123`;
  console.log(`\n3. Testing SMS Sending with local Jordanian phone number (${testPhone})...`);
  const validPhoneRes = await fetch(`${BASE_URL}/api/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `192.168.2.${Math.floor(Math.random() * 200 + 10)}` },
    body: JSON.stringify({ phoneNumber: testPhone })
  });
  assert.strictEqual(validPhoneRes.status, 200, 'Valid SMS send should return 200');
  const validPhoneJson = await validPhoneRes.json();
  assert(validPhoneJson.success, 'SMS result should be successful');
  assert.strictEqual(validPhoneJson.message, 'Die SMS wurde erfolgreich gesendet.');
  assert(validPhoneJson.sessionId, 'Session ID must be generated');
  const sessionId = validPhoneJson.sessionId;
  console.log(`✅ SMS sent successfully. Generated Session ID: ${sessionId}`);

  // 4. Test Admin Unauthorized Access
  console.log('\n4. Testing Admin API protection without auth token...');
  const unauthRes = await fetch(`${BASE_URL}/api/sessions`);
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated sessions request should return 401');
  console.log('✅ Protected /api/sessions correctly blocks unauthorized access.');

  // 5. Test Admin Login (Invalid Password)
  console.log('\n5. Testing Admin Login with invalid password...');
  const badLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrongpassword' })
  });
  assert.strictEqual(badLoginRes.status, 401, 'Bad login should return 401');
  console.log('✅ Admin login rejects invalid password.');

  // 6. Test Admin Login (Valid Password)
  console.log('\n6. Testing Admin Login with correct password...');
  const goodLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'AdminSecure2025!' })
  });
  assert.strictEqual(goodLoginRes.status, 200, 'Good login should return 200');
  const cookieHeader = goodLoginRes.headers.get('set-cookie');
  assert(cookieHeader, 'Set-Cookie header must be present');
  const adminCookie = cookieHeader.split(';')[0];
  console.log('✅ Admin authenticated successfully, received secure session cookie.');

  // 7. Test Admin Session Listing & Phone Masking
  console.log('\n7. Testing Admin Active Sessions list with masked phone number...');
  const sessionsRes = await fetch(`${BASE_URL}/api/sessions`, {
    headers: { Cookie: adminCookie }
  });
  assert.strictEqual(sessionsRes.status, 200, 'Authenticated sessions request should return 200');
  const sessionsJson = await sessionsRes.json();
  assert(Array.isArray(sessionsJson.sessions), 'sessions should be an array');
  const ourSession = sessionsJson.sessions.find(s => s.id === sessionId);
  assert(ourSession, 'Active session must be present in admin list');
  assert(ourSession.maskedPhoneNumber.includes('****'), 'Phone number must contain **** masking');
  assert(/\+\d+ \d+ \*{4} \d{4}/.test(ourSession.maskedPhoneNumber), 'Phone number must match masked pattern');
  console.log(`✅ Found session in Admin dashboard. Masked phone: ${ourSession.maskedPhoneNumber}`);

  // 8. Test Session Stream Status Update & Heartbeat
  console.log('\n8. Testing Session Stream Status update & Heartbeat...');
  const streamStatusRes = await fetch(`${BASE_URL}/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ streamStatus: 'streaming', heartbeat: true })
  });
  assert.strictEqual(streamStatusRes.status, 200, 'Stream status PATCH should return 200');

  const sessionDetailRes = await fetch(`${BASE_URL}/api/sessions/${sessionId}`);
  assert.strictEqual(sessionDetailRes.status, 200, 'Session detail GET should return 200');
  const sessionDetailJson = await sessionDetailRes.json();
  assert.strictEqual(sessionDetailJson.streamStatus, 'streaming', 'Session streamStatus should be updated to streaming');
  console.log('✅ Session stream status updated to streaming and verified.');

  // 9. Test Session Termination
  console.log('\n9. Testing Session termination...');
  const endRes = await fetch(`${BASE_URL}/api/sessions/${sessionId}`, {
    method: 'DELETE'
  });
  assert.strictEqual(endRes.status, 200, 'Session termination should succeed');

  // Verify session is no longer in active list
  const sessionsAfterRes = await fetch(`${BASE_URL}/api/sessions`, {
    headers: { Cookie: adminCookie }
  });
  const sessionsAfterJson = await sessionsAfterRes.json();
  const sessionAfter = sessionsAfterJson.sessions.find(s => s.id === sessionId);
  assert(!sessionAfter, 'Terminated session must no longer be in active list');
  console.log('✅ Session ended and removed from active list successfully.');

  console.log('\n🎉 ALL 9 E2E TESTS PASSED PERFECTLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
