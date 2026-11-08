/**
 * Phase 3 & 3.1: Order Understanding Engine Test Suite
 * Tests all 12 functional scenarios from Phase 3, plus Unit Conversion & Pricing Audit scenarios from Phase 3.1
 */

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrderTranscript } from '../src/services/orderUnderstanding.service.js';
import { multiplyDecimals, addDecimals, sumDecimals } from '../src/utils/decimal.js';
import { parseUnitDetails } from '../src/utils/unitConverter.js';
import { disconnectPrisma } from '../src/config/prisma.js';

describe('CallSaar Order Understanding Engine (Phases 3 & 3.1)', () => {
  after(async () => {
    await disconnectPrisma();
  });

  // Scenario 1: English order with multiple products
  test('1. English order with multiple products', async () => {
    const transcript = '2 kg atta and 1 litre sunflower oil';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].productName, 'Aashirvaad Atta');
    assert.equal(result.items[0].quantity, '2');
    assert.equal(result.items[0].unit, 'kg');
    assert.equal(result.items[0].lineTotal, '110.00');
    assert.equal(result.items[0].status, 'MATCHED');

    assert.equal(result.items[1].productName, 'Fortune Sunflower Oil');
    assert.equal(result.items[1].quantity, '1');
    assert.equal(result.items[1].unit, 'litre');
    assert.equal(result.items[1].lineTotal, '150.00');
    assert.equal(result.items[1].status, 'MATCHED');

    assert.equal(result.subtotal, '260.00');
    assert.equal(result.needsClarification, false);
    assert.equal(result.clarificationQuestions.length, 0);
  });

  // Scenario 2: Hindi/Hinglish order with greetings, fillers, and conjunctions
  test('2. Hindi/Hinglish order (Bhaiya, 2 kilo atta, ek litre sunflower oil aur 3 Maggi de dena.)', async () => {
    const transcript = 'Bhaiya, 2 kilo atta, ek litre sunflower oil aur 3 Maggi de dena.';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 3);

    // Item 1: Aashirvaad Atta
    assert.equal(result.items[0].productName, 'Aashirvaad Atta');
    assert.equal(result.items[0].quantity, '2');
    assert.equal(result.items[0].unit, 'kg');
    assert.equal(result.items[0].lineTotal, '110.00');
    assert.equal(result.items[0].status, 'MATCHED');

    // Item 2: Fortune Sunflower Oil
    assert.equal(result.items[1].productName, 'Fortune Sunflower Oil');
    assert.equal(result.items[1].quantity, '1');
    assert.equal(result.items[1].unit, 'litre');
    assert.equal(result.items[1].lineTotal, '150.00');
    assert.equal(result.items[1].status, 'MATCHED');

    // Item 3: Maggi Noodles
    assert.equal(result.items[2].productName, 'Maggi Noodles');
    assert.equal(result.items[2].quantity, '3');
    assert.equal(result.items[2].unit, 'packet');
    assert.equal(result.items[2].lineTotal, '45.00');
    assert.equal(result.items[2].status, 'MATCHED');

    // Total: 110 + 150 + 45 = 305.00
    assert.equal(result.subtotal, '305.00');
    assert.equal(result.needsClarification, false);
    assert.equal(result.clarificationQuestions.length, 0);
  });

  // Scenario 3: Quantity expressed using Hindi number words (ek, do, teen)
  test('3. Quantity expressed using Hindi number words', async () => {
    const transcript = 'do kilo atta aur teen packet maggi';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].quantity, '2');
    assert.equal(result.items[0].productName, 'Aashirvaad Atta');
    assert.equal(result.items[0].lineTotal, '110.00');

    assert.equal(result.items[1].quantity, '3');
    assert.equal(result.items[1].productName, 'Maggi Noodles');
    assert.equal(result.items[1].lineTotal, '45.00');

    assert.equal(result.subtotal, '155.00');
    assert.equal(result.needsClarification, false);
  });

  // Scenario 4: Different unit formats (gram, packets, ltr)
  test('4. Different unit formats and variations', async () => {
    const transcript = '500 gram sugar, 2 packets milk, 1 ltr oil';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 3);
    assert.equal(result.items[0].unit, 'g');
    assert.equal(result.items[0].productName, 'Sugar');
    assert.equal(result.items[0].lineTotal, '22.50'); // 500g @ ₹45/kg = ₹22.50

    assert.equal(result.items[1].unit, 'packet');
    assert.equal(result.items[1].productName, 'Amul Taaza Milk');
    assert.equal(result.items[1].lineTotal, '56.00'); // 2 packets @ ₹28/500ml = ₹56.00

    assert.equal(result.items[2].unit, 'litre');
    assert.equal(result.items[2].productName, 'Fortune Sunflower Oil');
    assert.equal(result.items[2].lineTotal, '150.00'); // 1 litre @ ₹150/litre = ₹150.00

    assert.equal(result.subtotal, '228.50'); // 22.50 + 56.00 + 150.00 = 228.50
    assert.equal(result.needsClarification, false);
  });

  // Scenario 5: Product name with capitalization or minor spelling differences
  test('5. Product name with capitalization and minor typos', async () => {
    const transcript = '1 AASHIRVAAD ATTA, 2 magi, 1 parle g';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 3);
    assert.equal(result.items[0].productName, 'Aashirvaad Atta');
    assert.equal(result.items[0].status, 'MATCHED');

    assert.equal(result.items[1].productName, 'Maggi Noodles');
    assert.equal(result.items[1].status, 'MATCHED');

    assert.equal(result.items[2].productName, 'Parle-G Biscuits');
    assert.equal(result.items[2].status, 'MATCHED');
  });

  // Scenario 6: Unknown product
  test('6. Unknown product returns UNMATCHED with clarification', async () => {
    const transcript = '2 kilo chawal aur 1 kg atta';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 2);

    const unmatchedItem = result.items.find(i => i.status === 'UNMATCHED');
    assert.ok(unmatchedItem);
    assert.ok(unmatchedItem.productName.includes('chawal'));
    assert.equal(unmatchedItem.lineTotal, null);

    const matchedItem = result.items.find(i => i.status === 'MATCHED');
    assert.ok(matchedItem);
    assert.equal(matchedItem.productName, 'Aashirvaad Atta');
    assert.equal(matchedItem.lineTotal, '55.00');

    assert.equal(result.subtotal, '55.00');
    assert.equal(result.needsClarification, true);
    assert.ok(result.clarificationQuestions.some(q => q.includes('chawal')));
  });

  // Scenario 7: Missing quantity
  test('7. Missing quantity returns MISSING_QUANTITY with clarification', async () => {
    const transcript = 'Give me some milk';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].status, 'MISSING_QUANTITY');
    assert.equal(result.items[0].productName, 'Amul Taaza Milk');
    assert.equal(result.items[0].quantity, null);
    assert.equal(result.items[0].lineTotal, null);
    assert.equal(result.needsClarification, true);
    assert.ok(result.clarificationQuestions.some(q => q.includes('How much')));
  });

  // Scenario 8: Missing product name
  test('8. Missing product name returns MISSING_PRODUCT with clarification', async () => {
    const transcript = 'Give me two packets';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].status, 'MISSING_PRODUCT');
    assert.equal(result.items[0].quantity, '2');
    assert.equal(result.items[0].unit, 'packet');
    assert.equal(result.items[0].productName, null);
    assert.equal(result.needsClarification, true);
    assert.ok(result.clarificationQuestions.some(q => q.includes('Which product')));
  });

  // Scenario 9: Ambiguous product match
  test('9. Ambiguous product match returns AMBIGUOUS with candidate options', async () => {
    const transcript = '2 packet amul';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].status, 'AMBIGUOUS');
    assert.ok(result.items[0].candidates.length >= 2);
    assert.equal(result.needsClarification, true);
    assert.ok(result.clarificationQuestions.some(q => q.includes('Did you mean')));
  });

  // Scenario 10: Empty transcript rejects with 400
  test('10. Empty or invalid transcript rejects with error', async () => {
    await assert.rejects(
      async () => {
        await parseOrderTranscript('');
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.ok(err.message.includes('non-empty string'));
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await parseOrderTranscript('   ');
      },
      (err) => {
        assert.equal(err.status, 400);
        return true;
      }
    );
  });

  // Scenario 11: Multiple items with correct subtotal calculation
  test('11. Multiple items with accurate subtotal', async () => {
    const transcript = '2 kg atta, 1 litre oil, 1 kg salt, 1 kg sugar';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 4);
    // Atta: 2 * 55 = 110.00
    // Oil: 1 * 150 = 150.00
    // Salt: 1 * 25 = 25.00
    // Sugar: 1 * 45 = 45.00
    // Total = 110 + 150 + 25 + 45 = 330.00
    assert.equal(result.subtotal, '330.00');
    assert.equal(result.needsClarification, false);
  });

  // Scenario 12: Decimal-safe monetary calculations
  test('12. Decimal-safe monetary calculations avoid floating point inaccuracies', async () => {
    // 0.1 + 0.2 floating point test
    const sum = addDecimals('0.10', '0.20');
    assert.equal(sum, '0.30');

    // Fractional multiplication (e.g. 0.5 kg of 45.00 INR sugar, 1.5 kg of 55.00 INR atta)
    const sugarTotal = multiplyDecimals('0.5', '45.00');
    assert.equal(sugarTotal, '22.50');

    const attaTotal = multiplyDecimals('1.5', '55.00');
    assert.equal(attaTotal, '82.50');

    const total = sumDecimals([sugarTotal, attaTotal]);
    assert.equal(total, '105.00');
  });

  // --- Phase 3.1: Unit Conversion and Pricing Audit Scenarios ---

  // Test A: 500g sugar priced per kg (₹45/kg -> ₹22.50)
  test('13. 500g sugar priced per kg', async () => {
    const transcript = '500 gram sugar';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].productName, 'Sugar');
    assert.equal(result.items[0].quantity, '500');
    assert.equal(result.items[0].unit, 'g');
    assert.equal(result.items[0].catalogUnit, 'kg');
    assert.equal(result.items[0].unitPrice, '45.00');
    assert.equal(result.items[0].lineTotal, '22.50');
    assert.equal(result.items[0].status, 'MATCHED');
    assert.equal(result.subtotal, '22.50');
    assert.equal(result.needsClarification, false);

    // Also test 1 kg and 2 kg sugar
    const res1kg = await parseOrderTranscript('1 kg sugar');
    assert.equal(res1kg.items[0].lineTotal, '45.00');
    assert.equal(res1kg.subtotal, '45.00');

    const res2kg = await parseOrderTranscript('2 kg sugar');
    assert.equal(res2kg.items[0].lineTotal, '90.00');
    assert.equal(res2kg.subtotal, '90.00');
  });

  // Test B: 1 litre milk when sold in 500ml pouches (₹28 per 500ml -> 2 pouches -> ₹56.00)
  test('14. 1 litre milk when sold in 500ml pouches', async () => {
    const transcript = '1 litre milk';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].productName, 'Amul Taaza Milk');
    assert.equal(result.items[0].quantity, '1');
    assert.equal(result.items[0].unit, 'litre');
    assert.equal(result.items[0].catalogUnit, '500ml');
    assert.equal(result.items[0].unitPrice, '28.00');
    assert.equal(result.items[0].lineTotal, '56.00'); // 1000ml / 500ml = 2 pouches * ₹28 = ₹56.00
    assert.equal(result.items[0].status, 'MATCHED');
    assert.equal(result.subtotal, '56.00');
    assert.equal(result.needsClarification, false);
  });

  // Test C: 2 milk pouches (₹28 per pouch -> ₹56.00)
  test('15. 2 milk pouches', async () => {
    const transcript = '2 packets milk';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].productName, 'Amul Taaza Milk');
    assert.equal(result.items[0].quantity, '2');
    assert.equal(result.items[0].unit, 'packet');
    assert.equal(result.items[0].catalogUnit, '500ml');
    assert.equal(result.items[0].unitPrice, '28.00');
    assert.equal(result.items[0].lineTotal, '56.00'); // 2 pouches * ₹28 = ₹56.00
    assert.equal(result.items[0].status, 'MATCHED');
    assert.equal(result.subtotal, '56.00');
    assert.equal(result.needsClarification, false);

    // Also test 1 packet
    const res1p = await parseOrderTranscript('1 packet milk');
    assert.equal(res1p.items[0].lineTotal, '28.00');
    assert.equal(res1p.subtotal, '28.00');
  });

  // Test D: 500ml oil priced per litre (₹150/litre -> ₹75.00)
  test('16. 500ml oil priced per litre', async () => {
    const transcript = '500 ml sunflower oil';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].productName, 'Fortune Sunflower Oil');
    assert.equal(result.items[0].quantity, '500');
    assert.equal(result.items[0].unit, 'ml');
    assert.equal(result.items[0].catalogUnit, 'litre');
    assert.equal(result.items[0].unitPrice, '150.00');
    assert.equal(result.items[0].lineTotal, '75.00'); // 500ml / 1000ml = 0.5 * ₹150 = ₹75.00
    assert.equal(result.items[0].status, 'MATCHED');
    assert.equal(result.subtotal, '75.00');
    assert.equal(result.needsClarification, false);

    // Also test 1 litre oil
    const res1l = await parseOrderTranscript('1 litre sunflower oil');
    assert.equal(res1l.items[0].lineTotal, '150.00');
    assert.equal(res1l.subtotal, '150.00');
  });

  // Test E: Unsupported conversions return clarification requirement rather than incorrect subtotal
  test('17. Unsupported conversions return clarification', async () => {
    // 1. Maggi is sold in packets, cannot convert to kg
    const maggiKg = await parseOrderTranscript('1 kg maggi');
    assert.equal(maggiKg.items.length, 1);
    assert.equal(maggiKg.items[0].status, 'UNSUPPORTED_UNIT');
    assert.equal(maggiKg.items[0].lineTotal, null);
    assert.equal(maggiKg.subtotal, '0.00');
    assert.equal(maggiKg.needsClarification, true);
    assert.ok(maggiKg.clarificationQuestions.some(q => q.includes('packet')));

    // 2. Sugar is sold by weight (kg), cannot convert from volume (litre)
    const sugarLitre = await parseOrderTranscript('1 litre sugar');
    assert.equal(sugarLitre.items.length, 1);
    assert.equal(sugarLitre.items[0].status, 'UNSUPPORTED_UNIT');
    assert.equal(sugarLitre.items[0].lineTotal, null);
    assert.equal(sugarLitre.subtotal, '0.00');
    assert.equal(sugarLitre.needsClarification, true);
    assert.ok(sugarLitre.clarificationQuestions.some(q => q.includes('Sugar is sold by weight') || q.includes('weight')));

    // 3. Oil is sold by volume (litre), cannot convert from weight (kg)
    const oilKg = await parseOrderTranscript('1 kg sunflower oil');
    assert.equal(oilKg.items.length, 1);
    assert.equal(oilKg.items[0].status, 'UNSUPPORTED_UNIT');
    assert.equal(oilKg.items[0].lineTotal, null);
    assert.equal(oilKg.needsClarification, true);

    // 4. Milk is sold in discrete 500ml sealed pouches, 750ml cannot be fulfilled by integer pouches
    const milk750 = await parseOrderTranscript('750 ml milk');
    assert.equal(milk750.items.length, 1);
    assert.equal(milk750.items[0].status, 'UNSUPPORTED_UNIT');
    assert.equal(milk750.items[0].lineTotal, null);
    assert.equal(milk750.needsClarification, true);
    assert.ok(milk750.clarificationQuestions.some(q => q.includes('500ml')));
  });

  // Test F: Unit Details parser unit tests
  test('18. Unit parsing helper handles standard and composite units', () => {
    const kg = parseUnitDetails('kg');
    assert.equal(kg.dimension, 'WEIGHT');
    assert.equal(kg.baseAmount, 1000);

    const ml500 = parseUnitDetails('500ml');
    assert.equal(ml500.dimension, 'VOLUME');
    assert.equal(ml500.baseAmount, 500);
    assert.equal(ml500.isPackaged, true);

    const g100 = parseUnitDetails('100g');
    assert.equal(g100.dimension, 'WEIGHT');
    assert.equal(g100.baseAmount, 100);
    assert.equal(g100.isPackaged, true);

    const packet = parseUnitDetails('packet');
    assert.equal(packet.dimension, 'COUNT');
    assert.equal(packet.baseAmount, 1);
  });
});
