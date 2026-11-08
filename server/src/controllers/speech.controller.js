/**
 * Speech Controller
 * Handles incoming audio uploads for transcription and voice order parsing.
 */

import { processVoiceOrder } from '../services/speech.service.js';
import { logger } from '../utils/logger.js';

/**
 * Controller to handle POST /api/speech/transcribe
 * Accepts multipart/form-data containing an audio file
 */
export const transcribeAndParseOrder = async (req, res, next) => {
  try {
    // Locate the uploaded audio file from req.file or req.files
    let audioFile = req.file;

    if (!audioFile && req.files && req.files.length > 0) {
      audioFile = req.files.find(f => f.fieldname === 'audio_file' || f.fieldname === 'audio') || req.files[0];
    }

    if (!audioFile || !audioFile.buffer || audioFile.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Audio file is required under field 'audio_file' or 'audio'.",
      });
    }

    const { language_code, preferred_language, format, itn_native_numerals, store_id, storeId } = req.body || {};
    const languageCode = language_code || 'indic-auto';
    const preferredLanguage = preferred_language || undefined;
    const targetStoreId = store_id || storeId || undefined;

    logger.info(`Received speech transcription request: ${audioFile.originalname} (${audioFile.mimetype}, ${audioFile.size} bytes)`);

    const result = await processVoiceOrder({
      audioBuffer: audioFile.buffer,
      filename: audioFile.originalname || 'recording.wav',
      mimeType: audioFile.mimetype || 'audio/wav',
      languageCode,
      preferredLanguage,
      format,
      itnNativeNumerals: itn_native_numerals,
      storeId: targetStoreId,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  transcribeAndParseOrder,
};

