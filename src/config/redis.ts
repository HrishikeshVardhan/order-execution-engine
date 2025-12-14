// src/config/redis.ts
import { ConnectionOptions } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

let redisConnection: ConnectionOptions;

// Helper: create base connection object and optionally enable TLS
if (process.env.REDIS_URL) {
  const url = new URL(process.env.REDIS_URL);
  const port = url.port ? parseInt(url.port, 10) : 6379;

  const base: ConnectionOptions = {
    host: url.hostname,
    port,
    password: url.password || undefined,
    username: url.username || undefined,
    maxRetriesPerRequest: null,
  };

  // If the URL uses TLS (e.g. rediss://...) enable tls option for ioredis/BullMQ.
  // BullMQ's ConnectionOptions doesn't include `tls` in its type, so we cast to any.
  if (url.protocol === 'rediss:') {
    // Some hosted Redis instances require TLS. Provide an empty tls object to enable it.
    // If you get certificate issues, you can set { rejectUnauthorized: false } temporarily.
    (base as any).tls = {};
  }

  redisConnection = base;
} else {
  // Local development fallback
  redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
  };
}

export { redisConnection };