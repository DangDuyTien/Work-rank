'use strict';

/**
 * Adapter lưu ảnh trên object storage tương thích S3 (AWS S3, Cloudflare R2,
 * MinIO, Supabase Storage S3, Backblaze B2…).
 *
 * Object key là nguồn sự thật; URL public được suy ra từ `STORAGE_PUBLIC_BASE_URL`
 * nên đổi CDN/domain không cần update DB.
 */

const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');

function encodeKeyPath(key) {
  return String(key)
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function createS3DrawingStorageAdapter(config) {
  const {
    bucket,
    region,
    endpoint,
    forcePathStyle,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl,
  } = config;

  if (!bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    const err = new Error('S3 storage adapter thiếu cấu hình bắt buộc.');
    err.code = 'STORAGE_CONFIG_INVALID';
    throw err;
  }

  const client = new S3Client({
    region: region || 'auto',
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle: Boolean(forcePathStyle),
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    provider: 's3',
    persistent: true,

    getPublicUrl(key) {
      return `${publicBaseUrl}/${encodeKeyPath(key)}`;
    },

    async upload({ key, buffer, contentType, cacheControl }) {
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        const err = new Error('Buffer ảnh rỗng, không thể lưu.');
        err.code = 'EMPTY_UPLOAD';
        throw err;
      }
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType || 'application/octet-stream',
          ContentLength: buffer.length,
          CacheControl: cacheControl || 'public, max-age=31536000, immutable',
        })
      );
      return {
        key,
        url: this.getPublicUrl(key),
        provider: this.provider,
        contentType: contentType || 'application/octet-stream',
        sizeBytes: buffer.length,
      };
    },

    async delete({ key }) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        // S3 DeleteObject là idempotent: key không tồn tại vẫn trả success.
        return { key, deleted: true, alreadyMissing: false };
      } catch (err) {
        if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
          return { key, deleted: false, alreadyMissing: true };
        }
        throw err;
      }
    },

    async exists({ key }) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch (err) {
        if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') return false;
        throw err;
      }
    },
  };
}

module.exports = { createS3DrawingStorageAdapter };
