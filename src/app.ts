import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { orderQueue } from './lib/queue';
import { websocketRoutes } from './lib/websocket';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const server = Fastify({ logger: true });

// Register Plugins
server.register(cors);
server.register(websocket);
server.register(websocketRoutes);

// HTTP Endpoint: Submit Order
server.post('/api/orders', async (request, reply) => {
  const { token, amount, side } = request.body as any;

  // 1. Create Pending Order in DB
  const order = await prisma.order.create({
    data: {
      type: 'MARKET',
      side,
      token,
      amount,
      status: 'PENDING',
    },
  });

  // 2. Add to Queue
  await orderQueue.add('process-order', {
    orderId: order.id,
    token,
    amount,
    side,
  });

  // 3. Return ID so frontend can connect to WebSocket
  return reply.send({ 
    success: true, 
    orderId: order.id, 
    message: 'Order queued',
    wsUrl: `ws://localhost:3000/ws/orders/${order.id}`
  });
});

// Start Server
const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    console.log('🚀 Server running on http://localhost:3000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();