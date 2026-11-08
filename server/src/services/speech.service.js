/**
 * Speech Service
 * Coordinates voice transcription via Gnani Prisma STT and draft order generation
 * via the Order Understanding Engine.
 */

import { transcribeAudio } from './gnaniPrisma.service.js';
import { parseOrderTranscript } from './orderUnderstanding.service.js';
import { logger } from '../utils/logger.js';

/**
 * Processes customer voice order audio
 * 1. Transcribes audio using Gnani Prisma STT REST API
 * 2. Parses transcript using Order Understanding Engine
 * 3. Returns structured draft order with speech metadata
 *
 * @param {object} params
 * @param {Buffer} params.audioBuffer - Raw binary audio buffer from multer
 * @param {string} params.filename - File name of the audio recording
 * @param {string} params.mimeType - MIME type of the audio recording
 * @param {string} [params.languageCode] - Optional language code override
 * @param {string} [params.preferredLanguage] - Optional preferred language hint
 * @param {string} [params.format] - Optional format (verbatim, transcribe, codemix, transliterate)
 * @param {string|boolean} [params.itnNativeNumerals] - Optional ITN numeral formatting
 * @param {Function} [params.customFetch] - Optional custom fetch function for testing
 * @returns {Promise<object>} Draft order response with audio transcription metadata
 */
export const processVoiceOrder = async ({
  audioBuffer,
  filename,
  mimeType,
  languageCode,
  preferredLanguage,
  format,
  itnNativeNumerals,
  storeId,
  customFetch,
}) => {
  logger.info(`Processing voice order (filename: ${filename}, mimeType: ${mimeType}, size: ${audioBuffer?.length || 0} bytes)`);

  // 1. Transcribe audio via Gnani Prisma v3 STT
  const sttResult = await transcribeAudio({
    audioBuffer,
    filename,
    mimeType,
    languageCode,
    preferredLanguage,
    format,
    itnNativeNumerals,
    customFetch,
  });

  const { transcript, requestId, detectedLanguage, model, processingTime } = sttResult;

  const audioMetadata = {
    requestId,
    detectedLanguage,
    model,
    processingTime,
  };

  // 2. Handle empty or silent transcripts gracefully
  if (!transcript || transcript.trim().length === 0) {
    logger.warn('Gnani Prisma returned empty transcript (no speech detected)');
    return {
      transcript: '',
      audio: audioMetadata,
      items: [],
      subtotal: '0.00',
      needsClarification: true,
      clarificationQuestions: [
        'We could not detect any speech in your audio. Please speak your order clearly.',
      ],
    };
  }

  // 3. Parse transcript into structured draft order via Order Understanding Engine (scoped to store if provided)
  const draftOrder = await parseOrderTranscript(transcript, { storeId });

  // 4. Return combined draft order with audio metadata
  return {
    ...draftOrder,
    audio: audioMetadata,
  };
};

export default {
  processVoiceOrder,
};

