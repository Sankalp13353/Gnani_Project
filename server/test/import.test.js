import { test, describe, after, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { generateToken } from '../src/services/auth.service.js';
import { importSessions } from '../src/services/import.service.js';

describe('CallSaar Phase C2: CSV/Excel Bulk Product Import & Management', () => {
  let server;
  let baseUrl;

  let storeA;
  let storeB;
  let tokenA;
  let tokenB;

  const STORE_A_PHONE = '9300000001';
  const STORE_B_PHONE = '9300000002';

  before(async () => {
    // Start temporary test server instance on an available random port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/products`;
        resolve();
      });
    });

    // Cleanup lingering test records
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

    storeA = await prisma.store.create({
      data: {
        name: 'Alpha Import Mart',
        ownerName: 'Alpha Import Owner',
        phone: STORE_A_PHONE,
        passwordHash,
        address: '100 Road, Indiranagar',
        city: 'Bengaluru',
        pincode: '560038',
        isOpen: true,
      },
    });

    storeB = await prisma.store.create({
      data: {
        name: 'Beta Import Kirana',
        ownerName: 'Beta Import Owner',
        phone: STORE_B_PHONE,
        passwordHash,
        address: '5th Block, Koramangala',
        city: 'Bengaluru',
        pincode: '560034',
        isOpen: true,
      },
    });

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

  // Helper to build multipart FormData for file uploads
  const createMultipartPayload = (fileBuffer, filename, fieldName = 'file') => {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], {
      type: filename.endsWith('.csv')
        ? 'text/csv'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    formData.append(fieldName, blob, filename);
    return formData;
  };

  // 1. Download CSV template
  test('1. GET /api/products/import/template returns safe CSV template with headers', async () => {
    const res = await fetch(`${baseUrl}/import/template`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/csv; charset=utf-8');
    const content = await res.text();
    assert.ok(content.startsWith('name,brand,category,description,unit,price,isAvailable'));
    assert.ok(content.includes('Aashirvaad Shudh Chakki Atta'));
    assert.ok(content.includes('Fortune Sunlite Sunflower Oil'));
  });

  // 2. CSV preview parses rows without database writes
  let previewDataA;
  test('2. CSV preview validates rows and returns preview without database writes', async () => {
    const csvContent = [
      'name,brand,category,description,unit,price,isAvailable',
      'Kohinoor Basmati Rice,Kohinoor,Rice,Super silver aged basmati,kg,130.00,true',
      'Gemini Sunflower Oil,Gemini,Oils,Refined sunflower edible oil,litre,142.50,true',
      'Everest Garam Masala,Everest,Spices,Authentic blended spices 100g,packet,42.00,true',
    ].join('\n');

    const formData = createMultipartPayload(Buffer.from(csvContent), 'test_products.csv');

    const res = await fetch(`${baseUrl}/import/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.importToken);
    assert.equal(body.data.summary.totalRows, 3);
    assert.equal(body.data.summary.validCount, 3);
    assert.equal(body.data.summary.invalidCount, 0);
    assert.equal(body.data.validRows.length, 3);

    previewDataA = body.data;

    // Verify ZERO writes occurred in PostgreSQL
    const count = await prisma.product.count({
      where: { storeId: storeA.id },
    });
    assert.equal(count, 0, 'Preview must NOT write anything to the database');
  });

  // 3. XLSX preview parses Excel sheets without database writes
  test('3. XLSX preview parses .xlsx workbook and returns preview without database writes', async () => {
    const rows = [
      {
        name: 'Haldiram Bhujia Sev',
        brand: 'Haldiram',
        category: 'Snacks',
        description: 'Crispy gram flour sev 400g',
        unit: 'packet',
        price: 95.0,
        isAvailable: true,
      },
      {
        name: 'Bru Instant Coffee',
        brand: 'Bru',
        category: 'Beverages',
        description: 'Chicory blended instant coffee 100g',
        unit: 'packet',
        price: 185.0,
        isAvailable: true,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const formData = createMultipartPayload(xlsxBuffer, 'products.xlsx');

    const res = await fetch(`${baseUrl}/import/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.summary.totalRows, 2);
    assert.equal(body.data.summary.validCount, 2);
    assert.equal(body.data.validRows[0].name, 'Haldiram Bhujia Sev');
    assert.equal(body.data.validRows[0].price, '95.00');

    // Confirm no DB persistence
    const checkProduct = await prisma.product.findFirst({
      where: { name: 'Haldiram Bhujia Sev', storeId: storeA.id },
    });
    assert.equal(checkProduct, null);
  });

  // 4. Missing required columns is rejected
  test('4. Upload missing required columns (e.g. missing unit) is rejected with 400', async () => {
    const badCsv = [
      'name,brand,category,price,isAvailable', // missing 'unit'
      'Wheat Atta,Brand,Category,50.00,true',
    ].join('\n');

    const formData = createMultipartPayload(Buffer.from(badCsv), 'no_unit.csv');

    const res = await fetch(`${baseUrl}/import/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('Missing required columns'));
  });

  // 5. Unsupported file format is rejected
  test('5. Unsupported file formats (e.g. .pdf or .json) are rejected with 400', async () => {
    const formData = new FormData();
    const blob = new Blob(['sample pdf content'], { type: 'application/pdf' });
    formData.append('file', blob, 'products.pdf');

    const res = await fetch(`${baseUrl}/import/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('Unsupported file format'));
  });

  // 6. Invalid rows report exact row numbers and errors
  test('6. Invalid rows (empty name, non-positive price, in-file duplicate) are isolated with row numbers and errors', async () => {
    const mixedCsv = [
      'name,brand,category,description,unit,price,isAvailable',
      'Valid Sugar,Madhur,Sugar,Pure refined sugar,kg,48.00,true', // Row 2: Valid
      ',Madhur,Sugar,Missing name,kg,48.00,true', // Row 3: Missing name
      'Negative Salt,Tata,Salt,Bad price,kg,-10.00,true', // Row 4: Negative price
      'Zero Oil,Fortune,Oil,Zero price,litre,0,true', // Row 5: Zero price
      'Valid Sugar,Madhur,Sugar,Duplicate in file,kg,48.00,true', // Row 6: Duplicate name in same file
    ].join('\n');

    const formData = createMultipartPayload(Buffer.from(mixedCsv), 'mixed_products.csv');

    const res = await fetch(`${baseUrl}/import/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.summary.totalRows, 5);
    assert.equal(body.data.summary.validCount, 1); // Only Row 2
    assert.equal(body.data.summary.invalidCount, 4); // Rows 3, 4, 5, 6

    const invalid3 = body.data.invalidRows.find((r) => r.rowNumber === 3);
    assert.ok(invalid3);
    assert.ok(invalid3.errors.some((e) => e.includes('name is required')));

    const invalid4 = body.data.invalidRows.find((r) => r.rowNumber === 4);
    assert.ok(invalid4);
    assert.ok(invalid4.errors.some((e) => e.includes('greater than zero')));

    const invalid5 = body.data.invalidRows.find((r) => r.rowNumber === 5);
    assert.ok(invalid5);
    assert.ok(invalid5.errors.some((e) => e.includes('greater than zero')));

    const invalid6 = body.data.invalidRows.find((r) => r.rowNumber === 6);
    assert.ok(invalid6);
    assert.ok(invalid6.errors.some((e) => e.includes('Duplicate product name')));
  });

  // 7. Import confirmation commits valid products
  test('7. POST /api/products/import/confirm commits preview items inside transaction', async () => {
    assert.ok(previewDataA?.importToken);

    const res = await fetch(`${baseUrl}/import/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        importToken: previewDataA.importToken,
        duplicatePolicy: 'skip',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.createdCount, 3);
    assert.equal(body.data.skippedCount, 0);

    // Verify products exist in PostgreSQL for Store A
    const countA = await prisma.product.count({
      where: { storeId: storeA.id, isActive: true },
    });
    assert.equal(countA, 3);

    const item = await prisma.product.findFirst({
      where: { name: 'Kohinoor Basmati Rice', storeId: storeA.id },
    });
    assert.ok(item);
    assert.equal(item.price.toString(), '130');
    assert.equal(item.unit, 'kg');
  });

  // 8. Cross-store import prevention
  test('8. Cross-store import prevention: Store B cannot confirm Store A importToken (403 Forbidden)', async () => {
    // Generate new preview for Store A
    const csvContent = [
      'name,brand,category,description,unit,price,isAvailable',
      'Store A Secret Product,Brand,Cat,Desc,kg,99.00,true',
    ].join('\n');

    const formData = createMultipartPayload(Buffer.from(csvContent), 'secret.csv');
    const prevRes = await fetch(`${baseUrl}/import/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });
    const { importToken } = (await prevRes.json()).data;

    // Store B attempts to confirm Store A's importToken
    const resB = await fetch(`${baseUrl}/import/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`, // Store B token
      },
      body: JSON.stringify({
        importToken,
        duplicatePolicy: 'skip',
      }),
    });

    assert.equal(resB.status, 403);
    const bodyB = await resB.json();
    assert.equal(bodyB.success, false);
    assert.ok(bodyB.message.includes('Access denied'));

    // Verify product was NOT imported to Store B
    const rogueItem = await prisma.product.findFirst({
      where: { name: 'Store A Secret Product', storeId: storeB.id },
    });
    assert.equal(rogueItem, null);
  });

  // 9. Duplicate product handling: 'skip' policy preserves existing products
  test('9. Duplicate product handling: duplicatePolicy="skip" preserves existing products untouched', async () => {
    // Upload CSV that contains an already-existing product name ('Kohinoor Basmati Rice' with altered price 500)
    const duplicateCsv = [
      'name,brand,category,description,unit,price,isAvailable',
      'Kohinoor Basmati Rice,Kohinoor,Rice,Attempted overwrite,kg,500.00,true',
      'New Unique Dal,Tata,Dals,Fresh toor dal,kg,160.00,true',
    ].join('\n');

    const formData = createMultipartPayload(Buffer.from(duplicateCsv), 'dup.csv');
    const prevRes = await fetch(`${baseUrl}/import/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });
    const preview = (await prevRes.json()).data;
    assert.equal(preview.summary.duplicateCount, 1);

    // Confirm with 'skip' policy
    const confirmRes = await fetch(`${baseUrl}/import/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        importToken: preview.importToken,
        duplicatePolicy: 'skip',
      }),
    });

    assert.equal(confirmRes.status, 200);
    const confirmBody = await confirmRes.json();
    assert.equal(confirmBody.data.createdCount, 1); // 'New Unique Dal'
    assert.equal(confirmBody.data.skippedCount, 1); // 'Kohinoor Basmati Rice' was skipped

    // Verify existing product was NOT modified (retained original price 130, not 500)
    const existingItem = await prisma.product.findFirst({
      where: { name: 'Kohinoor Basmati Rice', storeId: storeA.id },
    });
    assert.equal(existingItem.price.toString(), '130');
    assert.notEqual(existingItem.description, 'Attempted overwrite');
  });

  // 10. Duplicate product handling: 'update' policy updates product details
  test('10. Duplicate product handling: duplicatePolicy="update" safely updates existing product pricing and details', async () => {
    const updateCsv = [
      'name,brand,category,description,unit,price,isAvailable',
      'Kohinoor Basmati Rice,Kohinoor Heritage,Rice,Updated premium aged basmati,kg,138.50,true',
    ].join('\n');

    const formData = createMultipartPayload(Buffer.from(updateCsv), 'update.csv');
    const prevRes = await fetch(`${baseUrl}/import/preview`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });
    const preview = (await prevRes.json()).data;

    // Confirm with 'update' policy
    const confirmRes = await fetch(`${baseUrl}/import/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        importToken: preview.importToken,
        duplicatePolicy: 'update',
      }),
    });

    assert.equal(confirmRes.status, 200);
    const confirmBody = await confirmRes.json();
    assert.equal(confirmBody.data.updatedCount, 1);
    assert.equal(confirmBody.data.createdCount, 0);

    // Verify existing product was updated to new price 138.50
    const updatedItem = await prisma.product.findFirst({
      where: { name: 'Kohinoor Basmati Rice', storeId: storeA.id },
    });
    assert.equal(updatedItem.price.toString(), '138.5');
    assert.equal(updatedItem.brand, 'Kohinoor Heritage');
  });

  // 11. Transaction rollback on failed import
  test('11. Transaction rollback: database error aborts entire import and leaves database in prior state', async () => {
    // Manually register an import session with a row that will intentionally fail a database constraint (e.g. invalid foreign key or forced error)
    const testToken = 'rollback-test-token-12345';
    importSessions.set(testToken, {
      storeId: storeA.id,
      validRows: [
        {
          name: 'Rollback Product Alpha',
          unit: 'kg',
          price: '90.00',
          isAvailable: true,
        },
        {
          name: null, // Will cause Prisma to fail NOT NULL constraint on Product.name
          unit: 'kg',
          price: '90.00',
          isAvailable: true,
        },
      ],
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    });

    const initialCount = await prisma.product.count({
      where: { storeId: storeA.id },
    });

    // Confirmation should fail
    const res = await fetch(`${baseUrl}/import/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        importToken: testToken,
      }),
    });

    assert.equal(res.status, 500);

    // Verify Rollback: 'Rollback Product Alpha' was NOT committed to the database
    const alphaItem = await prisma.product.findFirst({
      where: { name: 'Rollback Product Alpha', storeId: storeA.id },
    });
    assert.equal(alphaItem, null, 'Transaction must roll back all items when any item fails');

    const finalCount = await prisma.product.count({
      where: { storeId: storeA.id },
    });
    assert.equal(finalCount, initialCount, 'Database count must remain identical before and after aborted transaction');
  });
});

