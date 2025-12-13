import IORedis from 'ioredis';

// Railway automatically provides REDIS_URL with password included.
// Format: redis://:password@host:port
const connectionString = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisConnection = new IORedis(connectionString, {
  // ⚠️ CRITICAL: BullMQ requires this setting to be null
  maxRetriesPerRequest: null, 
});