import { test, describe, after, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { generateToken } from '../src/services/auth.service.js';

describe('OrderSaathi Phase C1: Store-Scoped Product Catalogue Backend', () => {
  let server;
  let baseUrl;

  let storeA;
  let storeB;
  let tokenA;
  let tokenB;

  const TEST_STORE_A_PHONE = '9200000001';
  const TEST_STORE_B_PHONE = '9200000002';

  before(async () => {
    // Start temporary test server on an available random port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/products`;
        resolve();
      });
    });

    // Clean up any lingering test records
    await prisma.product.deleteMany({
      where: {
        store: {
          phone: { in: [TEST_STORE_A_PHONE, TEST_STORE_B_PHONE] },
        },
      },
    });
    await prisma.store.deleteMany({
      where: { phone: { in: [TEST_STORE_A_PHONE, TEST_STORE_B_PHONE] } },
    });

    const passwordHash = await bcrypt.hash('TestPass123', 10);

    // Create Store A
    storeA = await prisma.store.create({
      data: {
        name: 'Store Alpha Mart',
        ownerName: 'Alpha Owner',
        phone: TEST_STORE_A_PHONE,
        passwordHash,
        address: 'Alpha Complex, Indiranagar',
        city: 'Bengaluru',
        pincode: '560038',
        upiId: 'alpha@upi',
        isOpen: true,
      },
    });

    // Create Store B
    storeB = await prisma.store.create({
      data: {
        name: 'Store Beta Kirana',
        ownerName: 'Beta Owner',
        phone: TEST_STORE_B_PHONE,
        passwordHash,
        address: 'Beta Circle, Koramangala',
        city: 'Bengaluru',
        pincode: '560034',
        upiId: 'beta@upi',
        isOpen: true,
      },
    });

    // Generate JWT auth tokens for both stores
    tokenA = generateToken(storeA);
    tokenB = generateToken(storeB);
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

  // 1. Unauthenticated product access is rejected
  test('1. Unauthenticated product access is rejected with 401 Unauthorized', async () => {
    // GET /api/products
    const getRes = await fetch(baseUrl);
    assert.equal(getRes.status, 401);
    const getBody = await getRes.json();
    assert.equal(getBody.success, false);
    assert.ok(getBody.message.includes('Authentication required'));

    // POST /api/products
    const postRes = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rice', unit: 'kg', price: 60 }),
    });
    assert.equal(postRes.status, 401);

    // GET /api/products/:id
    const getByIdRes = await fetch(`${baseUrl}/00000000-0000-0000-0000-000000000001`);
    assert.equal(getByIdRes.status, 401);

    // PATCH /api/products/:id
    const patchRes = await fetch(`${baseUrl}/00000000-0000-0000-0000-000000000001`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 70 }),
    });
    assert.equal(patchRes.status, 401);

    // DELETE /api/products/:id
    const delRes = await fetch(`${baseUrl}/00000000-0000-0000-0000-000000000001`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 401);
  });

  // 2. Authenticated store can create a product
  let storeAProduct1;
  test('2. Authenticated store can create a product', async () => {
    const payload = {
      name: 'Daawat Basmati Rice',
      description: 'Rozana Super Long Grain Basmati',
      category: 'Grains & Rice',
      brand: 'Daawat',
      unit: 'kg',
      price: 110.5,
      isAvailable: true,
    };

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.id);
    assert.equal(body.data.name, 'Daawat Basmati Rice');
    assert.equal(body.data.brand, 'Daawat');
    assert.equal(body.data.unit, 'kg');
    assert.equal(body.data.price.toString(), '110.5'); // Decimal-safe
    assert.equal(body.data.isAvailable, true);
    assert.equal(body.data.isActive, true);

    storeAProduct1 = body.data;
  });

  // 3. Product automatically receives the authenticated storeId
  test('3. Product automatically receives the authenticated storeId', async () => {
    assert.ok(storeAProduct1);
    assert.equal(storeAProduct1.storeId, storeA.id);

    // Verify directly in PostgreSQL database that storeId is storeA.id
    const dbRecord = await prisma.product.findUnique({
      where: { id: storeAProduct1.id },
    });
    assert.ok(dbRecord);
    assert.equal(dbRecord.storeId, storeA.id);
  });

  // 4. Supplying another storeId cannot create a cross-store product
  test('4. Supplying another storeId cannot create a cross-store product and returns 400', async () => {
    const maliciousPayload = {
      name: 'Hacked Item For Store B',
      unit: 'packet',
      price: 50,
      storeId: storeB.id, // Store A attempting to inject Store B's storeId
    };

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify(maliciousPayload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('storeId'));

    // Verify in database that no product was created for Store B
    const rogueProduct = await prisma.product.findFirst({
      where: {
        name: 'Hacked Item For Store B',
        storeId: storeB.id,
      },
    });
    assert.equal(rogueProduct, null);
  });

  // 5. Store A can list only Store A products
  let storeBProduct1;
  test('5. Store A lists only Store A products with search and category filters', async () => {
    // Create a product for Store B
    const storeBPayload = {
      name: 'Tata Sampann Toor Dal',
      category: 'Dals & Pulses',
      brand: 'Tata',
      unit: 'kg',
      price: 165.0,
      isAvailable: true,
    };

    const resB = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify(storeBPayload),
    });
    assert.equal(resB.status, 201);
    const bodyB = await resB.json();
    storeBProduct1 = bodyB.data;

    // Create a second product for Store A
    await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Aashirvaad Shudh Chakki Atta',
        category: 'Flours',
        brand: 'Aashirvaad',
        unit: 'kg',
        price: 58.0,
      }),
    });

    // Store A queries its products
    const listRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(listRes.status, 200);
    const listBody = await listRes.json();
    assert.equal(listBody.success, true);
    assert.equal(listBody.count, 2);
    assert.ok(listBody.data.every((p) => p.storeId === storeA.id));
    assert.ok(!listBody.data.some((p) => p.name === 'Tata Sampann Toor Dal'));

    // Test search filter
    const searchRes = await fetch(`${baseUrl}?search=Basmati`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(searchRes.status, 200);
    const searchBody = await searchRes.json();
    assert.equal(searchBody.count, 1);
    assert.equal(searchBody.data[0].name, 'Daawat Basmati Rice');

    // Test category filter
    const catRes = await fetch(`${baseUrl}?category=Flours`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(catRes.status, 200);
    const catBody = await catRes.json();
    assert.equal(catBody.count, 1);
    assert.equal(catBody.data[0].name, 'Aashirvaad Shudh Chakki Atta');
  });

  // 6. Store A cannot read Store B's product
  test('6. Store A cannot read Store B product and receives 404 Not Found', async () => {
    const res = await fetch(`${baseUrl}/${storeBProduct1.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, 'Product not found');
  });

  // 7. Store A cannot update Store B's product
  test('7. Store A cannot update Store B product and receives 404 Not Found', async () => {
    const res = await fetch(`${baseUrl}/${storeBProduct1.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ price: 10.0 }),
    });

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, 'Product not found');

    // Verify Store B's product in DB was NOT modified
    const checkProduct = await prisma.product.findUnique({
      where: { id: storeBProduct1.id },
    });
    assert.equal(checkProduct.price.toString(), '165');
  });

  // 8. Store A cannot soft-delete Store B's product
  test('8. Store A cannot soft-delete Store B product and receives 404 Not Found', async () => {
    const res = await fetch(`${baseUrl}/${storeBProduct1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, 'Product not found');

    // Verify Store B product remains active in DB
    const checkProduct = await prisma.product.findUnique({
      where: { id: storeBProduct1.id },
    });
    assert.equal(checkProduct.isActive, true);
  });

  // 9. Product updates work for the owning store
  test('9. Product updates succeed for the owning store with Decimal-safe pricing', async () => {
    const updatePayload = {
      price: 125.75,
      description: 'Updated Basmati Rice Special Harvest',
      brand: 'Daawat Heritage',
    };

    const res = await fetch(`${baseUrl}/${storeAProduct1.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify(updatePayload),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.price.toString(), '125.75');
    assert.equal(body.data.description, 'Updated Basmati Rice Special Harvest');
    assert.equal(body.data.brand, 'Daawat Heritage');
    assert.equal(body.data.name, 'Daawat Basmati Rice'); // Unchanged
  });

  // 10. Availability can be toggled
  test('10. Store can toggle product availability (isAvailable: false -> true)', async () => {
    // Toggle to false
    const res1 = await fetch(`${baseUrl}/${storeAProduct1.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ isAvailable: false }),
    });

    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.data.isAvailable, false);

    // Toggle back to true
    const res2 = await fetch(`${baseUrl}/${storeAProduct1.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ isAvailable: true }),
    });

    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.data.isAvailable, true);
  });

  // 11. Soft-deleted products are excluded from default listing
  test('11. Soft-deleted products are excluded from default listing and fetch returns 404', async () => {
    // Create a temporary product for Store A
    const createRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Temporary Biscuit Packet',
        unit: 'packet',
        price: 20.0,
      }),
    });
    assert.equal(createRes.status, 201);
    const createdItem = (await createRes.json()).data;

    // Soft delete the product
    const delRes = await fetch(`${baseUrl}/${createdItem.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(delRes.status, 200);
    const delBody = await delRes.json();
    assert.equal(delBody.success, true);
    assert.ok(delBody.message.includes('deleted'));

    // Verify in DB that product still exists with isActive = false (not physically deleted)
    const dbRecord = await prisma.product.findUnique({
      where: { id: createdItem.id },
    });
    assert.ok(dbRecord, 'Product should still exist in database for historical OrderItem integrity');
    assert.equal(dbRecord.isActive, false);

    // Verify GET /api/products does not include soft-deleted product
    const listRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const listBody = await listRes.json();
    assert.ok(!listBody.data.some((p) => p.id === createdItem.id));

    // Verify GET /api/products/:id returns 404 for soft-deleted product
    const getRes = await fetch(`${baseUrl}/${createdItem.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(getRes.status, 404);
  });

  // 12. Invalid names, units, prices, and IDs are rejected
  test('12. Validation rejects empty names, missing units, non-positive prices, invalid UUIDs, and disallowed fields', async () => {
    // Empty name
    const emptyNameRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: '   ', unit: 'kg', price: 50 }),
    });
    assert.equal(emptyNameRes.status, 400);

    // Missing unit
    const missingUnitRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: 'Atta', price: 50 }),
    });
    assert.equal(missingUnitRes.status, 400);

    // Negative price
    const negPriceRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: 'Atta', unit: 'kg', price: -50 }),
    });
    assert.equal(negPriceRes.status, 400);

    // Zero price
    const zeroPriceRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: 'Atta', unit: 'kg', price: 0 }),
    });
    assert.equal(zeroPriceRes.status, 400);

    // Invalid non-numeric price
    const invalidPriceRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ name: 'Atta', unit: 'kg', price: 'fifty' }),
    });
    assert.equal(invalidPriceRes.status, 400);

    // Invalid UUID in GET
    const invalidUuidRes = await fetch(`${baseUrl}/not-a-valid-uuid`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(invalidUuidRes.status, 400);

    // Empty body in PATCH
    const emptyPatchRes = await fetch(`${baseUrl}/${storeAProduct1.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(emptyPatchRes.status, 400);

    // Disallowed storeId in PATCH
    const storeIdPatchRes = await fetch(`${baseUrl}/${storeAProduct1.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ storeId: storeB.id }),
    });
    assert.equal(storeIdPatchRes.status, 400);

    // Disallowed id in PATCH
    const idPatchRes = await fetch(`${baseUrl}/${storeAProduct1.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000000' }),
    });
    assert.equal(idPatchRes.status, 400);

    // Disallowed passwordHash in POST
    const passwordHashRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        name: 'Oil',
        unit: 'litre',
        price: 150,
        passwordHash: 'hacked_hash',
      }),
    });
    assert.equal(passwordHashRes.status, 400);
  });
});
