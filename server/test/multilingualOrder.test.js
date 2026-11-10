import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrderTranscript } from '../src/services/orderUnderstanding.service.js';
import prisma from '../src/config/prisma.js';

describe('OrderSaathi Multilingual AI-Powered Order Understanding Engine', () => {
  after(async () => {
    await prisma.$disconnect();
  });

  // Test Case 1: Core Target Native Hindi (Devanagari) Transcript
  test('1. Native Hindi transcript with Devanagari script, fillers, connectors, and dandas', async () => {
    const transcript = 'भैया, दो किलो आटा, तीन मैगी का पैकेट और एक लीटर सनफ्लावर ऑयल देना।';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 3, 'Should parse exactly 3 items');

    // Item 1: Aashirvaad Atta — 2 kg @ ₹55.00 = ₹110.00
    const atta = result.items[0];
    assert.equal(atta.productName, 'Aashirvaad Atta');
    assert.equal(atta.quantity, '2');
    assert.equal(atta.unit, 'kg');
    assert.equal(atta.unitPrice, '55.00');
    assert.equal(atta.lineTotal, '110.00');
    assert.equal(atta.status, 'MATCHED');

    // Item 2: Maggi Noodles — 3 packet @ ₹15.00 = ₹45.00
    const maggi = result.items[1];
    assert.equal(maggi.productName, 'Maggi Noodles');
    assert.equal(maggi.quantity, '3');
    assert.equal(maggi.unit, 'packet');
    assert.equal(maggi.unitPrice, '15.00');
    assert.equal(maggi.lineTotal, '45.00');
    assert.equal(maggi.status, 'MATCHED');

    // Item 3: Fortune Sunflower Oil — 1 litre @ ₹150.00 = ₹150.00
    const oil = result.items[2];
    assert.equal(oil.productName, 'Fortune Sunflower Oil');
    assert.equal(oil.quantity, '1');
    assert.equal(oil.unit, 'litre');
    assert.equal(oil.unitPrice, '150.00');
    assert.equal(oil.lineTotal, '150.00');
    assert.equal(oil.status, 'MATCHED');

    // Subtotal: 110 + 45 + 150 = 305.00
    assert.equal(result.subtotal, '305.00');
    assert.equal(result.needsClarification, false);
    assert.equal(result.clarificationQuestions.length, 0);
  });

  // Test Case 2: Equivalent Hinglish Transcript
  test('2. Equivalent Hinglish transcript produces the exact same structured draft order', async () => {
    const transcript = 'Do kilo atta, teen Maggi ka packet aur ek litre sunflower oil dena.';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 3);
    assert.equal(result.items[0].productName, 'Aashirvaad Atta');
    assert.equal(result.items[0].lineTotal, '110.00');

    assert.equal(result.items[1].productName, 'Maggi Noodles');
    assert.equal(result.items[1].lineTotal, '45.00');

    assert.equal(result.items[2].productName, 'Fortune Sunflower Oil');
    assert.equal(result.items[2].lineTotal, '150.00');

    assert.equal(result.subtotal, '305.00');
    assert.equal(result.needsClarification, false);
  });

  // Test Case 3: Equivalent English Transcript
  test('3. Equivalent English transcript produces the exact same structured draft order', async () => {
    const transcript = 'Give me two kilos of atta, three Maggi packets and one litre sunflower oil.';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 3);
    assert.equal(result.items[0].productName, 'Aashirvaad Atta');
    assert.equal(result.items[0].lineTotal, '110.00');

    assert.equal(result.items[1].productName, 'Maggi Noodles');
    assert.equal(result.items[1].lineTotal, '45.00');

    assert.equal(result.items[2].productName, 'Fortune Sunflower Oil');
    assert.equal(result.items[2].lineTotal, '150.00');

    assert.equal(result.subtotal, '305.00');
    assert.equal(result.needsClarification, false);
  });

  // Test Case 4: Devanagari numerals (०-९)
  test('4. Devanagari numerals (२, ३) are correctly parsed and mapped to digits', async () => {
    const transcript = '२ किलो आटा और ३ पैकेट मैगी';
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

  // Test Case 5: Hindi fractions (आधा, डेढ़, ढाई)
  test('5. Hindi fractions: "आधा किलो चीनी" and "आधा लीटर दूध"', async () => {
    // 500g sugar @ ₹45/kg = ₹22.50
    const sugarResult = await parseOrderTranscript('आधा किलो चीनी');
    assert.equal(sugarResult.items.length, 1);
    assert.equal(sugarResult.items[0].productName, 'Sugar');
    assert.equal(sugarResult.items[0].quantity, '0.5');
    assert.equal(sugarResult.items[0].lineTotal, '22.50');
    assert.equal(sugarResult.subtotal, '22.50');

    // 0.5 litre milk = 1 pouch @ ₹28.00
    const milkResult = await parseOrderTranscript('आधा लीटर दूध');
    assert.equal(milkResult.items.length, 1);
    assert.equal(milkResult.items[0].productName, 'Amul Taaza Milk');
    assert.equal(milkResult.items[0].lineTotal, '28.00');
    assert.equal(milkResult.subtotal, '28.00');
  });

  // Test Case 6: Conversational fillers & honorifics in Devanagari Hindi
  test('6. Devanagari fillers and honorifics (अरे भैया जी कृपया, दे दीजिए) are safely stripped', async () => {
    const transcript = 'अरे भैया जी कृपया दो किलो आटा दे दीजिए';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].productName, 'Aashirvaad Atta');
    assert.equal(result.items[0].quantity, '2');
    assert.equal(result.items[0].lineTotal, '110.00');
    assert.equal(result.subtotal, '110.00');
    assert.equal(result.needsClarification, false);
  });

  // Test Case 7: Incompatible unit conversion in Hindi
  test('7. Incompatible unit (e.g. "एक किलो मैगी", "एक लीटर चीनी") returns UNSUPPORTED_UNIT and clarification', async () => {
    const result = await parseOrderTranscript('एक किलो मैगी');

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].productName, 'Maggi Noodles');
    assert.equal(result.items[0].status, 'UNSUPPORTED_UNIT');
    assert.equal(result.items[0].lineTotal, null);
    assert.equal(result.needsClarification, true);
    assert.ok(result.clarificationQuestions.length > 0);
  });

  // Test Case 8: Missing quantity in Hindi
  test('8. Missing quantity (e.g. "दूध देना") returns MISSING_QUANTITY with clarification question', async () => {
    const result = await parseOrderTranscript('दूध देना');

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].productName, 'Amul Taaza Milk');
    assert.equal(result.items[0].status, 'MISSING_QUANTITY');
    assert.equal(result.items[0].quantity, null);
    assert.equal(result.items[0].lineTotal, null);
    assert.equal(result.needsClarification, true);
    assert.ok(result.clarificationQuestions.some((q) => q.includes('Amul Taaza Milk')));
  });

  // Test Case 9: Missing product in Hindi
  test('9. Missing product (e.g. "२ पैकेट देना") returns MISSING_PRODUCT with clarification question', async () => {
    const result = await parseOrderTranscript('२ पैकेट देना');

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].status, 'MISSING_PRODUCT');
    assert.equal(result.items[0].quantity, '2');
    assert.equal(result.items[0].unit, 'packet');
    assert.equal(result.items[0].productName, null);
    assert.equal(result.needsClarification, true);
    assert.ok(result.clarificationQuestions.some((q) => q.includes('2 packet')));
  });

  // Test Case 10: Ambiguous product brand in Hindi
  test('10. Ambiguous brand (e.g. "२ पैकेट अमुल") returns AMBIGUOUS with Amul candidate options', async () => {
    const result = await parseOrderTranscript('२ पैकेट अमुल');

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].status, 'AMBIGUOUS');
    assert.equal(result.items[0].candidates.length, 2);
    const candidateNames = result.items[0].candidates.map((c) => c.name);
    assert.ok(candidateNames.includes('Amul Taaza Milk'));
    assert.ok(candidateNames.includes('Amul Butter'));
    assert.equal(result.needsClarification, true);
  });

  // Test Case 11: Unknown product in Hindi
  test('11. Unknown product (e.g. "२ किलो चावल") returns UNMATCHED with clarification', async () => {
    const result = await parseOrderTranscript('२ किलो चावल');

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].status, 'UNMATCHED');
    assert.equal(result.items[0].productName, 'चावल');
    assert.equal(result.needsClarification, true);
    assert.ok(result.clarificationQuestions.some((q) => q.includes('चावल')));
  });

  // Test Case 12: Danda punctuation splitting
  test('12. Danda punctuation splitting (।): "दो किलो आटा। एक लीटर सनफ्लावर तेल।"', async () => {
    const transcript = 'दो किलो आटा। एक लीटर सनफ्लावर तेल।';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].productName, 'Aashirvaad Atta');
    assert.equal(result.items[0].lineTotal, '110.00');

    assert.equal(result.items[1].productName, 'Fortune Sunflower Oil');
    assert.equal(result.items[1].lineTotal, '150.00');

    assert.equal(result.subtotal, '260.00');
    assert.equal(result.needsClarification, false);
  });

  // Test Case 13: Mixed-language code switching (Hindi + English + Hinglish in one order)
  test('13. Mixed code switching: "2 kg आटा aur three packet मैगी"', async () => {
    const transcript = '2 kg आटा aur three packet मैगी';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].productName, 'Aashirvaad Atta');
    assert.equal(result.items[0].lineTotal, '110.00');

    assert.equal(result.items[1].productName, 'Maggi Noodles');
    assert.equal(result.items[1].lineTotal, '45.00');

    assert.equal(result.subtotal, '155.00');
    assert.equal(result.needsClarification, false);
  });

  // Test Case 14: Composite brand name Parle-G in Devanagari Hindi
  test('14. Parle-G in Hindi: "दो पैकेट पारले जी"', async () => {
    const transcript = 'दो पैकेट पारले जी';
    const result = await parseOrderTranscript(transcript);

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].productName, 'Parle-G Biscuits');
    assert.equal(result.items[0].quantity, '2');
    assert.equal(result.items[0].unit, 'packet');
    assert.equal(result.items[0].lineTotal, '20.00');
    assert.equal(result.subtotal, '20.00');
    assert.equal(result.needsClarification, false);
  });
});
