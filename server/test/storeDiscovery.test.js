import { test, describe, after, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

describe('OrderSaathi Phase D: Customer Store Discovery & Public Catalogue Browsing', () => {
  let server;
  let baseUrl;

  let storeA;
  let storeB;

  const STORE_A_PHONE = '9400000001';
  const STORE_B_PHONE = '9400000002';

  before(async () => {
    // Start temporary test server on random port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/stores`;
        resolve();
      });
    });

    // Clean up test records
    await prisma.product.deleteMany({
      where: {
        store: {
          phone: { in: [STORE_A_PHONE, STORE_B_PHONE] },
        },
      },
    });
    await prisma.store.deleteMany({
      where: { phone: { in: [STORE_A_PHONE, STORE_B_PHONE] } },
    });

    const passwordHash = await bcrypt.hash('TestPass123', 10);

    // Create Store A (Open store in Indiranagar)
    storeA = await prisma.store.create({
      data: {
        name: 'Indiranagar Fresh Kirana',
        ownerName: 'Private Owner A',
        phone: STORE_A_PHONE,
        passwordHash,
        address: '100 Feet Road, Indiranagar',
        city: 'Bengaluru',
        pincode: '560038',
        upiId: 'private_store_a@upi',
        isOpen: true,
      },
    });

    // Create Store B (Closed store in Koramangala)
    storeB = await prisma.store.create({
      data: {
        name: 'Koramangala Daily Mart',
        ownerName: 'Private Owner B',
        phone: STORE_B_PHONE,
        passwordHash,
        address: '5th Block, Koramangala',
        city: 'Bengaluru',
        pincode: '560034',
        upiId: 'private_store_b@upi',
        isOpen: false,
      },
    });

    // Products for Store A
    // 1. Available & Active
    await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: 'Aashirvaad Superior Atta',
        brand: 'Aashirvaad',
        category: 'Flours',
        unit: 'kg',
        price: 62.0,
        isAvailable: true,
        isActive: true,
      },
    });

    // 2. Available & Active
    await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: 'Tata Tea Gold',
        brand: 'Tata',
        category: 'Beverages',
        unit: 'packet',
        price: 140.0,
        isAvailable: true,
        isActive: true,
      },
    });

    // 3. Out of stock (isAvailable: false, isActive: true) -> MUST be excluded from customer catalogue
    await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: 'Amul Out of Stock Milk',
        brand: 'Amul',
        category: 'Dairy',
        unit: 'packet',
        price: 28.0,
        isAvailable: false,
        isActive: true,
      },
    });

    // 4. Soft-deleted (isActive: false) -> MUST be excluded from customer catalogue
    await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: 'Parle Soft Deleted Biscuit',
        brand: 'Parle',
        category: 'Snacks',
        unit: 'packet',
        price: 10.0,
        isAvailable: true,
        isActive: false,
      },
    });

    // Product for Store B
    await prisma.product.create({
      data: {
        storeId: storeB.id,
        name: 'Store B Exclusive Basmati Rice',
        brand: 'Daawat',
        category: 'Grains',
        unit: 'kg',
        price: 125.0,
        isAvailable: true,
        isActive: true,
      },
    });
  });

  after(async () => {
    // Clean up test products
    await prisma.product.deleteMany({
      where: {
        storeId: { in: [storeA.id, storeB.id] },
      },
    });

    // Clean up test stores
    await prisma.store.deleteMany({
      where: {
        id: { in: [storeA.id, storeB.id] },
      },
    });

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect();
  });

  // 1. Public store discovery without authentication
  test('1. GET /api/stores discovers stores without authentication', async () => {
    const res = await fetch(baseUrl);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.total >= 2);
    assert.ok(body.data.some((s) => s.id === storeA.id));
    assert.ok(body.data.some((s) => s.id === storeB.id));
  });

  // 2. Privacy check: never expose sensitive fields
  test('2. Public store listing strictly omits passwordHash, owner phone, upiId, and private credentials', async () => {
    const res = await fetch(baseUrl);
    const body = await res.json();
    const store = body.data.find((s) => s.id === storeA.id);

    assert.ok(store);
    assert.equal(store.name, 'Indiranagar Fresh Kirana');
    assert.equal(store.city, 'Bengaluru');
    assert.equal(store.pincode, '560038');
    assert.equal(store.isOpen, true);

    // Private fields must be undefined
    assert.equal(store.passwordHash, undefined);
    assert.equal(store.phone, undefined);
    assert.equal(store.ownerName, undefined);
    assert.equal(store.upiId, undefined);
  });

  // 3. Store search by name
  test('3. Store search by name (search=Indiranagar)', async () => {
    const res = await fetch(`${baseUrl}?search=Indiranagar`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(body.data.length >= 1);
    assert.ok(body.data.some((s) => s.id === storeA.id));
    assert.ok(!body.data.some((s) => s.id === storeB.id));
  });

  // 4. Store search/filter by city and pincode
  test('4. Store filter by city and pincode (city=Bengaluru, pincode=560034)', async () => {
    const res = await fetch(`${baseUrl}?city=Bengaluru&pincode=560034`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(body.data.some((s) => s.id === storeB.id));
    assert.ok(!body.data.some((s) => s.id === storeA.id));
  });

  // 5. Store filter by isOpen status
  test('5. Store filter by isOpen status (isOpen=false)', async () => {
    const res = await fetch(`${baseUrl}?isOpen=false`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(body.data.some((s) => s.id === storeB.id && s.isOpen === false));
    assert.ok(!body.data.some((s) => s.id === storeA.id));
  });

  // 6. Pagination and empty search results
  test('6. Pagination parameters work and empty search results return gracefully', async () => {
    // Pagination
    const pageRes = await fetch(`${baseUrl}?page=1&limit=1`);
    assert.equal(pageRes.status, 200);
    const pageBody = await pageRes.json();
    assert.equal(pageBody.data.length, 1);
    assert.equal(pageBody.page, 1);
    assert.equal(pageBody.limit, 1);
    assert.ok(pageBody.totalPages >= 2);

    // Empty search
    const emptyRes = await fetch(`${baseUrl}?search=NonExistentStoreXYZ12345`);
    assert.equal(emptyRes.status, 200);
    const emptyBody = await emptyRes.json();
    assert.equal(emptyBody.data.length, 0);
    assert.equal(emptyBody.total, 0);
  });

  // 7. GET /api/stores/:storeId returns public store details
  test('7. GET /api/stores/:storeId retrieves public details without authentication', async () => {
    const res = await fetch(`${baseUrl}/${storeA.id}`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, storeA.id);
    assert.equal(body.data.name, 'Indiranagar Fresh Kirana');
    assert.equal(body.data.address, '100 Feet Road, Indiranagar');
    assert.equal(body.data.city, 'Bengaluru');
    assert.equal(body.data.pincode, '560038');
    assert.equal(body.data.isOpen, true);

    // Ensure no secret leakage
    assert.equal(body.data.passwordHash, undefined);
    assert.equal(body.data.phone, undefined);
    assert.equal(body.data.ownerName, undefined);
    assert.equal(body.data.upiId, undefined);
  });

  // 8. GET /api/stores/:storeId with invalid or nonexistent storeId
  test('8. GET /api/stores/:storeId returns 400 for invalid UUID and 404 for nonexistent store', async () => {
    // Malformed UUID -> 400
    const malformedRes = await fetch(`${baseUrl}/invalid-uuid-1234`);
    assert.equal(malformedRes.status, 400);
    const malformedBody = await malformedRes.json();
    assert.equal(malformedBody.success, false);
    assert.ok(malformedBody.message.includes('UUID'));

    // Nonexistent valid UUID -> 404
    const nonExistentRes = await fetch(`${baseUrl}/00000000-0000-0000-0000-000000999999`);
    assert.equal(nonExistentRes.status, 404);
    const nonExistentBody = await nonExistentRes.json();
    assert.equal(nonExistentBody.success, false);
    assert.equal(nonExistentBody.message, 'Store not found');
  });

  // 9. Public store catalogue endpoint
  test('9. GET /api/stores/:storeId/catalogue returns store catalogue without authentication', async () => {
    const res = await fetch(`${baseUrl}/${storeA.id}/catalogue`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.store);
    assert.equal(body.store.id, storeA.id);
    assert.equal(body.store.name, 'Indiranagar Fresh Kirana');
    assert.ok(Array.isArray(body.data));
  });

  // 10. Public catalogue strictly excludes inactive and unavailable products
  test('10. Public catalogue strictly excludes inactive (isActive: false) and unavailable (isAvailable: false) products', async () => {
    const res = await fetch(`${baseUrl}/${storeA.id}/catalogue`);
    const body = await res.json();

    assert.equal(body.count, 2); // Only the 2 active & available items
    assert.ok(body.data.some((p) => p.name === 'Aashirvaad Superior Atta'));
    assert.ok(body.data.some((p) => p.name === 'Tata Tea Gold'));

    // Unavailable product must NOT be returned
    assert.ok(!body.data.some((p) => p.name === 'Amul Out of Stock Milk'));

    // Soft-deleted product must NOT be returned
    assert.ok(!body.data.some((p) => p.name === 'Parle Soft Deleted Biscuit'));

    // Prices must be Decimal-safe formatted strings
    const atta = body.data.find((p) => p.name === 'Aashirvaad Superior Atta');
    assert.equal(atta.price, '62.00');
    assert.equal(atta.unit, 'kg');
  });

  // 11. Public catalogue supports search and category filters
  test('11. Public catalogue supports product name search and category filtering', async () => {
    // Search
    const searchRes = await fetch(`${baseUrl}/${storeA.id}/catalogue?search=Tea`);
    assert.equal(searchRes.status, 200);
    const searchBody = await searchRes.json();
    assert.equal(searchBody.count, 1);
    assert.equal(searchBody.data[0].name, 'Tata Tea Gold');

    // Category
    const catRes = await fetch(`${baseUrl}/${storeA.id}/catalogue?category=Flours`);
    assert.equal(catRes.status, 200);
    const catBody = await catRes.json();
    assert.equal(catBody.count, 1);
    assert.equal(catBody.data[0].name, 'Aashirvaad Superior Atta');
  });

  // 12. Strict tenant isolation: never leak cross-store products or fallback to default store
  test('12. Public catalogue strictly enforces tenant isolation (never returns Store B product or fallback)', async () => {
    // Store A catalogue must NOT contain Store B's product
    const resA = await fetch(`${baseUrl}/${storeA.id}/catalogue`);
    const bodyA = await resA.json();
    assert.ok(!bodyA.data.some((p) => p.name === 'Store B Exclusive Basmati Rice'));

    // Store B catalogue contains Store B's product and not Store A's
    const resB = await fetch(`${baseUrl}/${storeB.id}/catalogue`);
    const bodyB = await resB.json();
    assert.equal(bodyB.count, 1);
    assert.equal(bodyB.data[0].name, 'Store B Exclusive Basmati Rice');
    assert.ok(!bodyB.data.some((p) => p.name === 'Aashirvaad Superior Atta'));
  });

  // 13. Public catalogue returns 404 for nonexistent store and 400 for malformed UUID
  test('13. Public catalogue returns 400 for invalid UUID and 404 for nonexistent store', async () => {
    const badUuidRes = await fetch(`${baseUrl}/bad-id/catalogue`);
    assert.equal(badUuidRes.status, 400);

    const nonExistentRes = await fetch(`${baseUrl}/00000000-0000-0000-0000-000000888888/catalogue`);
    assert.equal(nonExistentRes.status, 404);
    const nonExistentBody = await nonExistentRes.json();
    assert.equal(nonExistentBody.message, 'Store not found');
  });

  // 14. Merchant-only catalogue endpoints still require authentication
  test('14. Merchant catalogue endpoints (/api/products) still strictly require authentication (401)', async () => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/products`);
    assert.equal(res.status, 401);

    const postRes = await fetch(`http://127.0.0.1:${server.address().port}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked Item', unit: 'kg', price: 10 }),
    });
    assert.equal(postRes.status, 401);
  });
});

