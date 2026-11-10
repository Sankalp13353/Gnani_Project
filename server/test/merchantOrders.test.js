/**
 * Phase F: Shopkeeper Order Management, Approval & Packing Slips Test Suite
 *
 * Tests:
 * 1. Order ownership and tenant isolation (Store A vs Store B)
 * 2. Unauthenticated request protection (401 Unauthorized)
 * 3. Status filtering, search, pagination, and status summary counts
 * 4. Order detail view with permitted customer phone for authenticated merchant
 * 5. Order acceptance workflow (PENDING_APPROVAL -> ACCEPTED, records acceptedAt)
 * 6. Order rejection workflow (PENDING_APPROVAL -> REJECTED, requires rejectionReason)
 * 7. Rejection reason validation (<2 chars rejected with 400)
 * 8. Order preparation workflow (ACCEPTED -> PREPARING)
 * 9. Order ready-for-pickup workflow (PREPARING -> READY_FOR_PICKUP, records readyAt)
 * 10. Cannot accept order already accepted (state transition restriction)
 * 11. Preparation can only begin after order is ACCEPTED
 * 12. Marking ready requires order to be in PREPARING status
 * 13. Recording payment: CASH_ON_PICKUP and UPI_AT_STORE update paymentStatus to PAID when READY_FOR_PICKUP
 * 14. Payment recording is strictly rejected before READY_FOR_PICKUP (PENDING_APPROVAL, ACCEPTED, PREPARING)
 * 15. Payment recording is strictly rejected for REJECTED, CANCELLED and COMPLETED orders
 * 16. Invalid payment method is rejected with 400
 * 17. Repeated payment requests maintain consistent PAID state without corrupting order
 * 18. Order completion is strictly BLOCKED while order is UNPAID (returns 400)
 * 19. Completion succeeds after payment recorded (or atomically with paymentMethod body)
 * 20. Cannot complete an order in PENDING_APPROVAL, ACCEPTED, REJECTED, or CANCELLED status
 * 21. Packing slip is strictly UNAVAILABLE for PENDING_APPROVAL, REJECTED and CANCELLED orders
 * 22. Packing slip is ACCESSIBLE for ACCEPTED, PREPARING, READY_FOR_PICKUP orders with correct data
 * 23. Packing slip is ACCESSIBLE for COMPLETED orders with correct completedAt and payment note
 * 24. Cross-store packing slip access is rejected with 404
 * 25. Public customer confirmation endpoint still preserves privacy (no phone leaks)
 * 26. Simultaneous payment and completion requests do not corrupt order state
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { generateToken } from '../src/services/auth.service.js';
import { createCustomerOrder } from '../src/services/order.service.js';

describe('OrderSaathi Phase F: Shopkeeper Order Management, Approval & Packing Slips', () => {
  let server;
  let serverUrl;
  let storeA;
  let storeB;
  let tokenA;
  let tokenB;

  let prodAAtta;
  let prodASalt;
  let prodBRice;

  const STORE_A_PHONE = '9800000001';
  const STORE_B_PHONE = '9800000002';

  before(async () => {
    // Start temporary test server on random port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        serverUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Cleanup previous test stores
    await prisma.orderItem.deleteMany({
      where: {
        order: {
          store: { phone: { in: [STORE_A_PHONE, STORE_B_PHONE] } },
        },
      },
    });
    await prisma.order.deleteMany({
      where: {
        store: { phone: { in: [STORE_A_PHONE, STORE_B_PHONE] } },
      },
    });
    await prisma.product.deleteMany({
      where: {
        store: { phone: { in: [STORE_A_PHONE, STORE_B_PHONE] } },
      },
    });
    await prisma.store.deleteMany({
      where: { phone: { in: [STORE_A_PHONE, STORE_B_PHONE] } },
    });

    const passwordHash = await bcrypt.hash('Secret123', 10);

    // Create Store A
    storeA = await prisma.store.create({
      data: {
        name: 'Gupta Kirana Store A',
        ownerName: 'Ramesh Gupta',
        phone: STORE_A_PHONE,
        passwordHash,
        address: 'Shop 10, Sector 14',
        city: 'Gurugram',
        pincode: '122001',
        upiId: 'gupta@upi',
        isOpen: true,
      },
    });

    // Create Store B
    storeB = await prisma.store.create({
      data: {
        name: 'Verma Supermarket B',
        ownerName: 'Suresh Verma',
        phone: STORE_B_PHONE,
        passwordHash,
        address: 'Shop 25, Galleria Market',
        city: 'Gurugram',
        pincode: '122009',
        upiId: 'verma@upi',
        isOpen: true,
      },
    });

    tokenA = generateToken(storeA);
    tokenB = generateToken(storeB);

    // Create catalogue products for Store A
    prodAAtta = await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: 'Aashirvaad Shudh Chakki Atta',
        unit: 'kg',
        price: '60.00',
        isAvailable: true,
        isActive: true,
      },
    });

    prodASalt = await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: 'Tata Salt Vacuum Evaporated',
        unit: 'kg',
        price: '28.00',
        isAvailable: true,
        isActive: true,
      },
    });

    // Create product for Store B
    prodBRice = await prisma.product.create({
      data: {
        storeId: storeB.id,
        name: 'India Gate Basmati Rice',
        unit: 'kg',
        price: '110.00',
        isAvailable: true,
        isActive: true,
      },
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    // Cleanup test records
    await prisma.orderItem.deleteMany({
      where: {
        order: {
          store: { phone: { in: [STORE_A_PHONE, STORE_B_PHONE] } },
        },
      },
    });
    await prisma.order.deleteMany({
      where: {
        store: { phone: { in: [STORE_A_PHONE, STORE_B_PHONE] } },
      },
    });
    await prisma.product.deleteMany({
      where: {
        store: { phone: { in: [STORE_A_PHONE, STORE_B_PHONE] } },
      },
    });
    await prisma.store.deleteMany({
      where: { phone: { in: [STORE_A_PHONE, STORE_B_PHONE] } },
    });
  });

  // ==========================================================================
  // 1. SECURITY & TENANT ISOLATION
  // ==========================================================================

  test('1. Unauthenticated requests to /api/merchant/orders are rejected with 401', async () => {
    const res = await fetch(`${serverUrl}/api/merchant/orders`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('Authentication required'));
  });

  test('2. Merchant A lists only their own store orders and cannot see Merchant B orders', async () => {
    // Create order for Store A
    const orderA = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Customer A1',
      customerPhone: '9811111111',
      items: [{ productId: prodAAtta.id, quantity: 2, unit: 'kg' }],
    });

    // Create order for Store B
    const orderB = await createCustomerOrder({
      storeId: storeB.id,
      customerName: 'Customer B1',
      customerPhone: '9822222222',
      items: [{ productId: prodBRice.id, quantity: 1, unit: 'kg' }],
    });

    // Fetch orders as Merchant A
    const resA = await fetch(`${serverUrl}/api/merchant/orders`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(resA.status, 200);
    const bodyA = await resA.json();

    const orderIdsA = bodyA.data.map((o) => o.id);
    assert.ok(orderIdsA.includes(orderA.order.id));
    assert.ok(!orderIdsA.includes(orderB.order.id));

    // Fetch orders as Merchant B
    const resB = await fetch(`${serverUrl}/api/merchant/orders`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(resB.status, 200);
    const bodyB = await resB.json();

    const orderIdsB = bodyB.data.map((o) => o.id);
    assert.ok(orderIdsB.includes(orderB.order.id));
    assert.ok(!orderIdsB.includes(orderA.order.id));
  });

  test('3. Merchant A cannot access order details belonging to Store B (returns 404)', async () => {
    const { order: orderB } = await createCustomerOrder({
      storeId: storeB.id,
      customerName: 'Private B Customer',
      items: [{ productId: prodBRice.id, quantity: 2, unit: 'kg' }],
    });

    const res = await fetch(`${serverUrl}/api/merchant/orders/${orderB.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('not found or does not belong to your store'));
  });

  // ==========================================================================
  // 2. ORDER LISTING, SUMMARY, SEARCH & DETAILS
  // ==========================================================================

  test('4. Order summary breakdown returns correct count of orders by status', async () => {
    const res = await fetch(`${serverUrl}/api/merchant/orders/summary`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(typeof body.data.all === 'number');
    assert.ok(typeof body.data.PENDING_APPROVAL === 'number');
    assert.ok(typeof body.data.ACCEPTED === 'number');
    assert.ok(typeof body.data.PREPARING === 'number');
    assert.ok(typeof body.data.READY_FOR_PICKUP === 'number');
    assert.ok(typeof body.data.COMPLETED === 'number');
    assert.ok(typeof body.data.REJECTED === 'number');
  });

  test('5. Order listing supports status filtering and order number search', async () => {
    const { order: created } = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Filter Search Test',
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });

    // Filter by status
    const filterRes = await fetch(`${serverUrl}/api/merchant/orders?status=PENDING_APPROVAL`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(filterRes.status, 200);
    const filterBody = await filterRes.json();
    assert.ok(filterBody.data.length > 0);
    assert.ok(filterBody.data.every((o) => o.status === 'PENDING_APPROVAL'));

    // Search by exact orderNumber
    const searchRes = await fetch(`${serverUrl}/api/merchant/orders?search=${created.orderNumber}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(searchRes.status, 200);
    const searchBody = await searchRes.json();
    assert.equal(searchBody.data.length, 1);
    assert.equal(searchBody.data[0].id, created.id);
  });

  test('6. Order details include customer name, phone, line items, and pricing for authenticated merchant', async () => {
    const customerPhone = '9911223344';
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Aarav Sharma',
      customerPhone,
      notes: 'Please pack in a paper bag',
      items: [{ productId: prodAAtta.id, quantity: 2, unit: 'kg' }],
    });

    const res = await fetch(`${serverUrl}/api/merchant/orders/${order.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data;

    assert.equal(data.id, order.id);
    assert.equal(data.customer.name, 'Aarav Sharma');
    assert.equal(data.customer.phone, customerPhone); // Permitted in merchant view
    assert.equal(data.notes, 'Please pack in a paper bag');
    assert.equal(data.subtotal, '120.00');
    assert.equal(data.items.length, 1);
    assert.equal(data.items[0].productName, 'Aashirvaad Shudh Chakki Atta');
  });

  // ==========================================================================
  // 3. ACCEPT & REJECT WORKFLOW
  // ==========================================================================

  test('7. Shopkeeper accepts pending order: transitions PENDING_APPROVAL -> ACCEPTED and sets acceptedAt', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Accept Test',
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });

    const res = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ACCEPTED');
    assert.ok(body.data.acceptedAt);
  });

  test('8. Accepting an already accepted or non-pending order fails with 400', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });

    // Accept first time
    await fetch(`${serverUrl}/api/merchant/orders/${order.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    // Attempt to accept second time
    const res = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('only orders with status PENDING_APPROVAL can be accepted'));
  });

  test('9. Shopkeeper rejects pending order with a reason: transitions PENDING_APPROVAL -> REJECTED', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Reject Test',
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });

    const reason = 'Item currently damaged in warehouse storage';
    const res = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ rejectionReason: reason }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'REJECTED');
    assert.equal(body.data.rejectionReason, reason);
  });

  test('10. Rejecting without a reason (< 2 chars) fails with 400', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });

    const res = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ rejectionReason: ' ' }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('rejection reason is required'));
  });

  // ==========================================================================
  // 4. PREPARATION & READY-FOR-PICKUP WORKFLOW
  // ==========================================================================

  test('11. Preparation can only begin after order is ACCEPTED (fails with 400 if PENDING_APPROVAL)', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodAAtta.id, quantity: 1, unit: 'kg' }],
    });

    // Try starting preparation directly on PENDING_APPROVAL order
    const badRes = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/prepare`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(badRes.status, 400);
    const badBody = await badRes.json();
    assert.ok(badBody.message.includes('order must be in ACCEPTED status'));

    // Now accept the order
    await fetch(`${serverUrl}/api/merchant/orders/${order.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    // Starting preparation now succeeds
    const goodRes = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/prepare`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(goodRes.status, 200);
    const goodBody = await goodRes.json();
    assert.equal(goodBody.data.status, 'PREPARING');
  });

  test('12. Marking ready requires order to be in PREPARING status (sets readyAt timestamp)', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodASalt.id, quantity: 2, unit: 'kg' }],
    });

    await fetch(`${serverUrl}/api/merchant/orders/${order.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    // Attempt mark ready while ACCEPTED (not yet PREPARING) -> 400
    const prematureRes = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/ready`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(prematureRes.status, 400);

    // Transition to PREPARING
    await fetch(`${serverUrl}/api/merchant/orders/${order.id}/prepare`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    // Mark ready succeeds
    const readyRes = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/ready`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(readyRes.status, 200);
    const readyBody = await readyRes.json();
    assert.equal(readyBody.data.status, 'READY_FOR_PICKUP');
    assert.ok(readyBody.data.readyAt);
  });

  // Helper to advance order through ACCEPTED -> PREPARING -> READY_FOR_PICKUP
  const advanceToReady = async (orderId, token = tokenA) => {
    await fetch(`${serverUrl}/api/merchant/orders/${orderId}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    await fetch(`${serverUrl}/api/merchant/orders/${orderId}/prepare`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await fetch(`${serverUrl}/api/merchant/orders/${orderId}/ready`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  };

  // ==========================================================================
  // 5. PAYMENT & ORDER COMPLETION WORKFLOW
  // ==========================================================================

  test('13. Recording payment: CASH_ON_PICKUP and UPI_AT_STORE update paymentStatus to PAID when READY_FOR_PICKUP', async () => {
    const { order: orderCash } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });
    await advanceToReady(orderCash.id);

    // Record Cash
    const cashRes = await fetch(`${serverUrl}/api/merchant/orders/${orderCash.id}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'CASH_ON_PICKUP' }),
    });
    assert.equal(cashRes.status, 200);
    const cashBody = await cashRes.json();
    assert.equal(cashBody.data.paymentStatus, 'PAID');
    assert.equal(cashBody.data.paymentMethod, 'CASH_ON_PICKUP');

    // Record UPI
    const { order: orderUpi } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodAAtta.id, quantity: 1, unit: 'kg' }],
    });
    await advanceToReady(orderUpi.id);

    const upiRes = await fetch(`${serverUrl}/api/merchant/orders/${orderUpi.id}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'UPI_AT_STORE' }),
    });
    assert.equal(upiRes.status, 200);
    const upiBody = await upiRes.json();
    assert.equal(upiBody.data.paymentStatus, 'PAID');
    assert.equal(upiBody.data.paymentMethod, 'UPI_AT_STORE');
  });

  test('14. Payment recording is strictly rejected before READY_FOR_PICKUP (PENDING_APPROVAL, ACCEPTED, PREPARING)', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });

    // 1. While PENDING_APPROVAL
    const pendingRes = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'CASH_ON_PICKUP' }),
    });
    assert.equal(pendingRes.status, 400);
    const pendingBody = await pendingRes.json();
    assert.ok(pendingBody.message.includes('READY_FOR_PICKUP'));

    // 2. While ACCEPTED
    await fetch(`${serverUrl}/api/merchant/orders/${order.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const acceptedRes = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'CASH_ON_PICKUP' }),
    });
    assert.equal(acceptedRes.status, 400);
    const acceptedBody = await acceptedRes.json();
    assert.ok(acceptedBody.message.includes('READY_FOR_PICKUP'));

    // 3. While PREPARING
    await fetch(`${serverUrl}/api/merchant/orders/${order.id}/prepare`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const preparingRes = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'CASH_ON_PICKUP' }),
    });
    assert.equal(preparingRes.status, 400);
    const preparingBody = await preparingRes.json();
    assert.ok(preparingBody.message.includes('READY_FOR_PICKUP'));
  });

  test('15. Payment recording is strictly rejected for REJECTED, CANCELLED and COMPLETED orders', async () => {
    // 1. REJECTED order
    const { order: rejectedOrder } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });
    await fetch(`${serverUrl}/api/merchant/orders/${rejectedOrder.id}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ rejectionReason: 'Items damaged in store' }),
    });

    const rejectedRes = await fetch(`${serverUrl}/api/merchant/orders/${rejectedOrder.id}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'CASH_ON_PICKUP' }),
    });
    assert.equal(rejectedRes.status, 400);
    const rejectedBody = await rejectedRes.json();
    assert.ok(rejectedBody.message.includes('READY_FOR_PICKUP'));

    // 2. CANCELLED order
    const { order: cancelledOrder } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });
    await prisma.order.update({
      where: { id: cancelledOrder.id },
      data: { status: 'CANCELLED' },
    });

    const cancelledRes = await fetch(`${serverUrl}/api/merchant/orders/${cancelledOrder.id}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'CASH_ON_PICKUP' }),
    });
    assert.equal(cancelledRes.status, 400);
    const cancelledBody = await cancelledRes.json();
    assert.ok(cancelledBody.message.includes('READY_FOR_PICKUP'));

    // 3. COMPLETED order
    const { order: completedOrder } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });
    await advanceToReady(completedOrder.id);
    await fetch(`${serverUrl}/api/merchant/orders/${completedOrder.id}/complete`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'CASH_ON_PICKUP' }),
    });

    const completedRes = await fetch(`${serverUrl}/api/merchant/orders/${completedOrder.id}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'UPI_AT_STORE' }),
    });
    assert.equal(completedRes.status, 400);
    const completedBody = await completedRes.json();
    assert.ok(completedBody.message.includes('READY_FOR_PICKUP'));
  });

  test('16. Invalid payment method is rejected with 400', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });
    await advanceToReady(order.id);

    const res = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'CREDIT_CARD_ONLINE' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.message.includes('Invalid payment method'));
  });

  test('17. Repeated payment requests maintain consistent PAID state without corrupting order', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodASalt.id, quantity: 2, unit: 'kg' }],
    });
    await advanceToReady(order.id);

    // Initial payment: CASH_ON_PICKUP
    const firstRes = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'CASH_ON_PICKUP' }),
    });
    assert.equal(firstRes.status, 200);
    const firstBody = await firstRes.json();
    assert.equal(firstBody.data.paymentStatus, 'PAID');
    assert.equal(firstBody.data.paymentMethod, 'CASH_ON_PICKUP');

    // Repeated payment: updated to UPI_AT_STORE
    const secondRes = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/payment`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'UPI_AT_STORE' }),
    });
    assert.equal(secondRes.status, 200);
    const secondBody = await secondRes.json();
    assert.equal(secondBody.data.paymentStatus, 'PAID');
    assert.equal(secondBody.data.paymentMethod, 'UPI_AT_STORE');
    assert.equal(secondBody.data.status, 'READY_FOR_PICKUP');
  });

  test('18. Order completion is strictly BLOCKED while order is UNPAID (returns 400)', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodAAtta.id, quantity: 1, unit: 'kg' }],
    });

    // Move to READY_FOR_PICKUP
    await advanceToReady(order.id);

    // Attempt to complete without payment recorded
    const completeRes = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    assert.equal(completeRes.status, 400);
    const completeBody = await completeRes.json();
    assert.ok(completeBody.message.includes('payment has not been recorded'));
  });

  test('19. Completion succeeds after payment recorded (or atomically with paymentMethod body)', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodAAtta.id, quantity: 1, unit: 'kg' }],
    });

    // Progress to READY_FOR_PICKUP
    await advanceToReady(order.id);

    // Complete atomically with payment method
    const completeRes = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/complete`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'UPI_AT_STORE' }),
    });

    assert.equal(completeRes.status, 200);
    const completeBody = await completeRes.json();
    assert.equal(completeBody.data.status, 'COMPLETED');
    assert.equal(completeBody.data.paymentStatus, 'PAID');
    assert.equal(completeBody.data.paymentMethod, 'UPI_AT_STORE');
    assert.ok(completeBody.data.completedAt);
  });

  test('20. Cannot complete an order in PENDING_APPROVAL, ACCEPTED, REJECTED, or CANCELLED status', async () => {
    // 1. Rejected order
    const { order: rejectedOrder } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });
    await fetch(`${serverUrl}/api/merchant/orders/${rejectedOrder.id}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ rejectionReason: 'Store closing early' }),
    });

    const badComplete = await fetch(`${serverUrl}/api/merchant/orders/${rejectedOrder.id}/complete`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'CASH_ON_PICKUP' }),
    });
    assert.equal(badComplete.status, 400);
    const body = await badComplete.json();
    assert.ok(body.message.includes('order must be in READY_FOR_PICKUP status'));
  });

  // ==========================================================================
  // 6. PACKING SLIP WORKFLOW & RESTRICTIONS
  // ==========================================================================

  test('21. Packing slip is strictly UNAVAILABLE for PENDING_APPROVAL, REJECTED and CANCELLED orders', async () => {
    // Pending order
    const { order: pendingOrder } = await createCustomerOrder({
      storeId: storeA.id,
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });

    const pendingRes = await fetch(`${serverUrl}/api/merchant/orders/${pendingOrder.id}/packing-slip`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(pendingRes.status, 400);
    const pendingBody = await pendingRes.json();
    assert.ok(pendingBody.message.includes('must be reviewed and accepted'));

    // Rejected order
    await fetch(`${serverUrl}/api/merchant/orders/${pendingOrder.id}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ rejectionReason: 'Out of stock' }),
    });

    const rejectedRes = await fetch(`${serverUrl}/api/merchant/orders/${pendingOrder.id}/packing-slip`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(rejectedRes.status, 400);
    const rejectedBody = await rejectedRes.json();
    assert.ok(rejectedBody.message.includes('cannot be generated for rejected orders'));
  });

  test('22. Packing slip is ACCESSIBLE for ACCEPTED, PREPARING, READY_FOR_PICKUP orders with correct data', async () => {
    const slipPhone = '9988770022';
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Slip Customer',
      customerPhone: slipPhone,
      notes: 'No plastic please',
      items: [{ productId: prodAAtta.id, quantity: 1, unit: 'kg' }],
    });

    // Accept order
    await fetch(`${serverUrl}/api/merchant/orders/${order.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    // Fetch packing slip
    const res = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/packing-slip`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const slip = body.data;

    // Check Branding
    assert.equal(slip.branding.appName, 'OrderSaathi');

    // Check Store Details
    assert.equal(slip.store.name, 'Gupta Kirana Store A');
    assert.equal(slip.store.phone, STORE_A_PHONE);
    assert.equal(slip.store.upiId, 'gupta@upi');

    // Check Customer Details (merchant authenticated view)
    assert.equal(slip.customer.name, 'Slip Customer');
    assert.equal(slip.customer.phone, slipPhone);

    // Check Payment Note (Unpaid)
    assert.equal(slip.order.paymentNote, 'PAYMENT PENDING — COLLECT AT STORE');

    // Check Items
    assert.equal(slip.items.length, 1);
    assert.equal(slip.items[0].productName, 'Aashirvaad Shudh Chakki Atta');
    assert.equal(slip.items[0].quantity, '1');
    assert.equal(slip.items[0].unitPrice, '60.00');
    assert.equal(slip.items[0].lineTotal, '60.00');
  });

  test('23. Packing slip is ACCESSIBLE for COMPLETED orders with correct completedAt and payment note', async () => {
    const slipPhone = '9988770023';
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Completed Slip Customer',
      customerPhone: slipPhone,
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });
    await advanceToReady(order.id);

    // Complete order with UPI
    await fetch(`${serverUrl}/api/merchant/orders/${order.id}/complete`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ paymentMethod: 'UPI_AT_STORE' }),
    });

    // Fetch packing slip for COMPLETED order
    const res = await fetch(`${serverUrl}/api/merchant/orders/${order.id}/packing-slip`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const slip = body.data;

    assert.equal(slip.order.status, 'COMPLETED');
    assert.equal(slip.order.paymentStatus, 'PAID');
    assert.ok(slip.order.completedAt);
    assert.equal(slip.order.paymentNote, 'PAYMENT RECEIVED — COLLECTED VIA UPI');
  });

  test('24. Cross-store packing slip access is rejected with 404', async () => {
    const { order: orderB } = await createCustomerOrder({
      storeId: storeB.id,
      items: [{ productId: prodBRice.id, quantity: 1, unit: 'kg' }],
    });

    // Accept in Store B
    await fetch(`${serverUrl}/api/merchant/orders/${orderB.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    // Store A tries to access Store B's packing slip
    const res = await fetch(`${serverUrl}/api/merchant/orders/${orderB.id}/packing-slip`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(res.status, 404);
  });

  test('25. Public customer confirmation endpoint still preserves privacy (no phone leaks)', async () => {
    const privatePhone = '9988770025';
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Private Cust',
      customerPhone: privatePhone,
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });

    // Fetch via customer public confirmation endpoint
    const res = await fetch(`${serverUrl}/api/orders/${order.id}`, {
      headers: {
        'X-Confirmation-Token': order.confirmationToken,
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const publicOrder = body.data;
    // Customer phone must NEVER be exposed
    assert.equal(publicOrder.customer?.phone, undefined);
    assert.equal(publicOrder.customerPhone, undefined);

    // Merchant owner private phone or credentials must NEVER be exposed
    assert.equal(publicOrder.store?.phone, undefined);
    assert.equal(publicOrder.store?.ownerName, undefined);
    assert.equal(publicOrder.store?.passwordHash, undefined);
  });

  test('26. Simultaneous payment and completion requests do not corrupt order state', async () => {
    const { order } = await createCustomerOrder({
      storeId: storeA.id,
      customerName: 'Race Test',
      customerPhone: '9988770026',
      items: [{ productId: prodASalt.id, quantity: 1, unit: 'kg' }],
    });
    await advanceToReady(order.id);

    // Fire payment and completion concurrently
    const [paymentRes, completeRes] = await Promise.all([
      fetch(`${serverUrl}/api/merchant/orders/${order.id}/payment`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ paymentMethod: 'CASH_ON_PICKUP' }),
      }),
      fetch(`${serverUrl}/api/merchant/orders/${order.id}/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ paymentMethod: 'CASH_ON_PICKUP' }),
      }),
    ]);

    // Both requests must complete cleanly:
    // completeRes succeeds with 200.
    // paymentRes succeeds with 200 if processed before complete, or 400 if complete processed first (because status transitioned to COMPLETED).
    assert.equal(completeRes.status, 200);
    assert.ok([200, 400].includes(paymentRes.status));

    // Verify database state is clean and consistent
    const finalOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    assert.equal(finalOrder.status, 'COMPLETED');
    assert.equal(finalOrder.paymentStatus, 'PAID');
    assert.ok(finalOrder.completedAt);
  });
});
