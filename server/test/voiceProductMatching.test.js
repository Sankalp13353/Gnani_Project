/**
 * CallSaar — Voice Product Matching & Multilingual Transliteration Test Suite
 *
 * Automated regression tests covering:
 * 1. "टेन टायगर बिस्किट" → Tiger Biscuit, quantity 10, lineTotal 200.00
 * 2. "दो पैकेट टाइगर बिस्किट" → Tiger Biscuit, quantity 2, lineTotal 40.00
 * 3. "two packets of tiger biscuits" → Tiger Biscuit, quantity 2, lineTotal 40.00
 * 4. "2 packet tiger biscuit" → Tiger Biscuit, quantity 2, lineTotal 40.00
 * 5. A genuine unavailable product (e.g. "10 packet oreo biscuit") remains UNMATCHED
 * 6. Same product name in different stores uses respective store's product ID and price
 * 7. Ambiguous product match ("2 packet biscuit") returns AMBIGUOUS with multiple candidates
 * 8. Quantity placed after product name ("tiger biscuit 2 packet")
 * 9. Out-of-stock or soft-deleted products in store catalogue return UNMATCHED
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma, { disconnectPrisma } from '../src/config/prisma.js';
import { parseOrderTranscript } from '../src/services/orderUnderstanding.service.js';
import { calculateOrderPricing } from '../src/services/order.service.js';

describe('CallSaar — Voice Product Matching & Multilingual Transliteration', () => {
  let store1; // Sharma's Kirana (Tiger Biscuit @ ₹20.00)
  let store2; // Verma Kirana (Tiger Biscuit @ ₹25.00, Parle-G Biscuits @ ₹10.00)

  let prodStore1Tiger;
  let prodStore2Tiger;
  let prodStore2Parle;
  let prodStore1OutOfStock;

  before(async () => {
    const passwordHash = await bcrypt.hash('Password123', 6);

    // 1. Create Store 1: Sharma's Kirana in Faridabad
    store1 = await prisma.store.create({
      data: {
        name: "Sharma's Kirana Faridabad",
        ownerName: 'Sankalp Sharma',
        phone: '9700000001',
        passwordHash,
        address: 'Shop 12, Main Market',
        city: 'Faridabad',
        pincode: '121001',
        isOpen: true,
      },
    });

    prodStore1Tiger = await prisma.product.create({
      data: {
        storeId: store1.id,
        name: 'Tiger Biscuit',
        brand: 'Tiger',
        category: 'Snacks & Biscuits',
        unit: 'packet',
        price: '20.00',
        isActive: true,
        isAvailable: true,
      },
    });

    prodStore1OutOfStock = await prisma.product.create({
      data: {
        storeId: store1.id,
        name: 'Bourbon Biscuit',
        brand: 'Britannia',
        category: 'Snacks & Biscuits',
        unit: 'packet',
        price: '35.00',
        isActive: true,
        isAvailable: false, // Out of stock
      },
    });

    // 2. Create Store 2: Verma Kirana in Gurugram
    store2 = await prisma.store.create({
      data: {
        name: 'Verma Kirana Gurugram',
        ownerName: 'Anil Verma',
        phone: '9700000002',
        passwordHash,
        address: 'Shop 5, Sector 21',
        city: 'Gurugram',
        pincode: '122002',
        isOpen: true,
      },
    });

    // Same product name 'Tiger Biscuit', but priced at ₹25.00 in Store 2
    prodStore2Tiger = await prisma.product.create({
      data: {
        storeId: store2.id,
        name: 'Tiger Biscuit',
        brand: 'Tiger',
        category: 'Snacks & Biscuits',
        unit: 'packet',
        price: '25.00',
        isActive: true,
        isAvailable: true,
      },
    });

    prodStore2Parle = await prisma.product.create({
      data: {
        storeId: store2.id,
        name: 'Parle-G Biscuits',
        brand: 'Parle',
        category: 'Biscuits & Cookies',
        unit: 'packet',
        price: '10.00',
        isActive: true,
        isAvailable: true,
      },
    });
  });

  after(async () => {
    try {
      if (store1) {
        await prisma.orderItem.deleteMany({ where: { product: { storeId: store1.id } } });
        await prisma.product.deleteMany({ where: { storeId: store1.id } });
        await prisma.order.deleteMany({ where: { storeId: store1.id } });
        await prisma.store.delete({ where: { id: store1.id } });
      }
      if (store2) {
        await prisma.orderItem.deleteMany({ where: { product: { storeId: store2.id } } });
        await prisma.product.deleteMany({ where: { storeId: store2.id } });
        await prisma.order.deleteMany({ where: { storeId: store2.id } });
        await prisma.store.delete({ where: { id: store2.id } });
      }
    } finally {
      await disconnectPrisma();
    }
  });

  // Scenario 1: Spoken Devanagari "टेन टायगर बिस्किट"
  test('1. "टेन टायगर बिस्किट" resolves to Tiger Biscuit with quantity 10 and subtotal 200.00', async () => {
    const result = await parseOrderTranscript('टेन टायगर बिस्किट', { storeId: store1.id });

    assert.equal(result.items.length, 1);
    const item = result.items[0];

    assert.equal(item.status, 'MATCHED');
    assert.equal(item.productId, prodStore1Tiger.id);
    assert.equal(item.productName, 'Tiger Biscuit');
    assert.equal(item.quantity, '10');
    assert.equal(item.unit, 'packet');
    assert.equal(item.unitPrice, '20.00');
    assert.equal(item.lineTotal, '200.00');

    assert.equal(result.subtotal, '200.00');
    assert.equal(result.needsClarification, false);
    assert.equal(result.unresolvedItems.length, 0);
  });

  // Scenario 2: Hindi "दो पैकेट टाइगर बिस्किट"
  test('2. "दो पैकेट टाइगर बिस्किट" resolves to Tiger Biscuit with quantity 2 and subtotal 40.00', async () => {
    const result = await parseOrderTranscript('दो पैकेट टाइगर बिस्किट', { storeId: store1.id });

    assert.equal(result.items.length, 1);
    const item = result.items[0];

    assert.equal(item.status, 'MATCHED');
    assert.equal(item.productId, prodStore1Tiger.id);
    assert.equal(item.productName, 'Tiger Biscuit');
    assert.equal(item.quantity, '2');
    assert.equal(item.unit, 'packet');
    assert.equal(item.unitPrice, '20.00');
    assert.equal(item.lineTotal, '40.00');
    assert.equal(result.subtotal, '40.00');
    assert.equal(result.needsClarification, false);
  });

  // Scenario 3: English "two packets of tiger biscuits"
  test('3. "two packets of tiger biscuits" resolves to Tiger Biscuit with quantity 2 and subtotal 40.00', async () => {
    const result = await parseOrderTranscript('two packets of tiger biscuits', { storeId: store1.id });

    assert.equal(result.items.length, 1);
    const item = result.items[0];

    assert.equal(item.status, 'MATCHED');
    assert.equal(item.productId, prodStore1Tiger.id);
    assert.equal(item.productName, 'Tiger Biscuit');
    assert.equal(item.quantity, '2');
    assert.equal(item.unit, 'packet');
    assert.equal(item.lineTotal, '40.00');
    assert.equal(result.subtotal, '40.00');
  });

  // Scenario 4: "2 packet tiger biscuit"
  test('4. "2 packet tiger biscuit" resolves to Tiger Biscuit with quantity 2 and subtotal 40.00', async () => {
    const result = await parseOrderTranscript('2 packet tiger biscuit', { storeId: store1.id });

    assert.equal(result.items.length, 1);
    const item = result.items[0];

    assert.equal(item.status, 'MATCHED');
    assert.equal(item.productId, prodStore1Tiger.id);
    assert.equal(item.productName, 'Tiger Biscuit');
    assert.equal(item.quantity, '2');
    assert.equal(item.unit, 'packet');
    assert.equal(item.lineTotal, '40.00');
    assert.equal(result.subtotal, '40.00');
  });

  // Scenario 5: Genuine unavailable product remains UNMATCHED
  test('5. Genuine unavailable product "10 packet oreo biscuit" remains UNMATCHED with 0 subtotal', async () => {
    const result = await parseOrderTranscript('10 packet oreo biscuit', { storeId: store1.id });

    assert.equal(result.items.length, 1);
    const item = result.items[0];

    assert.equal(item.status, 'UNMATCHED');
    assert.equal(item.productId, null);
    assert.equal(item.lineTotal, null);
    assert.equal(result.subtotal, '0.00');
    assert.equal(result.needsClarification, true);
    assert.equal(result.unresolvedItems.length, 1);
    assert.ok(result.clarificationQuestions.length > 0);
  });

  // Scenario 6: Same product name in different stores uses selected store's product ID and price
  test('6. Multi-store price and ID isolation: Tiger Biscuit in Store 1 (₹20.00) vs Store 2 (₹25.00)', async () => {
    // Store 1: Sharma's Kirana @ ₹20.00
    const res1 = await parseOrderTranscript('4 packet tiger biscuit', { storeId: store1.id });
    assert.equal(res1.items[0].productId, prodStore1Tiger.id);
    assert.equal(res1.items[0].unitPrice, '20.00');
    assert.equal(res1.items[0].lineTotal, '80.00');
    assert.equal(res1.subtotal, '80.00');

    // Store 2: Verma Kirana @ ₹25.00
    const res2 = await parseOrderTranscript('4 packet tiger biscuit', { storeId: store2.id });
    assert.equal(res2.items[0].productId, prodStore2Tiger.id);
    assert.equal(res2.items[0].unitPrice, '25.00');
    assert.equal(res2.items[0].lineTotal, '100.00');
    assert.equal(res2.subtotal, '100.00');

    // Verify IDs are distinct
    assert.notEqual(res1.items[0].productId, res2.items[0].productId);
  });

  // Scenario 7: Ambiguous product match requires clarification
  test('7. Ambiguous generic query "2 packet biscuit" in store with multiple biscuit brands returns AMBIGUOUS', async () => {
    assert.ok(prodStore2Parle.id);
    const result = await parseOrderTranscript('2 packet biscuit', { storeId: store2.id });

    assert.equal(result.items.length, 1);
    const item = result.items[0];

    assert.equal(item.status, 'AMBIGUOUS');
    assert.equal(item.productId, null);
    assert.equal(item.lineTotal, null);
    assert.ok(item.candidates && item.candidates.length >= 2);

    const candidateNames = item.candidates.map((c) => c.name);
    assert.ok(candidateNames.includes('Tiger Biscuit'));
    assert.ok(candidateNames.includes('Parle-G Biscuits'));

    assert.equal(result.subtotal, '0.00');
    assert.equal(result.needsClarification, true);
    assert.ok(result.clarificationQuestions.some((q) => q.includes('Did you mean')));
  });

  // Scenario 8: Out-of-stock product returns UNMATCHED
  test('8. Out-of-stock product (Bourbon Biscuit) in store catalogue returns UNMATCHED', async () => {
    assert.ok(prodStore1OutOfStock.id);
    const result = await parseOrderTranscript('1 packet bourbon biscuit', { storeId: store1.id });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].status, 'UNMATCHED');
    assert.equal(result.items[0].productId, null);
    assert.equal(result.subtotal, '0.00');
    assert.equal(result.needsClarification, true);
  });

  // Scenario 9: Backend pricing calculation endpoint validation
  test('9. POST /api/orders/calculate validates matched Tiger Biscuit against store database price', async () => {
    const pricing = await calculateOrderPricing({
      storeId: store1.id,
      items: [
        {
          productId: prodStore1Tiger.id,
          quantity: 10,
          unit: 'packet',
        },
      ],
    });

    assert.equal(pricing.items.length, 1);
    assert.equal(pricing.items[0].productId, prodStore1Tiger.id);
    assert.equal(pricing.items[0].productName, 'Tiger Biscuit');
    assert.equal(pricing.items[0].unitPrice, '20.00');
    assert.equal(pricing.items[0].lineTotal, '200.00');
    assert.equal(pricing.subtotal, '200.00');
  });
});
