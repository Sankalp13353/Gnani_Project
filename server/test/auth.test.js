import { test, describe, after, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { config } from '../src/config/env.js';
import { generateToken } from '../src/services/auth.service.js';

describe('CallSaar Phase B: Shopkeeper Authentication & Store Management', () => {
  let server;
  let baseUrl;
  const TEST_PHONES = ['9100000001', '9100000002', '9100000003'];

  before(async () => {
    // Start temporary test server instance on an available random port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/auth`;
        resolve();
      });
    });

    // Clean up any test stores with test phones
    await prisma.store.deleteMany({
      where: { phone: { in: TEST_PHONES } },
    });
  });

  after(async () => {
    // Clean up all stores created during auth tests
    await prisma.store.deleteMany({
      where: { phone: { in: TEST_PHONES } },
    });

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect();
  });

  // 1. Merchant Registration Success
  test('1. POST /api/auth/register creates store, hashes password, sets HTTP-only cookie, and never leaks passwordHash', async () => {
    const payload = {
      ownerName: 'Mohan Lal',
      phone: '9100000001',
      password: 'password123',
      storeName: 'Mohan Kirana Mart',
      address: 'Shop 5, Sector 14 Market',
      city: 'Gurugram',
      pincode: '122001',
      upiId: 'mohan@okaxis',
    };

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.message, 'Store registered successfully');
    assert.ok(body.data.token, 'Should return signed JWT token');

    const store = body.data.store;
    assert.ok(store.id);
    assert.equal(store.name, 'Mohan Kirana Mart');
    assert.equal(store.ownerName, 'Mohan Lal');
    assert.equal(store.phone, '9100000001');
    assert.equal(store.city, 'Gurugram');
    assert.equal(store.pincode, '122001');
    assert.equal(store.upiId, 'mohan@okaxis');
    assert.equal(store.isOpen, true);

    // SECURITY CHECK: passwordHash must NOT appear in response
    assert.equal(store.passwordHash, undefined, 'passwordHash must never be exposed');

    // SECURITY CHECK: Cookie is set with HttpOnly and Path=/
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Should set cookie in headers');
    assert.ok(setCookie.includes(config.authCookieName), 'Cookie should contain authCookieName');
    assert.ok(setCookie.toLowerCase().includes('httponly'), 'Cookie must be HttpOnly');
    assert.ok(setCookie.toLowerCase().includes('path=/'), 'Cookie path should be /');

    // DATABASE CHECK: verify password hash was stored securely using bcrypt
    const dbStore = await prisma.store.findUnique({
      where: { phone: '9100000001' },
    });
    assert.ok(dbStore);
    assert.ok(dbStore.passwordHash.startsWith('$2'), 'Stored password must be a bcrypt hash');
    const passwordValid = await bcrypt.compare('password123', dbStore.passwordHash);
    assert.equal(passwordValid, true, 'Stored bcrypt hash must verify plaintext password');
  });

  // 2. Duplicate Phone Registration Prevention
  test('2. POST /api/auth/register prevents duplicate phone registration and returns 409', async () => {
    const duplicatePayload = {
      ownerName: 'Duplicate Attempt',
      phone: '9100000001', // Already registered in Test 1
      password: 'newpassword456',
      storeName: 'Another Store Name',
      address: 'Main Street',
      city: 'Delhi',
      pincode: '110001',
    };

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duplicatePayload),
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('already registered'));
  });

  // 3. Validation Failures
  test('3. POST /api/auth/register rejects invalid inputs with 400', async () => {
    // Missing ownerName
    const res1 = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9100000002',
        password: 'password123',
        storeName: 'Test Store',
        address: 'Test Addr',
        city: 'City',
        pincode: '123456',
      }),
    });
    assert.equal(res1.status, 400);

    // Short password (< 6 chars)
    const res2 = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerName: 'Owner',
        phone: '9100000002',
        password: '123',
        storeName: 'Test Store',
        address: 'Test Addr',
        city: 'City',
        pincode: '123456',
      }),
    });
    assert.equal(res2.status, 400);

    // Invalid pincode
    const res3 = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerName: 'Owner',
        phone: '9100000002',
        password: 'password123',
        storeName: 'Test Store',
        address: 'Test Addr',
        city: 'City',
        pincode: 'invalid-pin',
      }),
    });
    assert.equal(res3.status, 400);
  });

  // 4. Merchant Login
  test('4. POST /api/auth/login validates credentials, returns token, and sets cookie', async () => {
    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9100000001',
        password: 'password123',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.token);
    assert.equal(body.data.store.phone, '9100000001');
    assert.equal(body.data.store.passwordHash, undefined, 'passwordHash must never be exposed');

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie);
    assert.ok(setCookie.includes(config.authCookieName));
    assert.ok(setCookie.toLowerCase().includes('httponly'));
  });

  // 5. Login Rejection on Invalid Password
  test('5. POST /api/auth/login rejects incorrect password with 401', async () => {
    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9100000001',
        password: 'wrong_password_here',
      }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('Invalid'));
  });

  // 6. Login Rejection on Non-Existent Phone
  test('6. POST /api/auth/login rejects non-existent phone with 401', async () => {
    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9999999999',
        password: 'somepassword',
      }),
    });

    assert.equal(res.status, 401);
  });

  // 7. GET /api/auth/me with Cookie authentication
  test('7. GET /api/auth/me returns authenticated store profile via HTTP-only cookie', async () => {
    // Perform login first to obtain cookie header
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9100000001',
        password: 'password123',
      }),
    });
    const setCookieHeader = loginRes.headers.get('set-cookie');
    const cookieValue = setCookieHeader.split(';')[0]; // callsaar_token=...

    const meRes = await fetch(`${baseUrl}/me`, {
      headers: { Cookie: cookieValue },
    });

    assert.equal(meRes.status, 200);
    const body = await meRes.json();
    assert.equal(body.success, true);
    assert.equal(body.data.store.phone, '9100000001');
    assert.equal(body.data.store.name, 'Mohan Kirana Mart');
    assert.equal(body.data.store.passwordHash, undefined);
  });

  // 8. GET /api/auth/me with Authorization Bearer header
  test('8. GET /api/auth/me returns authenticated store profile via Bearer token', async () => {
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9100000001',
        password: 'password123',
      }),
    });
    const { data } = await loginRes.json();

    const meRes = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${data.token}` },
    });

    assert.equal(meRes.status, 200);
    const body = await meRes.json();
    assert.equal(body.success, true);
    assert.equal(body.data.store.phone, '9100000001');
  });

  // 9. GET /api/auth/me without authentication returns 401
  test('9. GET /api/auth/me without token returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/me`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('Authentication required'));
  });

  // 10. GET /api/auth/me with invalid or expired token returns 401
  test('10. GET /api/auth/me rejects invalid and expired JWT tokens with 401', async () => {
    // Tampered token
    const res1 = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: 'Bearer invalid.tampered.token' },
    });
    assert.equal(res1.status, 401);

    // Expired token
    const expiredToken = jwt.sign(
      { storeId: 'some-id', phone: '9100000001', role: 'merchant' },
      config.jwtSecret,
      { expiresIn: '-1s' }
    );
    const res2 = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(res2.status, 401);
    const body2 = await res2.json();
    assert.ok(body2.message.includes('expired'));
  });

  // 11. POST /api/auth/logout clears authentication cookie
  test('11. POST /api/auth/logout terminates session and clears cookie', async () => {
    const res = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie);
    assert.ok(setCookie.includes(`${config.authCookieName}=;`));
    // Verify expired/maxAge 0
    assert.ok(setCookie.toLowerCase().includes('max-age=0') || setCookie.includes('1970'));
  });

  // 12. Cross-Store Isolation & Tenant Protection
  test('12. requireStoreOwner middleware rejects attempts to access another store', async () => {
    const dbStore = await prisma.store.findUnique({
      where: { phone: '9100000001' },
    });
    const token = generateToken(dbStore);

    // Attempting to access another store ID (e.g. 00000000-0000-0000-0000-000000000001)
    const otherStoreId = '00000000-0000-0000-0000-000000000001';

    // Import requireStoreOwner and test handler behavior directly
    const { authenticateMerchant, requireStoreOwner } = await import(
      '../src/middleware/auth.middleware.js'
    );

    const mockReq = {
      cookies: { [config.authCookieName]: token },
      headers: {},
      params: { storeId: otherStoreId },
      query: {},
      body: {},
    };

    let statusCode = null;
    let jsonResult = null;
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonResult = data;
          },
        };
      },
    };

    // 1. Run authenticateMerchant
    await new Promise((resolve) => {
      authenticateMerchant(mockReq, mockRes, resolve);
    });

    assert.equal(mockReq.storeId, dbStore.id);

    // 2. Run requireStoreOwner with mismatch
    requireStoreOwner(mockReq, mockRes, () => {
      assert.fail('Should not call next when storeId mismatches');
    });

    assert.equal(statusCode, 403);
    assert.equal(jsonResult.success, false);
    assert.ok(jsonResult.message.includes('another store'));
  });
});

