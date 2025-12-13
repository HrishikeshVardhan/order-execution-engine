// src/test-queue.ts
import { orderQueue } from './lib/queue';
import { PrismaClient } from '@prisma/client';
import './lib/worker'; // Import the worker so it starts listening!

const prisma = new PrismaClient();

async function test() {
  console.log("--- Starting Queue Test ---");

  // 1. Create a dummy order in Postgres
  const order = await prisma.order.create({
    data: {
      type: "MARKET",
      side: "SELL",
      token: "SOL",
      amount: 5.0,
      status: "PENDING"
    }
  });

  console.log(`1. Created DB Order: ${order.id}`);

  // 2. Add to Queue
  await orderQueue.add('trade', {
    orderId: order.id,
    token: "SOL",
    amount: 5.0,
    side: "SELL"
  });

  console.log(`2. Added to Queue. Waiting for worker...`);

  // Keep the script running to see the logs
  await new Promise(resolve => setTimeout(resolve, 10000));
}

test();