// src/test-router-routing.spec.ts
import { DexRouter } from './lib/DexRouter';

describe('DexRouter - Additional Routing Tests', () => {
  let router: DexRouter;

  beforeEach(() => {
    router = new DexRouter();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls both quote providers with correct args', async () => {
    const spyR = jest.spyOn(router, 'getRaydiumQuote').mockResolvedValue({
      dex: 'Raydium',
      price: 150,
      fee: 0.003,
      amountOut: 1500,
    });

    const spyM = jest.spyOn(router, 'getMeteoraQuote').mockResolvedValue({
      dex: 'Meteora',
      price: 140,
      fee: 0.002,
      amountOut: 1400,
    });

    const amount = 5;
    await router.getBestQuote('SOL', amount);

    expect(spyR).toHaveBeenCalledWith('SOL', amount);
    expect(spyM).toHaveBeenCalledWith('SOL', amount);
  });

  it('picks Raydium when amountOut edge-case slightly higher', async () => {
    jest.spyOn(router, 'getRaydiumQuote').mockResolvedValue({
      dex: 'Raydium',
      price: 150.01,
      fee: 0.003,
      amountOut: 1500.5,
    });

    jest.spyOn(router, 'getMeteoraQuote').mockResolvedValue({
      dex: 'Meteora',
      price: 150.0,
      fee: 0.002,
      amountOut: 1500.0,
    });

    const best = await router.getBestQuote('SOL', 10);
    expect(best.dex).toBe('Raydium');
  });
});
