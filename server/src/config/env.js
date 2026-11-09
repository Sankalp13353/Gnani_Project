import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  // Gnani Prisma Speech-to-Text configuration
  gnaniApiKeyId: process.env.GNANI_API_KEY_ID || '',
  gnaniSttUrl: process.env.GNANI_STT_URL || 'https://api.vachana.ai/stt/v3',
  gnaniModel: process.env.GNANI_MODEL || 'prisma-v3.0',
  gnaniLanguageCode: process.env.GNANI_LANGUAGE_CODE || 'indic-auto',
  gnaniTimeoutMs: process.env.GNANI_TIMEOUT_MS ? parseInt(process.env.GNANI_TIMEOUT_MS, 10) : 15000,
  maxAudioSizeBytes: process.env.MAX_AUDIO_SIZE_BYTES ? parseInt(process.env.MAX_AUDIO_SIZE_BYTES, 10) : 10 * 1024 * 1024,
  // Authentication & Security configuration
  jwtSecret: process.env.JWT_SECRET || 'callsaar_dev_jwt_secret_key_change_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  authCookieName: process.env.AUTH_COOKIE_NAME || 'callsaar_token',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production'
};
