import { test, describe, after, before } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import { createOrder, listOrders } from '../src/services/order.service.js';
import { listActiveProducts } from '../src/services/product.service.js';

describe('CallSaar Phase A: Multi-Store Database Architecture', () => {
  const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';
  const TEST_STORE_2_ID = '00000000-0000-0000-0000-000000000002';
  let testCustomer = null;

  before(async () => {
    // Ensure test customer exists
    testCustomer = await prisma.customer.create({
      data: {
        name: 'Phase A Test Customer',
        phone: '9999988888',
      },
    });
  });

  after(async () => {
    // Clean up test orders, products, stores, customers
    if (testCustomer) {
      await prisma.orderItem.deleteMany({
        where: { order: { customerId: testCustomer.id } },
      });
      await prisma.order.deleteMany({
        where: { customerId: testCustomer.id },
      });
      await prisma.customer.delete({
        where: { id: testCustomer.id },
      });
    }

    // Clean up store 2 products and store
    await prisma.product.deleteMany({
      where: { storeId: TEST_STORE_2_ID },
    });
    await prisma.store.deleteMany({
      where: { id: TEST_STORE_2_ID },
    });

    await prisma.$disconnect();
  });

  // 1. Verify Store model and Default Demo Store
  test('1. Default Store exists with correct attributes and constraints', async () => {
    const store = await prisma.store.findUnique({
      where: { id: DEFAULT_STORE_ID },
    });

    assert.ok(store, 'Default store should exist');
    assert.equal(store.id, DEFAULT_STORE_ID);
    assert.equal(store.name, 'CallSaar Kirana Store');
    assert.equal(store.ownerName, 'Ramesh Kumar');
    assert.equal(store.phone, '9876543210');
    assert.equal(store.city, 'Bengaluru');
    assert.equal(store.pincode, '560001');
    assert.equal(store.upiId, 'callsaar@upi');
    assert.equal(store.isOpen, true);
    assert.ok(store.createdAt instanceof Date);
    assert.ok(store.updatedAt instanceof Date);
  });

  // 2. Multi-Store Creation and Phone Uniqueness
  test('2. Can create a second independent Store and enforces phone uniqueness', async () => {
    const store2 = await prisma.store.create({
      data: {
        id: TEST_STORE_2_ID,
        name: 'Gupta General Store',
        ownerName: 'Sunil Gupta',
        phone: '9811122233',
        passwordHash: '$2b$10$hashedPasswordPlaceholderForStoreTwo',
        address: 'Shop No. 12, Indiranagar 100ft Road',
        city: 'Bengaluru',
        pincode: '560038',
        upiId: 'guptastore@okhdfcbank',
        isOpen: true,
      },
    });

    assert.equal(store2.id, TEST_STORE_2_ID);
    assert.equal(store2.name, 'Gupta General Store');

    // Phone uniqueness constraint check
    await assert.rejects(
      async () => {
        await prisma.store.create({
          data: {
            name: 'Duplicate Phone Store',
            ownerName: 'Another Owner',
            phone: '9811122233', // Duplicate
            passwordHash: 'dummy',
            address: 'Somewhere',
            city: 'Bengaluru',
            pincode: '560001',
          },
        });
      },
      (err) => {
        assert.ok(err.message.includes('Unique constraint failed') || err.code === 'P2002');
        return true;
      }
    );
  });

  // 3. Product Store Scoping and Availability
  test('3. Products are strictly store-scoped and support availability toggle', async () => {
    // Verify default store products
    const store1Products = await listActiveProducts({ storeId: DEFAULT_STORE_ID });
    assert.ok(store1Products.length >= 8, 'Default store should have seeded products');
    assert.ok(store1Products.every((p) => p.storeId === DEFAULT_STORE_ID));
    assert.ok(store1Products.every((p) => p.isAvailable === true));

    // Create product specifically for Store 2
    const store2Product = await prisma.product.create({
      data: {
        storeId: TEST_STORE_2_ID,
        name: 'Patanjali Chakki Atta',
        brand: 'Patanjali',
        category: 'Staples & Grains',
        unit: 'kg',
        price: 48.00,
        isAvailable: true,
        isActive: true,
      },
    });

    // Query Store 2 products
    const store2Products = await listActiveProducts({ storeId: TEST_STORE_2_ID });
    assert.equal(store2Products.length, 1);
    assert.equal(store2Products[0].name, 'Patanjali Chakki Atta');
    assert.equal(store2Products[0].price.toString(), '48');

    // Query Store 1 does not return Store 2's product
    const store1Recheck = await listActiveProducts({ storeId: DEFAULT_STORE_ID });
    assert.ok(!store1Recheck.some((p) => p.name === 'Patanjali Chakki Atta'));

    // Toggle availability
    const unavailable = await prisma.product.update({
      where: { id: store2Product.id },
      data: { isAvailable: false },
    });
    assert.equal(unavailable.isAvailable, false);
  });

  // 4. Order Lifecycle, Store Foreign Key, and Safe Defaults
  test('4. Order lifecycle defaults to PENDING_APPROVAL and UNPAID with store link', async () => {
    const orderNumber = `TEST-ORD-${Date.now()}`;
    const order = await createOrder({
      orderNumber,
      storeId: DEFAULT_STORE_ID,
      customerId: testCustomer.id,
      subtotal: '110.00',
      items: [
        {
          productName: 'Aashirvaad Atta',
          quantity: '2.00',
          unit: 'kg',
          unitPrice: '55.00',
          lineTotal: '110.00',
        },
      ],
    });

    assert.equal(order.storeId, DEFAULT_STORE_ID);
    assert.equal(order.customerId, testCustomer.id);
    assert.equal(order.status, 'PENDING_APPROVAL');
    assert.equal(order.paymentStatus, 'UNPAID');
    assert.equal(order.paymentMethod, 'CASH_ON_PICKUP');
    assert.equal(order.subtotal.toString(), '110');
    assert.equal(order.items.length, 1);
    assert.equal(order.items[0].productName, 'Aashirvaad Atta');
    assert.equal(order.items[0].unitPrice.toString(), '55');
    assert.equal(order.items[0].lineTotal.toString(), '110');
  });

  // 5. Order State Machine Transition: Acceptance, Preparation, Pickup, and In-Person Payment
  test('5. Order transitions through full lifecycle: ACCEPTED -> PREPARING -> READY_FOR_PICKUP -> COMPLETED with PAID', async () => {
    const orderNumber = `LIFECYCLE-ORD-${Date.now()}`;
    const initialOrder = await createOrder({
      orderNumber,
      storeId: DEFAULT_STORE_ID,
      customerId: testCustomer.id,
      subtotal: '45.00',
      items: [
        {
          productName: 'Maggi Noodles',
          quantity: '3.00',
          unit: 'packet',
          unitPrice: '15.00',
          lineTotal: '45.00',
        },
      ],
    });

    assert.equal(initialOrder.status, 'PENDING_APPROVAL');

    // 1. Shopkeeper manually accepts order
    const acceptedAt = new Date();
    const acceptedOrder = await prisma.order.update({
      where: { id: initialOrder.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt,
      },
    });
    assert.equal(acceptedOrder.status, 'ACCEPTED');
    assert.ok(acceptedOrder.acceptedAt instanceof Date);

    // 2. Shopkeeper starts packing
    const preparingOrder = await prisma.order.update({
      where: { id: initialOrder.id },
      data: { status: 'PREPARING' },
    });
    assert.equal(preparingOrder.status, 'PREPARING');

    // 3. Order is packed and marked ready for pickup
    const readyAt = new Date();
    const readyOrder = await prisma.order.update({
      where: { id: initialOrder.id },
      data: {
        status: 'READY_FOR_PICKUP',
        readyAt,
      },
    });
    assert.equal(readyOrder.status, 'READY_FOR_PICKUP');
    assert.ok(readyOrder.readyAt instanceof Date);
    assert.equal(readyOrder.paymentStatus, 'UNPAID', 'Payment remains UNPAID until in-store collection');

    // 4. Customer visits store, collects items, and pays in person (CASH or UPI)
    const completedAt = new Date();
    const completedOrder = await prisma.order.update({
      where: { id: initialOrder.id },
      data: {
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        completedAt,
      },
    });
    assert.equal(completedOrder.status, 'COMPLETED');
    assert.equal(completedOrder.paymentStatus, 'PAID');
    assert.ok(completedOrder.completedAt instanceof Date);
  });

  // 6. Shopkeeper Rejection Flow
  test('6. Order rejection flow sets status to REJECTED and records rejectionReason', async () => {
    const orderNumber = `REJECT-ORD-${Date.now()}`;
    const initialOrder = await createOrder({
      orderNumber,
      storeId: DEFAULT_STORE_ID,
      customerId: testCustomer.id,
      subtotal: '28.00',
      items: [
        {
          productName: 'Amul Taaza Milk',
          quantity: '1.00',
          unit: '500ml',
          unitPrice: '28.00',
          lineTotal: '28.00',
        },
      ],
    });

    const rejectedOrder = await prisma.order.update({
      where: { id: initialOrder.id },
      data: {
        status: 'REJECTED',
        rejectionReason: 'Fresh milk stock exhausted for today. Next batch arrives 6 AM.',
      },
    });

    assert.equal(rejectedOrder.status, 'REJECTED');
    assert.equal(rejectedOrder.rejectionReason, 'Fresh milk stock exhausted for today. Next batch arrives 6 AM.');
    assert.equal(rejectedOrder.paymentStatus, 'UNPAID');
  });

  // 7. Store-Scoped Order Listing
  test('7. Order queries can be filtered by storeId for multi-tenant isolation', async () => {
    const store1Orders = await listOrders({ storeId: DEFAULT_STORE_ID });
    assert.ok(store1Orders.every((o) => o.storeId === DEFAULT_STORE_ID));

    const store2Orders = await listOrders({ storeId: TEST_STORE_2_ID });
    assert.equal(store2Orders.length, 0, 'Store 2 should have 0 orders');
  });
});

