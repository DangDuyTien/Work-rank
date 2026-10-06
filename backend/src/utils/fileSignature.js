'use strict';

const fs = require('fs');

/**
 * Check if a file matches expected magic bytes signatures.
 *
 * @param {string} filePath - Absolute path to the saved file
 * @param {'image'|'audio'} category
 * @returns {Promise<boolean>}
 */
async function validateFileSignature(filePath, category) {
  try {
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    if (category === 'image') {
      // JPEG: FF D8 FF
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return true;
      }
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      ) {
        return true;
      }
      // GIF: 47 49 46 38 (GIF87a / GIF89a)
      if (
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38
      ) {
        return true;
      }
      // WEBP: 52 49 46 46 .... 57 45 42 50 (RIFF....WEBP)
      if (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
      ) {
        return true;
      }

      return false;
    }

    if (category === 'audio') {
      // MP3 with ID3: 49 44 33 ("ID3")
      if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
        return true;
      }
      // MP3 raw frame sync: FF FB, FF F3, FF F2, FF E3
      if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
        return true;
      }
      // OGG: 4F 67 67 53 ("OggS")
      if (
        buffer[0] === 0x4f &&
        buffer[1] === 0x67 &&
        buffer[2] === 0x67 &&
        buffer[3] === 0x53
      ) {
        return true;
      }
      // WAV: 52 49 46 46 .... 57 41 56 45 (RIFF....WAVE)
      if (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x41 &&
        buffer[10] === 0x56 &&
        buffer[11] === 0x45
      ) {
        return true;
      }
      // FLAC: 66 4C 61 43 ("fLaC")
      if (
        buffer[0] === 0x66 &&
        buffer[1] === 0x4c &&
        buffer[2] === 0x61 &&
        buffer[3] === 0x43
      ) {
        return true;
      }
      // MP4 / M4A / AAC: ....ftyp (offset 4)
      if (
        buffer[4] === 0x66 &&
        buffer[5] === 0x74 &&
        buffer[6] === 0x79 &&
        buffer[7] === 0x70
      ) {
        return true;
      }
      // WebM audio: 1A 45 DF A3 (EBML)
      if (
        buffer[0] === 0x1a &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xdf &&
        buffer[3] === 0xa3
      ) {
        return true;
      }

      return false;
    }

    return false;
  } catch {
    return false;
  }
}

module.exports = {
  validateFileSignature,
};
