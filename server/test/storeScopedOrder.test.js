/**
 * Phase E: Store-Scoped Voice Ordering, Cart & Order Creation Test Suite
 *
 * Tests:
 * 1. Store-scoped order understanding (Hindi, Hinglish, English)
 * 2. Multi-store catalogue isolation (same product name, different prices)
 * 3. Products missing or unique to selected store
 * 4. Exclusion of unavailable and soft-deleted products
 * 5. Rejection of invalid, missing, nonexistent, and closed store IDs (no silent DEFAULT_STORE_ID fallback)
 * 6. Quantity extraction and unit conversion in store context
 * 7. Server-side cart pricing calculation (POST /api/orders/calculate)
 * 8. Order creation with PENDING_APPROVAL and UNPAID status (POST /api/orders)
 * 9. Enforcement of server-calculated prices over client values
 * 10. Cross-store product ID rejection
 * 11. Closed store and out-of-stock product rejection
 * 12. Atomic transaction rollback on validation failure
 * 13. Idempotency and duplicate submission prevention
 * 14. Customer order confirmation retrieval (GET /api/orders/:id)
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma, { disconnectPrisma } from '../src/config/prisma.js';
import app from '../src/app.js';
import { parseOrderTranscript } from '../src/services/orderUnderstanding.service.js';
import { calculateOrderPricing, createCustomerOrder } from '../src/services/order.service.js';

describe('CallSaar Phase E: Store-Scoped Voice Ordering, Cart & Order Creation', () => {
  let server;
  let serverUrl;

  let storeA;
  let storeB;
  let storeClosed;

  let prodAAtta;
  let prodASalt;
  let prodAUnavailable;
  let prodADeleted;

  let prodBAtta;
  let prodBOil;

  before(async () => {
    // Start ephemeral server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        serverUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    const passwordHash = await bcrypt.hash('Password123', 6);

    // Create Store A (Open, base price: Atta ₹60.00/kg, Salt ₹25.00/kg)
    storeA = await prisma.store.create({
      data: {
        name: 'Gupta Kirana Store A',
        ownerName: 'Ramesh Gupta',
        phone: '9800000001',
        passwordHash,
        address: 'Shop 10, Sector 14',
        city: 'Gurugram',
        pincode: '122001',
        isOpen: true,
      },
    });

    prodAAtta = await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: 'Aashirvaad Atta',
        category: 'Flours & Grains',
        brand: 'Aashirvaad',
        unit: 'kg',
        price: '60.00',
        isActive: true,
        isAvailable: true,
      },
    });

    prodASalt = await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: 'Tata Salt',
        category: 'Spices & Seasoning',
        brand: 'Tata',
        unit: 'kg',
        price: '25.00',
        isActive: true,
        isAvailable: true,
      },
    });

    prodAUnavailable = await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: 'Amul Butter',
        category: 'Dairy',
        brand: 'Amul',
        unit: '100g',
        price: '52.00',
        isActive: true,
        isAvailable: false, // Out of stock
      },
    });

    prodADeleted = await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: 'Basmati Rice',
        category: 'Rice & Grains',
        brand: 'India Gate',
        unit: 'kg',
        price: '110.00',
        isActive: false, // Soft-deleted
        isAvailable: true,
      },
    });

    // Create Store B (Open, Atta ₹75.00/kg, Fortune Oil ₹160.00/litre)
    storeB = await prisma.store.create({
      data: {
        name: 'Verma Supermarket B',
        ownerName: 'Sunil Verma',
        phone: '9800000002',
        passwordHash,
        address: 'Plot 45, Indiranagar',
        city: 'Bengaluru',
        pincode: '560038',
        isOpen: true,
      },
    });

    prodBAtta = await prisma.product.create({
      data: {
        storeId: storeB.id,
        name: 'Aashirvaad Atta',
        category: 'Flours & Grains',
        brand: 'Aashirvaad',
        unit: 'kg',
        price: '75.00', // Higher price in Store B
        isActive: true,
        isAvailable: true,
      },
    });

    prodBOil = await prisma.product.create({
      data: {
        storeId: storeB.id,
        name: 'Fortune Sunflower Oil',
        category: 'Oils & Ghee',
        brand: 'Fortune',
        unit: 'litre',
        price: '160.00',
        isActive: true,
        isAvailable: true,
      },
    });

    // Create Closed Store
    storeClosed = await prisma.store.create({
      data: {
        name: 'Night Owl Store (Closed)',
        ownerName: 'Deepak Sharma',
        phone: '9800000003',
        passwordHash,
        address: 'Old Railway Road',
        city: 'Gurugram',
        pincode: '122001',
        isOpen: false, // Closed
      },
    });
  });

  after(async () => {
    // Cleanup created test records
    await prisma.orderItem.deleteMany({
      where: {
        order: {
          storeId: { in: [storeA.id, storeB.id, storeClosed.id] },
        },
      },
    });
    await prisma.order.deleteMany({
      where: {
        storeId: { in: [storeA.id, storeB.id, storeClosed.id] },
      },
    });
    await prisma.product.deleteMany({
      where: {
        storeId: { in: [storeA.id, storeB.id, storeClosed.id] },
      },
    });
    await prisma.store.deleteMany({
      where: {
        id: { in: [storeA.id, storeB.id, storeClosed.id] },
      },
    });

    await new Promise((resolve) => server.close(resolve));
    await disconnectPrisma();
  });

  // ==========================================================================
  // 1. STORE-SCOPED ORDER UNDERSTANDING
  // ==========================================================================

  test('1. parseOrderTranscript rejects invalid UUID storeId with 400', async () => {
    await assert.rejects(
      async () => {
        await parseOrderTranscript('2 kg atta', { storeId: 'invalid-not-a-uuid' });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.ok(err.message.includes('Invalid store ID format'));
        return true;
      }
    );
  });

  test('2. parseOrderTranscript rejects missing storeId when allowLegacyFallback is false', async () => {
    await assert.rejects(
      async () => {
        await parseOrderTranscript('2 kg atta', { storeId: null, allowLegacyFallback: false });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.ok(err.message.includes('Store ID is required'));
        return true;
      }
    );
  });

  test('3. parseOrderTranscript returns 404 for nonexistent store UUID', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000999999';
    await assert.rejects(
      async () => {
        await parseOrderTranscript('2 kg atta', { storeId: fakeUuid });
      },
      (err) => {
        assert.equal(err.status, 404);
        assert.ok(err.message.includes('Store not found'));
        return true;
      }
    );
  });

  test('4. parseOrderTranscript rejects closed store with 400', async () => {
    await assert.rejects(
      async () => {
        await parseOrderTranscript('2 kg atta', { storeId: storeClosed.id });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.ok(err.message.includes('Store is currently closed for orders'));
        return true;
      }
    );
  });

  test('5. Multi-store price isolation: Same product name in Store A vs Store B uses respective store price', async () => {
    // Store A: Atta @ ₹60.00
    const resultA = await parseOrderTranscript('2 kg atta', { storeId: storeA.id });
    assert.equal(resultA.items.length, 1);
    assert.equal(resultA.items[0].productId, prodAAtta.id);
    assert.equal(resultA.items[0].unitPrice, '60.00');
    assert.equal(resultA.items[0].lineTotal, '120.00');
    assert.equal(resultA.subtotal, '120.00');
    assert.equal(resultA.storeId, storeA.id);

    // Store B: Atta @ ₹75.00
    const resultB = await parseOrderTranscript('2 kg atta', { storeId: storeB.id });
    assert.equal(resultB.items.length, 1);
    assert.equal(resultB.items[0].productId, prodBAtta.id);
    assert.equal(resultB.items[0].unitPrice, '75.00');
    assert.equal(resultB.items[0].lineTotal, '150.00');
    assert.equal(resultB.subtotal, '150.00');
    assert.equal(resultB.storeId, storeB.id);
  });

  test('6. Products unique to Store B are UNMATCHED in Store A (strict catalogue grounding, no default store fallback)', async () => {
    // Store A does NOT stock Fortune Sunflower Oil
    const resultA = await parseOrderTranscript('1 litre sunflower oil', { storeId: storeA.id });
    assert.equal(resultA.items.length, 1);
    assert.equal(resultA.items[0].status, 'UNMATCHED');
    assert.equal(resultA.items[0].productId, null);
    assert.equal(resultA.items[0].lineTotal, null);
    assert.equal(resultA.subtotal, '0.00');
    assert.equal(resultA.needsClarification, true);

    // Store B DOES stock Fortune Sunflower Oil
    const resultB = await parseOrderTranscript('1 litre sunflower oil', { storeId: storeB.id });
    assert.equal(resultB.items.length, 1);
    assert.equal(resultB.items[0].status, 'MATCHED');
    assert.equal(resultB.items[0].productId, prodBOil.id);
    assert.equal(resultB.items[0].lineTotal, '160.00');
    assert.equal(resultB.subtotal, '160.00');
  });

  test('7. Unavailable and soft-deleted products in store catalogue return UNMATCHED', async () => {
    // Amul Butter is isAvailable: false in Store A
    const butterResult = await parseOrderTranscript('100g amul butter', { storeId: storeA.id });
    assert.equal(butterResult.items[0].status, 'UNMATCHED');
    assert.equal(butterResult.items[0].productId, null);

    // Basmati Rice is isActive: false (soft-deleted) in Store A
    assert.ok(prodADeleted.id);
    const riceResult = await parseOrderTranscript('2 kg basmati rice', { storeId: storeA.id });
    assert.equal(riceResult.items[0].status, 'UNMATCHED');
    assert.equal(riceResult.items[0].productId, null);
  });

  test('8. Multilingual Devanagari Hindi and Hinglish transcript understanding scoped to Store A', async () => {
    // Native Hindi Devanagari
    const hindiResult = await parseOrderTranscript('दो किलो आटा और एक किलो नमक देना', { storeId: storeA.id });
    assert.equal(hindiResult.items.length, 2);
    assert.equal(hindiResult.items[0].productName, 'Aashirvaad Atta');
    assert.equal(hindiResult.items[0].quantity, '2');
    assert.equal(hindiResult.items[0].lineTotal, '120.00');

    assert.equal(hindiResult.items[1].productName, 'Tata Salt');
    assert.equal(hindiResult.items[1].quantity, '1');
    assert.equal(hindiResult.items[1].lineTotal, '25.00');

    assert.equal(hindiResult.subtotal, '145.00');
    assert.equal(hindiResult.needsClarification, false);

    // Equivalent Hinglish
    const hinglishResult = await parseOrderTranscript('Do kilo atta aur ek kilo namak', { storeId: storeA.id });
    assert.equal(hinglishResult.subtotal, '145.00');
    assert.equal(hinglishResult.items.length, 2);
  });

  test('9. Unit conversion in store context (500g atta @ ₹60/kg = ₹30.00)', async () => {
    const result = await parseOrderTranscript('500 gram atta', { storeId: storeA.id });
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].productName, 'Aashirvaad Atta');
    assert.equal(result.items[0].lineTotal, '30.00');
    assert.equal(result.subtotal, '30.00');
  });

  test('10. HTTP POST /api/orders/parse strictly validates storeId and returns structured items with unresolvedItems', async () => {
    // Missing storeId returns 400
    const missingRes = await fetch(`${serverUrl}/api/orders/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: '2 kg atta' }),
    });
    assert.equal(missingRes.status, 400);
    const missingBody = await missingRes.json();
    assert.equal(missingBody.success, false);
    assert.ok(missingBody.message.includes('Store ID is required'));

    // Closed store returns 400
    const closedRes = await fetch(`${serverUrl}/api/orders/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: '2 kg atta', storeId: storeClosed.id }),
    });
    assert.equal(closedRes.status, 400);

    // Valid store returns 200 with structured response
    const validRes = await fetch(`${serverUrl}/api/orders/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: '2 kg atta aur 1 packet biscuit',
        storeId: storeA.id,
      }),
    });
    assert.equal(validRes.status, 200);
    const validBody = await validRes.json();
    assert.equal(validBody.success, true);
    assert.equal(validBody.data.storeId, storeA.id);
    assert.equal(validBody.data.items.length, 2);
    // Atta is matched, biscuit is unmatched in Store A
    assert.equal(validBody.data.unresolvedItems.length, 1);
    assert.equal(validBody.data.unresolvedItems[0].productName, 'biscuit');
  });

  // ==========================================================================
  // 2. SERVER-SIDE PRICING CALCULATION (POST /api/orders/calculate)
  // ==========================================================================

  test('11. POST /api/orders/calculate verifies catalogue items and recalculates subtotal from DB', async () => {
    const res = await fetch(`${serverUrl}/api/orders/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeA.id,
        items: [
          { productId: prodAAtta.id, quantity: 3, unit: 'kg' }, // 3 * 60 = 180.00
          { productId: prodASalt.id, quantity: 2, unit: 'kg' }, // 2 * 25 = 50.00
        ],
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.subtotal, '230.00');
    assert.equal(body.data.items.length, 2);
    assert.equal(body.data.items[0].lineTotal, '180.00');
    assert.equal(body.data.items[1].lineTotal, '50.00');
  });

  test('12. calculateOrderPricing rejects cross-store product ID with 400', async () => {
    // Attempting to calculate Store A order with Store B product (prodBOil)
    await assert.rejects(
      async () => {
        await calculateOrderPricing({
          storeId: storeA.id,
          items: [{ productId: prodBOil.id, quantity: 1, unit: 'litre' }],
        });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.ok(err.message.includes('does not belong to the selected store'));
        return true;
      }
    );
  });

  test('13. calculateOrderPricing rejects out-of-stock product with 400', async () => {
    await assert.rejects(
      async () => {
        await calculateOrderPricing({
          storeId: storeA.id,
          items: [{ productId: prodAUnavailable.id, quantity: 1, unit: '100g' }],
        });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.ok(err.message.includes('currently out of stock'));
        return true;
      }
    );
  });

  test('14. calculateOrderPricing rejects invalid quantity with 400', async () => {
    await assert.rejects(
      async () => {
        await calculateOrderPricing({
          storeId: storeA.id,
          items: [{ productId: prodAAtta.id, quantity: -2, unit: 'kg' }],
        });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.ok(err.message.includes('Quantity must be a positive number'));
        return true;
      }
    );
  });

  // ==========================================================================
  // 3. ORDER CREATION, PERSISTENCE & IDEMPOTENCY (POST /api/orders)
  // ==========================================================================

  test('15. POST /api/orders creates order with PENDING_APPROVAL and UNPAID status', async () => {
    const res = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: storeA.id,
        customerName: 'Anil Kumar',
        customerPhone: '9876543210',
        notes: 'Please pack in eco-friendly bag',
        items: [
          { productId: prodAAtta.id, quantity: 2, unit: 'kg' }, // 2 * 60 = 120
          { productId: prodASalt.id, quantity: 1, unit: 'kg' }, // 1 * 25 = 25
        ],
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    const order = body.data;

    assert.ok(order.id);
    assert.ok(order.orderNumber.startsWith('ORD-'));
    assert.equal(order.storeId, storeA.id);
    assert.equal(order.status, 'PENDING_APPROVAL');
    assert.equal(order.paymentStatus, 'UNPAID');
    assert.equal(order.paymentMethod, 'CASH_ON_PICKUP');
    assert.equal(order.subtotal, '145.00');
    assert.equal(order.items.length, 2);

    // Check item snapshots
    const attaItem = order.items.find((i) => i.productId === prodAAtta.id);
    assert.equal(attaItem.productName, 'Aashirvaad Atta');
    assert.equal(attaItem.quantity, '2');
    assert.equal(attaItem.unitPrice, '60.00');
    assert.equal(attaItem.lineTotal, '120.00');

    // Verify stored in DB
    const dbOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true, customer: true },
    });
    assert.equal(dbOrder.status, 'PENDING_APPROVAL');
    assert.equal(dbOrder.customer.phone, '9876543210');
  });

  test('16. Client-supplied price and total overrides are completely ignored (server determines price)', async () => {
    const res = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeA.id,
        customerName: 'Sneaky Client',
        // Attacker attempts to send ₹1.00 instead of ₹60.00
        items: [{ productId: prodAAtta.id, quantity: 2, unit: 'kg', unitPrice: '1.00', lineTotal: '2.00' }],
        subtotal: '2.00',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    // Server enforced DB price: 2 * ₹60.00 = ₹120.00
    assert.equal(body.data.subtotal, '120.00');
    assert.equal(body.data.items[0].unitPrice, '60.00');
    assert.equal(body.data.items[0].lineTotal, '120.00');
  });

  test('17. POST /api/orders rejects cross-store product ID with 400', async () => {
    const res = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeA.id,
        items: [{ productId: prodBOil.id, quantity: 1, unit: 'litre' }],
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('does not belong to the selected store'));
  });

  test('18. POST /api/orders rejects order to closed store with 400', async () => {
    const res = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeClosed.id,
        items: [{ productId: prodAAtta.id, quantity: 1, unit: 'kg' }],
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.message.includes('closed for orders'));
  });

  test('19. Atomic transaction rollback: Invalid item prevents any rows from being created', async () => {
    const initialOrdersCount = await prisma.order.count();
    const initialItemsCount = await prisma.orderItem.count();

    const res = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: storeA.id,
        customerName: 'Rollback Test',
        items: [
          { productId: prodAAtta.id, quantity: 1, unit: 'kg' }, // valid
          { productId: prodBOil.id, quantity: 1, unit: 'litre' }, // invalid (cross-store)
        ],
      }),
    });

    assert.equal(res.status, 400);

    const finalOrdersCount = await prisma.order.count();
    const finalItemsCount = await prisma.orderItem.count();

    // Verify 0 partial rows persisted
    assert.equal(finalOrdersCount, initialOrdersCount);
    assert.equal(finalItemsCount, initialItemsCount);
  });

  test('20. Duplicate submission idempotency: Same key + same payload returns existing order', async () => {
    const idempotencyKey = 'client-key-unique-001';

    // First submission
    const res1 = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        storeId: storeA.id,
        customerName: 'Idempotency User',
        customerPhone: '9876500001',
        items: [{ productId: prodASalt.id, quantity: 2, unit: 'kg' }],
      }),
    });

    assert.equal(res1.status, 201);
    const body1 = await res1.json();
    const order1 = body1.data;
    assert.ok(order1.id);
    assert.ok(order1.orderNumber);

    // Second repeated submission with identical payload
    const res2 = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        storeId: storeA.id,
        customerName: 'Idempotency User',
        customerPhone: '9876500001',
        items: [{ productId: prodASalt.id, quantity: 2, unit: 'kg' }],
      }),
    });

    assert.equal(res2.status, 200); // 200 OK for idempotent response
    const body2 = await res2.json();
    assert.equal(body2.data.id, order1.id);
    assert.equal(body2.data.orderNumber, order1.orderNumber);
    assert.ok(body2.message.includes('Existing order returned'));
  });

  test('21. Idempotency payload conflict: Same key + different payload returns 409 Conflict', async () => {
    const idempotencyKey = 'client-key-conflict-002';

    // First submission: 2 kg salt
    const res1 = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        storeId: storeA.id,
        customerName: 'Conflict User',
        items: [{ productId: prodASalt.id, quantity: 2, unit: 'kg' }],
      }),
    });

    assert.equal(res1.status, 201);

    // Second submission with SAME key but DIFFERENT items: 5 kg atta
    const res2 = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        storeId: storeA.id,
        customerName: 'Conflict User',
        items: [{ productId: prodAAtta.id, quantity: 5, unit: 'kg' }],
      }),
    });

    assert.equal(res2.status, 409);
    const body2 = await res2.json();
    assert.equal(body2.success, false);
    assert.ok(body2.message.includes('Idempotency conflict'));
  });

  test('22. Concurrent identical requests with same key create exactly one order', async () => {
    const idempotencyKey = `concurrent-${Date.now()}`;
    const initialOrdersCount = await prisma.order.count({ where: { storeId: storeA.id } });

    const payload = {
      storeId: storeA.id,
      customerName: 'Concurrent Customer',
      customerPhone: '9876500002',
      items: [{ productId: prodAAtta.id, quantity: 1, unit: 'kg' }],
    };

    // Fire two identical requests simultaneously
    const [resA, resB] = await Promise.all([
      fetch(`${serverUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(payload),
      }),
      fetch(`${serverUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(payload),
      }),
    ]);

    // One must be 201, the other must be 200 (or both successful)
    assert.ok([200, 201].includes(resA.status));
    assert.ok([200, 201].includes(resB.status));

    const bodyA = await resA.json();
    const bodyB = await resB.json();

    assert.equal(bodyA.data.orderNumber, bodyB.data.orderNumber);
    assert.equal(bodyA.data.id, bodyB.data.id);

    // Exactly 1 new order should exist in DB
    const finalOrdersCount = await prisma.order.count({ where: { storeId: storeA.id } });
    assert.equal(finalOrdersCount, initialOrdersCount + 1);
  });

  test('23. Different idempotency keys create separate legitimate orders', async () => {
    const key1 = `key-legit-A-${Date.now()}`;
    const key2 = `key-legit-B-${Date.now()}`;

    const res1 = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key1 },
      body: JSON.stringify({
        storeId: storeA.id,
        items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
      }),
    });
    assert.equal(res1.status, 201);
    const body1 = await res1.json();

    const res2 = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key2 },
      body: JSON.stringify({
        storeId: storeA.id,
        items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
      }),
    });
    assert.equal(res2.status, 201);
    const body2 = await res2.json();

    assert.notEqual(body1.data.id, body2.data.id);
    assert.notEqual(body1.data.orderNumber, body2.data.orderNumber);
  });

  test('24. Unrelated Prisma uniqueness errors are not masked as duplicate submissions', async () => {
    // Attempting to register a store with duplicate phone throws 409, not treated as idempotency order
    const regRes = await fetch(`${serverUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another Store',
        ownerName: 'Duplicate Owner',
        phone: storeA.phone, // Already registered phone
        password: 'Password123',
        address: 'Market Street',
        city: 'Gurugram',
        pincode: '122001',
      }),
    });

    assert.equal(regRes.status, 409);
    const regBody = await regRes.json();
    assert.ok(regBody.message.includes('already registered'));
  });

  // ==========================================================================
  // 4. PRIVACY AUDIT & PUBLIC ORDER CONFIRMATION
  // ==========================================================================

  test('25. Public order lookup strictly does NOT expose customer phone number', async () => {
    const sensitivePhone = '9988776655';
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Private Customer',
      customerPhone: sensitivePhone,
      items: [{ productId: prodAAtta.id, quantity: 1, unit: 'kg' }],
    });

    const res = await fetch(`${serverUrl}/api/orders/${order.id}`);
    assert.equal(res.status, 200);
    const body = await res.json();

    // Verify phone is NOT in customer object
    assert.equal(body.data.customer?.phone, undefined);
    assert.equal(body.data.customer?.name, 'Private Customer');

    // Verify stringified response contains zero occurrences of the sensitive phone
    const responseString = JSON.stringify(body);
    assert.equal(responseString.includes(sensitivePhone), false);
  });

  test('26. Public order lookup strictly does NOT expose merchant-private phone, ownerName, or UPI information', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Audit Customer',
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });

    const res = await fetch(`${serverUrl}/api/orders/${order.id}`);
    assert.equal(res.status, 200);
    const body = await res.json();

    // Store private fields must be undefined
    assert.equal(body.data.store.phone, undefined);
    assert.equal(body.data.store.ownerName, undefined);
    assert.equal(body.data.store.upiId, undefined);
    assert.equal(body.data.store.passwordHash, undefined);

    // Verify stringified response does NOT leak merchant phone or owner name
    const rawString = JSON.stringify(body);
    assert.equal(rawString.includes(storeA.phone), false);
    assert.equal(rawString.includes(storeA.ownerName), false);
  });

  test('27. Invalid or nonexistent order IDs return safe errors without leaking database internals', async () => {
    // Malformed UUID returns 400
    const badRes = await fetch(`${serverUrl}/api/orders/not-a-valid-uuid`);
    assert.equal(badRes.status, 400);
    const badBody = await badRes.json();
    assert.equal(badBody.success, false);
    assert.equal(badBody.message, 'Invalid order ID format');

    // Nonexistent valid UUID returns 404
    const notFoundRes = await fetch(`${serverUrl}/api/orders/00000000-0000-0000-0000-000000999999`);
    assert.equal(notFoundRes.status, 404);
    const notFoundBody = await notFoundRes.json();
    assert.equal(notFoundBody.success, false);
    assert.equal(notFoundBody.message, 'Order not found');
  });

  test('28. Customer confirmation token authorization: Valid token passes, invalid token rejects with 403', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Tokenized User',
      items: [{ productId: prodAAtta.id, quantity: 1, unit: 'kg' }],
    });

    assert.ok(order.confirmationToken);

    // Accessing with valid token succeeds
    const validRes = await fetch(`${serverUrl}/api/orders/${order.id}?token=${order.confirmationToken}`);
    assert.equal(validRes.status, 200);

    // Accessing with tampered/invalid token rejects with 403 Forbidden
    const invalidRes = await fetch(`${serverUrl}/api/orders/${order.id}?token=invalid_token_12345`);
    assert.equal(invalidRes.status, 403);
    const invalidBody = await invalidRes.json();
    assert.equal(invalidBody.success, false);
    assert.ok(invalidBody.message.includes('Invalid or unauthorized'));
  });

  test('29. Confirmation page receives all necessary public fields', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Verified Order User',
      items: [{ productId: prodAAtta.id, quantity: 2, unit: 'kg' }],
    });

    const res = await fetch(`${serverUrl}/api/orders/${order.id}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data;

    // All required confirmation fields must be present and well-formed
    assert.ok(data.orderNumber.startsWith('ORD-'));
    assert.equal(data.status, 'PENDING_APPROVAL');
    assert.equal(data.paymentStatus, 'UNPAID');
    assert.equal(data.paymentMethod, 'CASH_ON_PICKUP');
    assert.equal(data.subtotal, '120.00');
    assert.ok(data.createdAt);

    // Store public location fields
    assert.equal(data.store.name, 'Gupta Kirana Store A');
    assert.equal(data.store.address, 'Shop 10, Sector 14');
    assert.equal(data.store.city, 'Gurugram');
    assert.equal(data.store.pincode, '122001');

    // Item details
    assert.equal(data.items.length, 1);
    assert.equal(data.items[0].productName, 'Aashirvaad Atta');
    assert.equal(data.items[0].quantity, '2');
    assert.equal(data.items[0].unit, 'kg');
    assert.equal(data.items[0].unitPrice, '60.00');
    assert.equal(data.items[0].lineTotal, '120.00');
  });

  // ==========================================================================
  // 5. CONFIRMATION TOKEN RETRY RECOVERY & HEADER DELIVERY AUDIT
  // ==========================================================================

  test('30. Confirmation token is transmitted through X-Confirmation-Token request header without query string', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Header Token User',
      items: [{ productId: prodAAtta.id, quantity: 1, unit: 'kg' }],
    });

    const targetUrl = `${serverUrl}/api/orders/${order.id}`;
    // Assert target URL contains no query string
    assert.equal(targetUrl.includes('?'), false);

    const res = await fetch(targetUrl, {
      headers: {
        'X-Confirmation-Token': order.confirmationToken,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, order.id);
  });

  test('31. Initial order creation with client-provided confirmation secret returns usable token', async () => {
    const clientSecret = 'client_secret_token_1234567890abcdef1234567890abcdef';
    const key = `client-init-${Date.now()}`;

    const res = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
        'X-Confirmation-Token': clientSecret,
      },
      body: JSON.stringify({
        storeId: storeA.id,
        items: [{ productId: prodASalt.id, quantity: 2, unit: 'kg' }],
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.confirmationToken, clientSecret);

    // Verify confirmation lookup using the client secret in header
    const lookupRes = await fetch(`${serverUrl}/api/orders/${body.data.id}`, {
      headers: {
        'X-Confirmation-Token': clientSecret,
      },
    });
    assert.equal(lookupRes.status, 200);

    // Verify stored in DB as hash, not plaintext
    const dbOrder = await prisma.order.findUnique({ where: { id: body.data.id } });
    assert.notEqual(dbOrder.confirmationTokenHash, clientSecret);
    assert.equal(
      dbOrder.confirmationTokenHash,
      crypto.createHash('sha256').update(clientSecret).digest('hex')
    );
  });

  test('32. Simulated lost response followed by retry returns original order with HTTP 200 and usable confirmation access', async () => {
    const clientSecret = 'retry_secret_abcdef1234567890abcdef1234567890';
    const idempotencyKey = `lost-response-${Date.now()}`;
    const orderPayload = {
      storeId: storeA.id,
      customerName: 'Retry Customer',
      items: [{ productId: prodASalt.id, quantity: 3, unit: 'kg' }],
    };

    // 1. Initial submission succeeds on server
    const res1 = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'X-Confirmation-Token': clientSecret,
      },
      body: JSON.stringify(orderPayload),
    });
    assert.equal(res1.status, 201);
    const body1 = await res1.json();
    const originalOrderId = body1.data.id;

    // 2. Client simulates network disconnect / lost response:
    // Retries with identical Idempotency-Key, identical payload, and identical confirmation secret
    const res2 = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'X-Confirmation-Token': clientSecret,
      },
      body: JSON.stringify(orderPayload),
    });

    assert.equal(res2.status, 200); // 200 OK for idempotent duplicate recovery
    const body2 = await res2.json();
    assert.equal(body2.data.id, originalOrderId);
    assert.equal(body2.data.confirmationToken, clientSecret); // Valid confirmation token recovered!

    // 3. Client uses recovered token to open confirmation page
    const confirmRes = await fetch(`${serverUrl}/api/orders/${originalOrderId}`, {
      headers: {
        'X-Confirmation-Token': body2.data.confirmationToken,
      },
    });
    assert.equal(confirmRes.status, 200);
    const confirmBody = await confirmRes.json();
    assert.equal(confirmBody.data.orderNumber, body1.data.orderNumber);
  });

  test('33. Retry with same key and different confirmation secret returns 409 Conflict', async () => {
    const idempotencyKey = `conflict-secret-${Date.now()}`;
    const orderPayload = {
      storeId: storeA.id,
      items: [{ productId: prodAAtta.id, quantity: 1, unit: 'kg' }],
    };

    // First submission
    const res1 = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'X-Confirmation-Token': 'secret_alpha',
      },
      body: JSON.stringify(orderPayload),
    });
    assert.equal(res1.status, 201);

    // Retry with different secret
    const res2 = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'X-Confirmation-Token': 'secret_bravo_different',
      },
      body: JSON.stringify(orderPayload),
    });

    assert.equal(res2.status, 409);
    const body2 = await res2.json();
    assert.equal(body2.success, false);
    assert.ok(body2.message.includes('confirmation secret does not match'));
  });

  test('34. Retry with same key and different payload still returns 409 Conflict', async () => {
    const idempotencyKey = `conflict-payload-${Date.now()}`;
    const secret = 'consistent_secret_123';

    // First submission
    const res1 = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'X-Confirmation-Token': secret,
      },
      body: JSON.stringify({
        storeId: storeA.id,
        items: [{ productId: prodAAtta.id, quantity: 1, unit: 'kg' }],
      }),
    });
    assert.equal(res1.status, 201);

    // Second submission with modified items
    const res2 = await fetch(`${serverUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'X-Confirmation-Token': secret,
      },
      body: JSON.stringify({
        storeId: storeA.id,
        items: [{ productId: prodASalt.id, quantity: 5, unit: 'kg' }],
      }),
    });

    assert.equal(res2.status, 409);
    const body2 = await res2.json();
    assert.equal(body2.success, false);
    assert.ok(body2.message.includes('different order payload'));
  });

  test('35. Concurrent duplicate submissions with same idempotency key and confirmation secret create exactly one order', async () => {
    const idempotencyKey = `concurrent-secret-${Date.now()}`;
    const secret = 'concurrent_secret_shared';
    const payload = {
      storeId: storeA.id,
      customerName: 'Concurrent Tester',
      items: [{ productId: prodAAtta.id, quantity: 1, unit: 'kg' }],
    };

    const [res1, res2] = await Promise.all([
      fetch(`${serverUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          'X-Confirmation-Token': secret,
        },
        body: JSON.stringify(payload),
      }),
      fetch(`${serverUrl}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          'X-Confirmation-Token': secret,
        },
        body: JSON.stringify(payload),
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [200, 201]);

    const body1 = await res1.json();
    const body2 = await res2.json();

    assert.equal(body1.data.id, body2.data.id);
    assert.equal(body1.data.orderNumber, body2.data.orderNumber);
    assert.equal(body1.data.confirmationToken, secret);
    assert.equal(body2.data.confirmationToken, secret);

    // Verify only one order was written in the database
    const dbOrders = await prisma.order.findMany({
      where: { storeId: storeA.id, idempotencyKey },
    });
    assert.equal(dbOrders.length, 1);
  });

  test('36. Existing confirmation links with query parameter (?token=...) continue working for backward compatibility', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Legacy Link Customer',
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });

    assert.ok(order.confirmationToken);

    // Legacy query parameter succeeds
    const legacyRes = await fetch(`${serverUrl}/api/orders/${order.id}?token=${order.confirmationToken}`);
    assert.equal(legacyRes.status, 200);
    const legacyBody = await legacyRes.json();
    assert.equal(legacyBody.data.id, order.id);

    // Invalid query parameter fails with 403
    const badRes = await fetch(`${serverUrl}/api/orders/${order.id}?token=bad_token_999`);
    assert.equal(badRes.status, 403);
  });
});
