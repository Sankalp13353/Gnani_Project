/**
 * Gnani Prisma Speech-to-Text Service
 * Connects to Gnani Vachana STT v3 REST API (https://api.vachana.ai/stt/v3)
 * Supports multilingual and code-mixed (Hindi/English/Hinglish) audio transcription
 */

import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Safely extracts human-readable error details from a Gnani STT HTTP response
 * Handles structured JSON (nested & flat), arrays, plain-text bodies, and headers.
 * Never outputs '[object Object]' or leaks credentials.
 *
 * @param {Response} response - Fetch API Response object
 * @returns {Promise<{ message: string, rawBody: string, status: number, contentType: string, requestId: string|null }>}
 */
export const extractErrorDetails = async (response) => {
  const contentType = response.headers?.get?.('content-type') || '';
  const headerRequestId = response.headers?.get?.('x-request-id') || null;
  let rawBody = '';
  let parsedJson = null;

  try {
    rawBody = await response.text();
    if (rawBody && (contentType.includes('application/json') || rawBody.trim().startsWith('{') || rawBody.trim().startsWith('['))) {
      parsedJson = JSON.parse(rawBody);
    }
  } catch {
    // If text extraction or JSON parsing fails, fall back gracefully
  }

  let errorMessage = '';
  let requestId = headerRequestId;

  if (parsedJson && typeof parsedJson === 'object') {
    requestId = parsedJson.request_id || parsedJson.requestId || headerRequestId;

    if (parsedJson.error && typeof parsedJson.error === 'object') {
      // Gnani v3 format: { success: false, error: { type: "UNSUPPORTED_AUDIO_FORMAT", message: "..." } }
      errorMessage = parsedJson.error.message || parsedJson.error.detail || parsedJson.error.type || JSON.stringify(parsedJson.error);
    } else if (typeof parsedJson.error === 'string' && parsedJson.error.trim().length > 0) {
      errorMessage = parsedJson.error.trim();
    } else if (typeof parsedJson.message === 'string' && parsedJson.message.trim().length > 0) {
      errorMessage = parsedJson.message.trim();
    } else if (typeof parsedJson.detail === 'string' && parsedJson.detail.trim().length > 0) {
      errorMessage = parsedJson.detail.trim();
    } else if (Array.isArray(parsedJson.detail) && parsedJson.detail.length > 0) {
      errorMessage = parsedJson.detail
        .map((d) => (typeof d === 'string' ? d : d.msg || d.message || JSON.stringify(d)))
        .join('; ');
    } else if (Array.isArray(parsedJson.errors) && parsedJson.errors.length > 0) {
      errorMessage = parsedJson.errors
        .map((e) => (typeof e === 'string' ? e : e.message || e.msg || JSON.stringify(e)))
        .join('; ');
    } else {
      errorMessage = JSON.stringify(parsedJson);
    }
  } else if (rawBody && rawBody.trim().length > 0) {
    errorMessage = rawBody.trim();
  } else {
    errorMessage = response.statusText || 'Speech recognition service error';
  }

  return {
    message: errorMessage,
    rawBody: parsedJson ? JSON.stringify(parsedJson) : (rawBody || response.statusText || ''),
    status: response.status,
    contentType,
    requestId,
  };
};

/**
 * Transcribes an audio buffer using Gnani Prisma v3 STT REST API
 * @param {object} params
 * @param {Buffer} params.audioBuffer - Raw binary audio file buffer
 * @param {string} params.filename - Audio file name (e.g. order.wav, order.mp3)
 * @param {string} params.mimeType - MIME type (e.g. audio/wav, audio/mpeg)
 * @param {string} [params.languageCode] - Optional override for language code (defaults to config.gnaniLanguageCode)
 * @param {string} [params.preferredLanguage] - Optional preferred language hint
 * @param {string} [params.format] - Optional format (verbatim, transcribe, codemix, transliterate)
 * @param {string|boolean} [params.itnNativeNumerals] - Optional ITN numeral formatting
 * @param {Function} [params.customFetch] - Optional custom fetch instance for unit test mocking
 * @returns {Promise<object>} { transcript, requestId, detectedLanguage, model, processingTime }
 */
export const transcribeAudio = async ({
  audioBuffer,
  filename = 'recording.wav',
  mimeType = 'audio/wav',
  languageCode,
  preferredLanguage,
  format,
  itnNativeNumerals,
  customFetch,
}) => {
  const apiKey = config.gnaniApiKeyId;

  if (!apiKey || apiKey.trim().length === 0) {
    const error = new Error('Speech-to-text service is not configured. Please set GNANI_API_KEY_ID in server/.env.');
    error.status = 503;
    error.isConfigError = true;
    throw error;
  }

  if (!audioBuffer || audioBuffer.length === 0) {
    const error = new Error('Audio buffer is empty or missing.');
    error.status = 400;
    throw error;
  }

  const fetchFn = customFetch || globalThis.fetch;
  const endpoint = config.gnaniSttUrl;
  const model = config.gnaniModel;
  const lang = languageCode || config.gnaniLanguageCode;
  const outFormat = format !== undefined ? format : config.gnaniFormat;

  logger.info(`Sending audio to Gnani Prisma STT v3 (${model}, lang: ${lang}, size: ${audioBuffer.length} bytes, file: ${filename})`);

  // Construct multipart/form-data
  const formData = new FormData();
  const audioBlob = new Blob([audioBuffer], { type: mimeType });
  formData.append('audio_file', audioBlob, filename);
  if (model) {
    formData.append('model', model);
  }
  if (lang) {
    formData.append('language_code', lang);
  }
  if (preferredLanguage) {
    formData.append('preferred_language', preferredLanguage);
  }
  if (outFormat) {
    formData.append('format', outFormat);
  }
  if (itnNativeNumerals !== undefined) {
    formData.append('itn_native_numerals', String(itnNativeNumerals));
  }

  let response;
  try {
    const signal = AbortSignal.timeout(config.gnaniTimeoutMs);
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'X-API-Key-ID': apiKey,
      },
      body: formData,
      signal,
    });
  } catch (err) {
    logger.error('Gnani Prisma STT request failed:', err.message);
    if (err.name === 'TimeoutError' || err.code === 'ABORT_ERR') {
      const timeoutErr = new Error('Speech recognition service timed out. Please try recording again.');
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    const networkErr = new Error('Unable to connect to speech recognition service.');
    networkErr.status = 502;
    throw networkErr;
  }

  // Handle provider HTTP errors without leaking credentials
  if (!response.ok) {
    const errorInfo = await extractErrorDetails(response);

    logger.error(
      `Gnani Prisma STT returned HTTP ${errorInfo.status} (Content-Type: ${errorInfo.contentType || 'unknown'}, Request-ID: ${errorInfo.requestId || 'none'}): ${errorInfo.rawBody}`
    );

    if (response.status === 401 || response.status === 403) {
      const authError = new Error('Speech recognition authentication failed. Please verify GNANI_API_KEY_ID.');
      authError.status = 502;
      throw authError;
    }

    const providerError = new Error(`Speech recognition service error: ${errorInfo.message}`);
    providerError.status = response.status >= 500 ? 502 : response.status;
    providerError.requestId = errorInfo.requestId;
    throw providerError;
  }

  let result;
  try {
    result = await response.json();
  } catch (err) {
    logger.error('Failed to parse Gnani Prisma JSON response:', err.message);
    const parseError = new Error('Invalid response received from speech recognition provider.');
    parseError.status = 502;
    throw parseError;
  }

  if (result.success === false) {
    const errorMsg =
      (result.error && typeof result.error === 'object' ? result.error.message : result.error) ||
      result.message ||
      'Speech recognition failed.';
    const apiError = new Error(errorMsg);
    apiError.status = 502;
    throw apiError;
  }

  const transcript = typeof result.transcript === 'string' ? result.transcript.trim() : '';

  logger.info(
    `Gnani Prisma STT transcript received: "${transcript}" (detected: ${result.detected_language_code || 'unknown'}, req: ${result.request_id || 'none'})`
  );

  return {
    transcript,
    requestId: result.request_id || null,
    detectedLanguage: result.detected_language_code || lang,
    model: result.model || model,
    processingTime: result.processing_time || null,
    latency: result.end_to_end_latency || null,
  };
};

export default {
  transcribeAudio,
  extractErrorDetails,
};
