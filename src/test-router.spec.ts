// src/test-router.spec.ts
import { DexRouter } from './lib/DexRouter';

describe('DexRouter Logic', () => {
    let router: DexRouter;

    beforeEach(() => {
        router = new DexRouter();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
    it('should pick Raydium when Raydium offers a better outcome', async () => {
        // 1. Spy on the methods so we can fake their return values
        // We force Raydium to return $150 and Meteora to return $140
        jest.spyOn(router, 'getRaydiumQuote').mockResolvedValue({
            dex: 'Raydium',
            price: 150,
            fee: 0.003,
            amountOut: 1500 // Higher amountOut is better for SELL
        });

        jest.spyOn(router, 'getMeteoraQuote').mockResolvedValue({
            dex: 'Meteora',
            price: 140,
            fee: 0.002,
            amountOut: 1400 // Lower amountOut
        });

        // 2. Run the logic
        const bestQuote = await router.getBestQuote('SOL', 10);

        // 3. Verify
        console.log(`Test 1 Result: Selected ${bestQuote.dex} with amount ${bestQuote.amountOut}`);
        expect(bestQuote.dex).toBe('Raydium');
        expect(bestQuote.amountOut).toBe(1500);
    });

    it('should pick Meteora when Meteora offers a better outcome', async () => {
        // 1. Force Meteora to be better ($160 vs $150)
        jest.spyOn(router, 'getRaydiumQuote').mockResolvedValue({
            dex: 'Raydium',
            price: 150,
            fee: 0.003,
            amountOut: 1500
        });

        jest.spyOn(router, 'getMeteoraQuote').mockResolvedValue({
            dex: 'Meteora',
            price: 160,
            fee: 0.002,
            amountOut: 1600 // Higher is better
        });

        // 2. Run the logic
        const bestQuote = await router.getBestQuote('SOL', 10,);

        // 3. Verify
        console.log(`Test 2 Result: Selected ${bestQuote.dex} with amount ${bestQuote.amountOut}`);
        expect(bestQuote.dex).toBe('Meteora');
        expect(bestQuote.amountOut).toBe(1600);
    });

    it('should pick Meteora when both DEXes return equal amountOut (tie)', async () => {
        jest.spyOn(router, 'getRaydiumQuote').mockResolvedValue({
            dex: 'Raydium',
            price: 150,
            fee: 0.003,
            amountOut: 1500
        });

        jest.spyOn(router, 'getMeteoraQuote').mockResolvedValue({
            dex: 'Meteora',
            price: 150,
            fee: 0.002,
            amountOut: 1500
        });

        const tieQuote = await router.getBestQuote('SOL', 10);
        console.log(`Tie Test Result: Selected ${tieQuote.dex} with amount ${tieQuote.amountOut}`);
        expect(tieQuote.dex).toBe('Meteora');
    });

    it('should reject when Raydium request throws an error', async () => {
        jest.spyOn(router, 'getRaydiumQuote').mockRejectedValue(new Error('Raydium down'));

        jest.spyOn(router, 'getMeteoraQuote').mockResolvedValue({
            dex: 'Meteora',
            price: 160,
            fee: 0.002,
            amountOut: 1600
        });

        await expect(router.getBestQuote('SOL', 10)).rejects.toThrow('Raydium down');
    });

    it('should still pick the higher amountOut even if that DEX has higher fee', async () => {
        // Raydium has higher amountOut but also higher fee
        jest.spyOn(router, 'getRaydiumQuote').mockResolvedValue({
            dex: 'Raydium',
            price: 155,
            fee: 0.01, // exaggerated fee
            amountOut: 1550
        });

        jest.spyOn(router, 'getMeteoraQuote').mockResolvedValue({
            dex: 'Meteora',
            price: 150,
            fee: 0.001,
            amountOut: 1500
        });

        const bestQuoteFee = await router.getBestQuote('SOL', 10);
        console.log(`Fee Influence Test: Selected ${bestQuoteFee.dex} with amount ${bestQuoteFee.amountOut} and fee ${bestQuoteFee.fee}`);
        expect(bestQuoteFee.dex).toBe('Raydium');
    });

    it('should throw when one DEX returns a null/falsy quote', async () => {
        jest.spyOn(router, 'getRaydiumQuote').mockResolvedValue({
            dex: 'Raydium',
            price: 150,
            fee: 0.003,
            amountOut: 1500
        });

        // Meteora returns null (simulating malformed response)
        // This should cause getBestQuote to throw when accessing properties
        // of the falsy value.
        // @ts-ignore
        jest.spyOn(router, 'getMeteoraQuote').mockResolvedValue(null);

        await expect(router.getBestQuote('SOL', 10)).rejects.toThrow();
    });
});