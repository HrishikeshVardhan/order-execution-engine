// src/test-router.ts
import { DexRouter } from './lib/DexRouter';

async function test() {
  const router = new DexRouter();

  console.log("--- Starting Test Trade ---");
  
  // 1. Get Best Quote
  const quote = await router.getBestQuote("SOL", 10);
  console.log(`✅ Best Route Selected: ${quote.dex} @ $${quote.price}`);

  // 2. Execute
  const result = await router.executeTrade(quote.dex, "test-order-1");
  console.log(`🎉 Transaction Confirmed: ${result.txHash}`);
}

test();