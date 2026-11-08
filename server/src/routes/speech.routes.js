/**
 * Speech Routes
 * Provides speech-to-text and voice order processing endpoints
 */

import { Router } from 'express';
import multer from 'multer';
import { config } from '../config/env.js';
import { transcribeAndParseOrder } from '../controllers/speech.controller.js';

const router = Router();

// In-memory audio upload configuration
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/aac',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/flac',
  'audio/x-flac',
]);

const ALLOWED_EXTENSIONS = new Set(['.wav', '.mp3', '.ogg', '.aac', '.mp4', '.m4a', '.flac']);

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxAudioSizeBytes,
  },
  fileFilter: (req, file, cb) => {
    const baseMime = file.mimetype.split(';')[0].trim().toLowerCase();
    const ext = file.originalname ? file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase() : '';

    const isAudioMime = ALLOWED_MIME_TYPES.has(baseMime) || ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase());
    const isAudioExt = ALLOWED_EXTENSIONS.has(ext);

    if (isAudioMime || isAudioExt) {
      cb(null, true);
    } else {
      const isWebm = baseMime === 'audio/webm' || ext === '.webm';
      const msg = isWebm
        ? "Unsupported audio format 'audio/webm'. Gnani Prisma STT supports: WAV, MP3, M4A, AAC, OGG, FLAC (WebM is not supported)."
        : `Unsupported audio format '${file.mimetype}'. Supported formats: WAV, MP3, M4A, AAC, OGG, FLAC.`;
      const err = new Error(msg);
      err.status = 400;
      cb(err, false);
    }
  },
});

// Middleware to safely catch multer upload errors
const handleAudioUpload = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: `Audio file exceeds maximum allowed size of ${Math.round(config.maxAudioSizeBytes / (1024 * 1024))}MB.`,
        });
      }
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          message: err.message,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed.',
      });
    }
    next();
  });
};

// POST /api/speech/transcribe - Transcribe audio recording and generate structured draft order
router.post('/speech/transcribe', handleAudioUpload, transcribeAndParseOrder);

export default router;
