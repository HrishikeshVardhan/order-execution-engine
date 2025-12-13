// test-client.ts
import WebSocket from 'ws';
import axios from 'axios';

async function testOrderFlow() {
  try {
    console.log('1. Submitting Order...');
    
    // 1. Submit POST Request
    const response = await axios.post('http://localhost:3000/api/orders', {
      token: 'SOL',
      amount: 5, 
      side: 'buy'
    });

    const { orderId } = response.data;
    console.log(`✅ Order Created: ${orderId}`);

    // 2. Connect via WebSocket immediately
    console.log(`2. Connecting to WebSocket for ${orderId}...`);
    const ws = new WebSocket(`ws://localhost:3000/ws/orders/${orderId}`);

    ws.on('open', () => {
      console.log('✅ WebSocket Connected!');
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      console.log('📩 Received Update:', msg);

      // Close connection when finished
      if (msg.status === 'CONFIRMED' || msg.status === 'FAILED') {
        console.log('✅ Order Complete. Closing connection.');
        ws.close();
        process.exit(0);
      }
    });

    ws.on('error', (err) => {
      console.error('❌ WebSocket Error:', err);
    });

  } catch (error) {
    console.error('❌ Error submitting order:', error);
  }
}

testOrderFlow();