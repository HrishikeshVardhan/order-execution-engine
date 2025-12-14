import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocket } from 'ws';
import Redis from 'ioredis';

// Robust Redis connection
if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL is not defined');
}

const redisSub = new Redis(process.env.REDIS_URL);

interface OrderParams {
  orderId: string;
}

export async function websocketRoutes(fastify: FastifyInstance) {
  
  // Ensure Redis is ready
  await redisSub.psubscribe('order-updates:*');
  console.log('[Redis] Subscribed to order updates');

  fastify.get(
    '/ws/orders/:orderId', 
    { websocket: true }, 
    (connection: any, req: FastifyRequest<{ Params: OrderParams }>) => {
      
      const { orderId } = req.params;
      
      // --- DEBUGGING LOG ---
      console.log(`[WS] Connection received for ${orderId}`);
      // Check what 'connection' actually is
      const socket = connection.socket || connection; 
      
      if (!socket) {
        console.error('[WS] Error: Socket is undefined!');
        return;
      }
      // ---------------------

      // queue messages that arrive before socket is OPEN
      const pending: string[] = [];

      const flushPending = () => {
        while (pending.length && socket.readyState === WebSocket.OPEN) {
          const msg = pending.shift()!;
          socket.send(msg);
        }
      };

      const messageHandler = (pattern: string, channel: string, message: string) => {
        console.log(`[Redis DEBUG] Heard on ${channel}: ${message}`);
        if (channel === `order-updates:${orderId}`) {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(message);
          } else {
            pending.push(message);
          }
        }
      };

      // Subscribe to Redis events
      redisSub.on('pmessage', messageHandler);

      // If socket becomes open later, flush queued messages
      if (socket.on) {
        socket.on('open', () => {
          flushPending();
        });
      }

      // Handle Disconnect
      // Use the safe 'socket' variable here too
      socket.on('close', () => {
        console.log(`[WS] Client disconnected: ${orderId}`);
        redisSub.removeListener('pmessage', messageHandler);
      });
    }
  );

  // Also allow POST to be used for upgrade (some clients may issue POST)
  // fastify.post(
  //   '/ws/orders/:orderId',
  //   { websocket: true },
  //   // reuse the same handler shape as the GET route
  //   (connection: any, req: FastifyRequest<{ Params: OrderParams }>) => {
  //     // delegate to get handler logic by copying minimal behavior
  //     const { orderId } = req.params;
  //     const socket = connection.socket || connection;
  //     if (!socket) return;

  //     const pending: string[] = [];
  //     const flushPending = () => {
  //       while (pending.length && socket.readyState === WebSocket.OPEN) {
  //         const msg = pending.shift()!;
  //         socket.send(msg);
  //       }
  //     };

  //     const messageHandler = (pattern: string, channel: string, message: string) => {
  //       if (channel === `order-updates:${orderId}`) {
  //         if (socket.readyState === WebSocket.OPEN) socket.send(message);
  //         else pending.push(message);
  //       }
  //     };

  //     redisSub.on('pmessage', messageHandler);
  //     if (socket.on) socket.on('open', flushPending);
  //     socket.on('close', () => {
  //       redisSub.removeListener('pmessage', messageHandler);
  //     });
  //   }
  // );
}