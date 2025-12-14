// src/config/redis.ts
import { ConnectionOptions } from 'bullmq';

export const redisConnection: ConnectionOptions = process.env.REDIS_URL
  ? {
      url: process.env.REDIS_URL,
    }
  : {
      host: '127.0.0.1',
      port: 6379,
    };
