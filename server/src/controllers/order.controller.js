/**
 * Order Controller
 * Handles HTTP requests for order understanding and parsing
 */

import { parseOrderTranscript } from '../services/orderUnderstanding.service.js';

/**
 * Controller to handle POST /api/orders/parse
 */
export const parseOrder = async (req, res, next) => {
  try {
    const { transcript } = req.body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Transcript is required and must be a non-empty string',
      });
    }

    const draftOrder = await parseOrderTranscript(transcript);

    return res.status(200).json({
      success: true,
      data: draftOrder,
    });
  } catch (error) {
    next(error);
  }
};

