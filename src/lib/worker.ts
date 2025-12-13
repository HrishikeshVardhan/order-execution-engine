// src/lib/worker.ts
import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis'; // Import Redis for publishing events
import { redisConnection } from '../config/redis';
import { DexRouter } from './DexRouter';
// Add this helper function at the top of the file
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// 1. Initialize dependencies
const prisma = new PrismaClient();
const router = new DexRouter();

// 2. Create a dedicated Redis connection for publishing WebSocket events
// (BullMQ needs its own connection, so we create a separate one for Pub/Sub)
const redisPublisher = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

/**
 * Helper: Publish updates to Redis.
 * The WebSocket server listens to these channels and forwards them to the frontend.
 */
async function publishUpdate(orderId: string, status: string, data: any = {}) {
    
  const channel = `order-updates:${orderId}`;
  const message = JSON.stringify({ orderId, status, ...data });
  console.log(`[Worker DEBUG] Publishing to ${channel}`);
  // Fire and forget (don't await strictly if performance is key, but safer to await)
  await redisPublisher.publish(channel, message);
}

// 3. Define the Worker
export const orderWorker = new Worker(
  'order-queue', 
  async (job: Job) => {
    const { orderId, token, amount } = job.data;
    console.log(`[Worker] Processing Job ${job.id} for Order: ${orderId}`);

    // Variable to hold route data in case we need it for error logging later
    let bestRoute: any = null;

    try {
      // --- STEP 1: ROUTING ---
      // Update DB
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'ROUTING' },
      });
      // Notify WS
      await publishUpdate(orderId, 'ROUTING');
      await sleep(500);
      
      // --- STEP 2: FIND BEST PRICE ---
      // This is the "heavy" calculation mock
      bestRoute = await router.getBestQuote(token, amount);

      // --- STEP 3: BUILDING (New Step) ---
      // This simulates constructing the transaction object
      await publishUpdate(orderId, 'BUILDING', { 
        dex: bestRoute.dex, 
        price: bestRoute.price 
      });
      await sleep(500); // Simulate transaction construction time

      // --- STEP 3: SUBMITTING ---
      // Update DB with the chosen DEX and Price
      await prisma.order.update({
        where: { id: orderId },
        data: { 
          status: 'SUBMITTED',
          dex: bestRoute.dex,
          price: bestRoute.price
        },
      });
      // Notify WS
      await publishUpdate(orderId, 'SUBMITTED', { 
        dex: bestRoute.dex, 
        price: bestRoute.price 
      });


      // --- STEP 4: EXECUTION ---
      // Simulate the blockchain transaction delay
      const execution = await router.executeTrade(bestRoute.dex, orderId);


      // --- STEP 5: CONFIRMATION ---
      // Final DB Update
      await prisma.order.update({
        where: { id: orderId },
        data: { 
          status: 'CONFIRMED',
          txHash: execution.txHash
        },
      });
      // Notify WS
      await publishUpdate(orderId, 'CONFIRMED', { 
        dex: bestRoute.dex, 
        price: bestRoute.price,
        txHash: execution.txHash
      });

      console.log(`[Worker] Order ${orderId} CONFIRMED via ${bestRoute.dex}`);
      return { status: 'success', txHash: execution.txHash };

    } catch (error) {
      console.error(`[Worker] Failed Order ${orderId}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update DB to FAILED
      await prisma.order.update({
        where: { id: orderId },
        data: { 
          status: 'FAILED',
          error: errorMessage
        },
      });

      // Notify WS of Failure
      // Safe check: bestRoute might be null if it failed before routing finished
      await publishUpdate(orderId, 'FAILED', { 
        error: errorMessage,
        dex: bestRoute?.dex // Optional: show which DEX failed if we got that far
      });
      
      throw error; // Trigger BullMQ retry logic
    }
  }, 
  {
    connection: redisConnection,
    concurrency: 10 // Process 10 orders simultaneously
  }
);