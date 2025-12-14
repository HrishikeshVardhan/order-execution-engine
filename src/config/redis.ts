// src/config/redis.ts
import { ConnectionOptions } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

const url = new URL(process.env.REDIS_URL!);

export const redisConnection: ConnectionOptions = {
  host: url.hostname,
  port: parseInt(url.port || '6379'),
  password: url.password || undefined,
};
