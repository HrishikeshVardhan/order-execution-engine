// src/config/redis.ts
import { ConnectionOptions } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

let redisConnection: ConnectionOptions;

// Scenario 1: Production (Railway provides a full URL)
if (process.env.REDIS_URL) {
  const url = new URL(process.env.REDIS_URL);
  redisConnection = {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    password: url.password || undefined,
    username: url.username || undefined, // Railway sometimes uses a username
    maxRetriesPerRequest: null, // Required by BullMQ
  };
} 
// Scenario 2: Local Development (You provide Host/Port)
else {
  redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null, // Required by BullMQ
  };
}

export { redisConnection };