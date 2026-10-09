'use strict';

const fs = require('fs');
const path = require('path');
const { Drawing, DrawingLike } = require('../models');

/**
 * Ensures drawing tables and upload storage directories exist self-healingly.
 */
async function ensureDrawingSchema(sequelize) {
  try {
    // 1. Ensure upload directory exists
    const uploadsDir = path.resolve(__dirname, '../../uploads/drawings');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // 2. Sync Drawing models safely
    await Drawing.sync();
    await DrawingLike.sync();
  } catch (err) {
    console.warn('[DrawingSchema] Schema safety sync warning (non-fatal):', err.message);
  }
}

module.exports = { ensureDrawingSchema };
