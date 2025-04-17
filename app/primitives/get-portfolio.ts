import { z } from 'zod';
import { Address, isAddress } from 'viem';
import { getWalletAgentContext } from '@/lib/portfolio';
import { BitteTool } from '@/lib/types';
import { getErrorMsg } from '@/lib/error';

const BINANCE_API_BASE_URL = 'https://data-api.binance.vision/api/v3';
const STABLECOINS = ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD'];

const PriceChangeSchema = z.object({
  day: z.number(),
  week: z.number(),
  month: z.number(),
});

const PriceDataSchema = z.object({
  day: z.array(z.tuple([z.number(), z.number()])),
  week: z.array(z.tuple([z.number(), z.number()])),
  month: z.array(z.tuple([z.number(), z.number()])),
});

const SignificantAssetSchema = z.object({
  symbol: z.string(),
  usdValue: z.number(),
  chains: z.array(z.string()),
  priceChanges: PriceChangeSchema.optional(),
  priceData: PriceDataSchema.optional(),
});

const PortfolioResponseSchema = z.object({
  portfolioValue: z.number(),
  chainsWithGas: z.array(z.string()),
  significantAssets: z.array(SignificantAssetSchema),
  actionableSummary: z.string(),
});

type PortfolioResponse = z.infer<typeof PortfolioResponseSchema>;
type PriceChange = z.infer<typeof PriceChangeSchema>;
type PriceData = z.infer<typeof PriceDataSchema>;

type TimeInterval = '1h' | '4h' | '1d';
type TimeframeKey = 'day' | 'week' | 'month';

interface TimeframeConfig {
  interval: TimeInterval;
  limit: number;
  key: TimeframeKey;
}

// Binance kline data structure
interface KlineData {
  0: number; // Open time
  1: string; // Open price
  2: string; // High price
  3: string; // Low price
  4: string; // Close price
  5: string; // Volume
  6: number; // Close time
  7: string; // Quote asset volume
  8: number; // Number of trades
  9: string; // Taker buy base asset volume
  10: string; // Taker buy quote asset volume
  11: string; // Ignore
}

interface PricePoint {
  time: number;
  close: number;
}

const TIMEFRAME_CONFIGS: TimeframeConfig[] = [
  { interval: '1h', limit: 24, key: 'day' },
  { interval: '4h', limit: 42, key: 'week' },
  { interval: '1d', limit: 30, key: 'month' },
];

// Default empty price data and changes
const DEFAULT_PRICE_DATA: Record<TimeframeKey, [number, number][]> = {
  day: [],
  week: [],
  month: [],
};

const DEFAULT_PRICE_CHANGES: Record<TimeframeKey, number> = {
  day: 0,
  week: 0,
  month: 0,
};

function isStablecoin(symbol: string): boolean {
  return STABLECOINS.includes(symbol.toUpperCase());
}

async function fetchKlineData(
  symbol: string,
  interval: string,
  limit: number,
): Promise<KlineData[]> {
  const url = new URL(`${BINANCE_API_BASE_URL}/klines`);
  url.searchParams.append('symbol', `${symbol.toUpperCase()}USDT`);
  url.searchParams.append('interval', interval);
  url.searchParams.append('limit', limit.toString());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.status}`);
  }

  return response.json();
}

async function fetchPriceData(symbol: string): Promise<{
  priceChanges: PriceChange | null;
  priceData: PriceData | null;
}> {
  try {
    const normalizedSymbol = symbol.toUpperCase();

    if (isStablecoin(normalizedSymbol)) {
      return {
        priceChanges: { ...DEFAULT_PRICE_CHANGES },
        priceData: { ...DEFAULT_PRICE_DATA },
      };
    }

    const requests = TIMEFRAME_CONFIGS.map((config) =>
      fetchKlineData(normalizedSymbol, config.interval, config.limit),
    );

    const responses = await Promise.all(requests);

    const priceData = { ...DEFAULT_PRICE_DATA };
    const priceChanges = { ...DEFAULT_PRICE_CHANGES };

    TIMEFRAME_CONFIGS.forEach((config, index) => {
      const data = responses[index];
      const key = config.key;

      if (data && data.length > 0) {
        const prices = data.map((k: KlineData) => ({
          time: k[0],
          close: parseFloat(k[4]),
        }));

        if (prices.length >= 2) {
          const firstPrice = prices[0].close;
          const lastPrice = prices[prices.length - 1].close;
          priceChanges[key] = ((lastPrice - firstPrice) / firstPrice) * 100;
        }

        priceData[key] = prices.map((p: PricePoint) => [p.time, p.close]);
      }
    });

    return { priceChanges, priceData };
  } catch (error) {
    console.error('Error fetching price data:', error);
    return { priceChanges: null, priceData: null };
  }
}

/**
 * Enhances portfolio data with price information for significant assets
 */
async function enhancePortfolioWithPriceData(
  portfolioData: PortfolioResponse,
): Promise<PortfolioResponse> {
  const enhancementPromises = portfolioData.significantAssets.map(
    async (asset) => {
      try {
        if (!isStablecoin(asset.symbol)) {
          const { priceChanges, priceData } = await fetchPriceData(
            asset.symbol,
          );
          if (priceChanges) asset.priceChanges = priceChanges;
          if (priceData) asset.priceData = priceData;
        } else {
          // Set default values for stablecoins
          asset.priceChanges = { ...DEFAULT_PRICE_CHANGES };
          asset.priceData = { ...DEFAULT_PRICE_DATA };
        }
      } catch (error) {
        console.error(`Error enhancing data for ${asset.symbol}:`, error);
      }
    },
  );

  await Promise.all(enhancementPromises);
  return portfolioData;
}

export const getPortfolio: BitteTool<{ address: string }, PortfolioResponse> = {
  toolSpec: {
    function: {
      name: 'get-portfolio',
      description:
        'Get portfolio information for an Ethereum address, including balances, significant assets across chains, and price changes over time (24h, 7d, 30d)',
      parameters: {
        type: 'object',
        required: ['address'],
        properties: {
          address: {
            type: 'string',
            description:
              'The Ethereum address to fetch portfolio information for',
          },
        },
      },
    },
    type: 'function',
  },
  execute: async ({ address }) => {
    try {
      if (!isAddress(address)) {
        return { error: 'Invalid Ethereum address format' };
      }

      const portfolioData = (await getWalletAgentContext(
        address as Address,
      )) as PortfolioResponse;

      const enhancedPortfolioData =
        await enhancePortfolioWithPriceData(portfolioData);
      const validatedData = PortfolioResponseSchema.parse(
        enhancedPortfolioData,
      );

      return {
        data: validatedData,
        prompt:
          "Offer to create a chart for the user's top holding for them to analyze",
      };
    } catch (error) {
      return { error: getErrorMsg(error) };
    }
  },
};
