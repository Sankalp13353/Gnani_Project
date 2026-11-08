/**
 * Phase 4: Gnani Prisma Speech-to-Text Integration Test Suite
 * Tests speech intake, validation, Gnani API mocking, error handling & serialization,
 * audio metadata handling, and zero database persistence.
 */

import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import prisma, { disconnectPrisma } from '../src/config/prisma.js';
import { config } from '../src/config/env.js';
import { transcribeAudio, extractErrorDetails } from '../src/services/gnaniPrisma.service.js';
import { processVoiceOrder } from '../src/services/speech.service.js';
import app from '../src/app.js';

describe('CallSaar Phase 4: Gnani Prisma Speech-to-Text Integration', () => {
  let server;
  let serverUrl;
  let originalApiKey;
  let originalFetch;

  before(async () => {
    originalApiKey = config.gnaniApiKeyId;
    originalFetch = globalThis.fetch;

    // Start ephemeral server for HTTP route testing
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        serverUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    config.gnaniApiKeyId = originalApiKey;
    globalThis.fetch = originalFetch;

    await new Promise((resolve) => server.close(resolve));
    await disconnectPrisma();
  });

  beforeEach(() => {
    // Ensure standard test API key is set for mocking tests
    config.gnaniApiKeyId = 'test_gnani_api_key_12345';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    config.gnaniApiKeyId = originalApiKey;
  });

  // Test 1: Missing audio buffer in service rejects with 400
  test('1. Empty audio buffer in transcribeAudio rejects with 400', async () => {
    await assert.rejects(
      async () => {
        await transcribeAudio({
          audioBuffer: Buffer.alloc(0),
          filename: 'empty.wav',
          mimeType: 'audio/wav',
        });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.ok(err.message.includes('Audio buffer is empty'));
        return true;
      }
    );
  });

  // Test 2: Missing GNANI_API_KEY_ID returns 503 Service Unavailable
  test('2. Missing GNANI_API_KEY_ID returns 503 with configuration error message', async () => {
    config.gnaniApiKeyId = '';

    await assert.rejects(
      async () => {
        await transcribeAudio({
          audioBuffer: Buffer.from('RIFF....WAVEfmt'),
          filename: 'test.wav',
          mimeType: 'audio/wav',
        });
      },
      (err) => {
        assert.equal(err.status, 503);
        assert.equal(err.isConfigError, true);
        assert.ok(err.message.includes('GNANI_API_KEY_ID'));
        return true;
      }
    );
  });

  // Test 3: Gnani Authentication Failure (401/403) returns 502 Bad Gateway
  test('3. Gnani API authentication failure (HTTP 401) returns 502 without leaking credentials', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({ message: 'Invalid API Key' }),
    });

    await assert.rejects(
      async () => {
        await transcribeAudio({
          audioBuffer: Buffer.from('dummy_audio_bytes'),
          filename: 'test.wav',
          mimeType: 'audio/wav',
          customFetch: mockFetch,
        });
      },
      (err) => {
        assert.equal(err.status, 502);
        assert.ok(err.message.includes('authentication failed'));
        assert.ok(!err.message.includes('test_gnani_api_key_12345'));
        return true;
      }
    );
  });

  // Test 4: Gnani Timeout returns 504 Gateway Timeout
  test('4. Gnani API timeout returns 504 Gateway Timeout', async () => {
    const mockFetch = async () => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    };

    await assert.rejects(
      async () => {
        await transcribeAudio({
          audioBuffer: Buffer.from('dummy_audio_bytes'),
          filename: 'test.wav',
          mimeType: 'audio/wav',
          customFetch: mockFetch,
        });
      },
      (err) => {
        assert.equal(err.status, 504);
        assert.ok(err.message.includes('timed out'));
        return true;
      }
    );
  });

  // Test 5: Gnani Network / Connection failure returns 502 Bad Gateway
  test('5. Gnani network failure returns 502 Bad Gateway', async () => {
    const mockFetch = async () => {
      throw new Error('fetch failed: ECONNREFUSED');
    };

    await assert.rejects(
      async () => {
        await transcribeAudio({
          audioBuffer: Buffer.from('dummy_audio_bytes'),
          filename: 'test.wav',
          mimeType: 'audio/wav',
          customFetch: mockFetch,
        });
      },
      (err) => {
        assert.equal(err.status, 502);
        assert.ok(err.message.includes('Unable to connect to speech recognition service'));
        return true;
      }
    );
  });

  // Test 6: Invalid JSON response from provider returns 502
  test('6. Invalid provider JSON returns 502', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token < in JSON at position 0');
      },
    });

    await assert.rejects(
      async () => {
        await transcribeAudio({
          audioBuffer: Buffer.from('dummy_audio_bytes'),
          filename: 'test.wav',
          mimeType: 'audio/wav',
          customFetch: mockFetch,
        });
      },
      (err) => {
        assert.equal(err.status, 502);
        assert.ok(err.message.includes('Invalid response received'));
        return true;
      }
    );
  });

  // Test 7: Empty or silent audio returns clarification request
  test('7. Silent audio (empty transcript) returns clarification request', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        request_id: 'req_silent_001',
        transcript: '',
        model: 'prisma-v3.0',
        detected_language_code: 'indic-auto',
        processing_time: 0.15,
      }),
    });

    const result = await processVoiceOrder({
      audioBuffer: Buffer.from('silent_audio_bytes'),
      filename: 'silent.wav',
      mimeType: 'audio/wav',
      customFetch: mockFetch,
    });

    assert.equal(result.transcript, '');
    assert.equal(result.needsClarification, true);
    assert.equal(result.items.length, 0);
    assert.equal(result.subtotal, '0.00');
    assert.ok(result.clarificationQuestions.some(q => q.includes('could not detect any speech')));
    assert.equal(result.audio.requestId, 'req_silent_001');
  });

  // Test 8: Successful English voice order transcription + parsing
  test('8. Successful English voice order transcription and structured order parsing', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        request_id: 'req_eng_002',
        transcript: '2 kg atta and 1 litre sunflower oil',
        model: 'prisma-v3.0',
        detected_language_code: 'en-IN',
        processing_time: 0.45,
      }),
    });

    const result = await processVoiceOrder({
      audioBuffer: Buffer.from('dummy_english_audio'),
      filename: 'english_order.wav',
      mimeType: 'audio/wav',
      customFetch: mockFetch,
    });

    assert.equal(result.transcript, '2 kg atta and 1 litre sunflower oil');
    assert.equal(result.needsClarification, false);
    assert.equal(result.items.length, 2);

    assert.equal(result.items[0].productName, 'Aashirvaad Atta');
    assert.equal(result.items[0].quantity, '2');
    assert.equal(result.items[0].unit, 'kg');
    assert.equal(result.items[0].lineTotal, '110.00');

    assert.equal(result.items[1].productName, 'Fortune Sunflower Oil');
    assert.equal(result.items[1].quantity, '1');
    assert.equal(result.items[1].unit, 'litre');
    assert.equal(result.items[1].lineTotal, '150.00');

    assert.equal(result.subtotal, '260.00');
    assert.equal(result.audio.requestId, 'req_eng_002');
    assert.equal(result.audio.detectedLanguage, 'en-IN');
    assert.equal(result.audio.model, 'prisma-v3.0');
    assert.equal(result.audio.processingTime, 0.45);
  });

  // Test 9: Successful Hindi / Hinglish voice order transcription + parsing
  test('9. Successful Hindi/Hinglish voice order (Bhaiya, 2 kilo atta, ek litre sunflower oil aur 3 Maggi de dena.)', async () => {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        request_id: 'req_hinglish_003',
        transcript: 'Bhaiya, 2 kilo atta, ek litre sunflower oil aur 3 Maggi de dena.',
        model: 'prisma-v3.0',
        detected_language_code: 'hi-IN',
        processing_time: 0.52,
      }),
    });

    const result = await processVoiceOrder({
      audioBuffer: Buffer.from('dummy_hinglish_audio'),
      filename: 'hinglish_order.wav',
      mimeType: 'audio/wav',
      customFetch: mockFetch,
    });

    assert.equal(result.transcript, 'Bhaiya, 2 kilo atta, ek litre sunflower oil aur 3 Maggi de dena.');
    assert.equal(result.needsClarification, false);
    assert.equal(result.items.length, 3);

    // Atta: 2 * 55 = 110.00
    assert.equal(result.items[0].productName, 'Aashirvaad Atta');
    assert.equal(result.items[0].lineTotal, '110.00');

    // Oil: 1 * 150 = 150.00
    assert.equal(result.items[1].productName, 'Fortune Sunflower Oil');
    assert.equal(result.items[1].lineTotal, '150.00');

    // Maggi: 3 * 15 = 45.00
    assert.equal(result.items[2].productName, 'Maggi Noodles');
    assert.equal(result.items[2].lineTotal, '45.00');

    assert.equal(result.subtotal, '305.00');
    assert.equal(result.audio.detectedLanguage, 'hi-IN');
  });

  // Test 10: Zero database persistence guarantee (draft orders are NOT stored in PostgreSQL)
  test('10. Processing a voice order does NOT persist rows in database Order or OrderItem tables', async () => {
    const initialOrdersCount = await prisma.order.count();
    const initialOrderItemsCount = await prisma.orderItem.count();

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        request_id: 'req_persist_check',
        transcript: '1 kg sugar aur 2 packet milk',
        model: 'prisma-v3.0',
        detected_language_code: 'hi-IN',
        processing_time: 0.38,
      }),
    });

    const result = await processVoiceOrder({
      audioBuffer: Buffer.from('dummy_audio'),
      filename: 'check.wav',
      mimeType: 'audio/wav',
      customFetch: mockFetch,
    });

    assert.equal(result.items.length, 2);
    assert.equal(result.subtotal, '101.00'); // Sugar: ₹45 + Milk: 2 * ₹28 = ₹101.00

    const finalOrdersCount = await prisma.order.count();
    const finalOrderItemsCount = await prisma.orderItem.count();

    assert.equal(finalOrdersCount, initialOrdersCount);
    assert.equal(finalOrderItemsCount, initialOrderItemsCount);
  });

  // Test 11: HTTP Endpoint POST /api/speech/transcribe - missing audio file returns 400
  test('11. HTTP POST /api/speech/transcribe without audio file returns 400', async () => {
    const res = await fetch(`${serverUrl}/api/speech/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('Audio file is required'));
  });

  // Test 12: HTTP Endpoint POST /api/speech/transcribe - unsupported file type returns 400
  test('12. HTTP POST /api/speech/transcribe with unsupported mime type returns 400', async () => {
    const formData = new FormData();
    const textBlob = new Blob(['This is plain text, not audio'], { type: 'text/plain' });
    formData.append('audio_file', textBlob, 'order.txt');

    const res = await fetch(`${serverUrl}/api/speech/transcribe`, {
      method: 'POST',
      body: formData,
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('Unsupported audio format'));
  });

  // Test 13: HTTP Endpoint POST /api/speech/transcribe - End-to-end mocked voice order
  test('13. HTTP POST /api/speech/transcribe with valid audio returns 200 with draft order', async () => {
    // Intercept global fetch for this HTTP test
    globalThis.fetch = async (url, options) => {
      if (url.toString().includes('vachana.ai')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            request_id: 'http_req_001',
            transcript: '500 gram sugar aur 1 litre sunflower oil',
            model: 'prisma-v3.0',
            detected_language_code: 'indic-auto',
            processing_time: 0.42,
          }),
        };
      }
      return originalFetch(url, options);
    };

    const formData = new FormData();
    const audioBlob = new Blob([Buffer.from('RIFF1234WAVEfmt audio')], { type: 'audio/wav' });
    formData.append('audio_file', audioBlob, 'sample.wav');
    formData.append('language_code', 'indic-auto');

    const res = await fetch(`${serverUrl}/api/speech/transcribe`, {
      method: 'POST',
      body: formData,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.transcript, '500 gram sugar aur 1 litre sunflower oil');
    assert.equal(body.data.items.length, 2);

    // 500g sugar @ 45/kg = 22.50
    assert.equal(body.data.items[0].productName, 'Sugar');
    assert.equal(body.data.items[0].lineTotal, '22.50');

    // 1 litre oil = 150.00
    assert.equal(body.data.items[1].productName, 'Fortune Sunflower Oil');
    assert.equal(body.data.items[1].lineTotal, '150.00');

    // Subtotal: 172.50
    assert.equal(body.data.subtotal, '172.50');
    assert.equal(body.data.audio.requestId, 'http_req_001');
  });

  // Test 14: Safe Error Serialization - Nested Gnani Error Object (Never [object Object])
  test('14. extractErrorDetails safely extracts nested Gnani error and never produces [object Object]', async () => {
    const mockGnaniResponse = {
      status: 400,
      headers: new Headers({
        'content-type': 'application/json',
        'x-request-id': 'req_error_nested_001',
      }),
      text: async () =>
        JSON.stringify({
          success: false,
          error: {
            type: 'UNSUPPORTED_AUDIO_FORMAT',
            message: 'Unsupported audio format. Supported formats: aac, ogg, mp3, m4a, flac, wav',
          },
        }),
    };

    const errorInfo = await extractErrorDetails(mockGnaniResponse);

    assert.equal(errorInfo.status, 400);
    assert.equal(errorInfo.requestId, 'req_error_nested_001');
    assert.equal(
      errorInfo.message,
      'Unsupported audio format. Supported formats: aac, ogg, mp3, m4a, flac, wav'
    );
    assert.ok(!errorInfo.message.includes('[object Object]'));
    assert.ok(!errorInfo.rawBody.includes('[object Object]'));
  });

  // Test 15: Safe Error Serialization - Plain Text Response
  test('15. extractErrorDetails safely handles non-JSON plain text response', async () => {
    const mockPlainTextResponse = {
      status: 502,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: async () => 'Bad Gateway: Upstream connection failed',
    };

    const errorInfo = await extractErrorDetails(mockPlainTextResponse);

    assert.equal(errorInfo.status, 502);
    assert.equal(errorInfo.message, 'Bad Gateway: Upstream connection failed');
    assert.ok(!errorInfo.message.includes('[object Object]'));
  });

  // Test 16: Safe Error Serialization - Array Error Details (e.g. Validation errors)
  test('16. extractErrorDetails safely handles array error detail format', async () => {
    const mockValidationResponse = {
      status: 422,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () =>
        JSON.stringify({
          detail: [{ msg: 'Field audio_file is required' }, { msg: 'Invalid language_code' }],
        }),
    };

    const errorInfo = await extractErrorDetails(mockValidationResponse);

    assert.equal(errorInfo.status, 422);
    assert.ok(errorInfo.message.includes('Field audio_file is required'));
    assert.ok(errorInfo.message.includes('Invalid language_code'));
    assert.ok(!errorInfo.message.includes('[object Object]'));
  });

  // Test 17: HTTP 400 Provider Error in transcribeAudio propagates clear message (not [object Object])
  test('17. transcribeAudio propagates structured 400 error cleanly to caller without [object Object]', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () =>
        JSON.stringify({
          success: false,
          error: {
            type: 'UNSUPPORTED_AUDIO_FORMAT',
            message: 'Unsupported audio format. Supported formats: aac, ogg, mp3, m4a, flac, wav',
          },
        }),
    });

    await assert.rejects(
      async () => {
        await transcribeAudio({
          audioBuffer: Buffer.from('dummy_bytes'),
          filename: 'recording.webm',
          mimeType: 'audio/webm',
          customFetch: mockFetch,
        });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.ok(err.message.includes('Unsupported audio format'));
        assert.ok(!err.message.includes('[object Object]'));
        return true;
      }
    );
  });

  // Test 18: Form Data Construction - Verifies all required & optional fields
  test('18. transcribeAudio correctly populates multipart form fields (audio_file, model, format, etc.)', async () => {
    let capturedBody = null;
    let capturedHeaders = null;

    const mockFetch = async (url, options) => {
      capturedHeaders = options.headers;
      capturedBody = options.body;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          request_id: 'req_fields_check',
          transcript: 'test order',
          model: 'prisma-v3.0',
          detected_language_code: 'hi-IN',
          processing_time: 0.1,
        }),
      };
    };

    await transcribeAudio({
      audioBuffer: Buffer.from('RIFF_test_pcm_bytes'),
      filename: 'my_order.wav',
      mimeType: 'audio/wav',
      languageCode: 'indic-auto',
      preferredLanguage: 'hi-IN',
      format: 'codemix',
      itnNativeNumerals: false,
      customFetch: mockFetch,
    });

    assert.ok(capturedHeaders['X-API-Key-ID']);
    assert.equal(capturedBody.get('model'), 'prisma-v3.0');
    assert.equal(capturedBody.get('language_code'), 'indic-auto');
    assert.equal(capturedBody.get('preferred_language'), 'hi-IN');
    assert.equal(capturedBody.get('format'), 'codemix');
    assert.equal(capturedBody.get('itn_native_numerals'), 'false');
    assert.ok(capturedBody.get('audio_file'));
  });

  // Test 19: Rejection of WebM upload in API routes with informative guidance
  test('19. HTTP POST /api/speech/transcribe rejects .webm with clear guidance', async () => {
    const formData = new FormData();
    const webmBlob = new Blob([Buffer.from('webm_bytes')], { type: 'audio/webm' });
    formData.append('audio_file', webmBlob, 'order.webm');

    const res = await fetch(`${serverUrl}/api/speech/transcribe`, {
      method: 'POST',
      body: formData,
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes('WebM is not supported'));
  });
});
