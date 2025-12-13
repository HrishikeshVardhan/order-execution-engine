// src/lib/queue.ts
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

// 'order-queue' is the key name in Redis
export const orderQueue = new Queue('order-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry failed trades 3 times
    backoff: {
      type: 'exponential',
      delay: 1000, // Wait 1s, then 2s, then 4s between retries
    },
    removeOnComplete: true, // Auto-delete successful jobs to save RAM
    removeOnFail: false, // Keep failed jobs for inspection
  },
});