import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocket } from 'ws';
import Redis from 'ioredis';

// Robust Redis connection
const redisSub = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

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

      const messageHandler = (pattern: string, channel: string, message: string) => {
        console.log(`[Redis DEBUG] Heard on ${channel}: ${message}`);
        if (channel === `order-updates:${orderId}`) {
          // Use our safe 'socket' variable
          if (socket.readyState === WebSocket.OPEN) {
             socket.send(message);
          }
        }
      };

      // Subscribe to Redis events
      redisSub.on('pmessage', messageHandler);

      // Handle Disconnect
      // Use the safe 'socket' variable here too
      socket.on('close', () => {
        console.log(`[WS] Client disconnected: ${orderId}`);
        redisSub.removeListener('pmessage', messageHandler);
      });
    }
  );
}