// test-concurrency.ts
import WebSocket from 'ws';
import axios from 'axios';

// Configuration
const API_URL = 'http://localhost:3000/api/orders'; // Updated URL
const TOTAL_ORDERS = 5; // How many orders to fire at once

async function submitAndMonitor(index: number) {
  try {
    // 1. Submit Order (Using the correct payload now)
    const { data } = await axios.post(API_URL, {
      token: 'SOL',
      amount: 10 + index, // Varied amount to easily spot different orders
      side: 'buy'         // Added 'side' to match your schema
    });
    
    const orderId = data.orderId;
    console.log(`[Order ${index + 1}] 🚀 Submitted: ${orderId}`);

    // 2. Open WebSocket
    const ws = new WebSocket(`ws://localhost:3000/ws/orders/${orderId}`);

    ws.on('message', (msg) => {
      const update = JSON.parse(msg.toString());
      
      // We only log the final states to keep the terminal clean
      if(update.status === 'CONFIRMED') {
        console.log(`[Order ${index + 1}] ✅ CONFIRMED: ${update.txHash ? update.txHash.substring(0, 10) + '...' : 'No Hash'}`);
        ws.close();
      } else if (update.status === 'FAILED') {
        console.log(`[Order ${index + 1}] ❌ FAILED: ${update.error}`);
        ws.close();
      }
    });

    ws.on('error', (err) => {
      console.error(`[Order ${index + 1}] WS Error:`, err.message);
    });

  } catch (err: any) {
    console.error(`[Order ${index + 1}] HTTP Error:`, err.response ? err.response.data : err.message);
  }
}

async function run() {
  console.log(`🔥 Firing ${TOTAL_ORDERS} orders simultaneously...`);
  
  const promises = [];
  for (let i = 0; i < TOTAL_ORDERS; i++) {
    // Fire them all without awaiting individually!
    promises.push(submitAndMonitor(i));
  }
  
  await Promise.all(promises);
  console.log('--- All requests sent ---');
}

run();