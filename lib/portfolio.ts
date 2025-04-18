import { UserDashboardResponse, ZerionAPI } from 'zerion-sdk';
import { Address, isAddress, zeroAddress } from 'viem';
import { kv } from '@vercel/kv';
import { chainIdToName, supportedMainnetChains } from '@/lib/constants';
import { WalletAgentContext, WalletBalanceCache } from '@/lib/types';

const CACHE_TTL_SECONDS = 60 * 10;
const CACHE_PREFIX = 'wallet-balance:';
const GAS_ASSET_THRESHOLD = 0.1;
const MAX_SIGNIFICANT_ASSETS = 20;

export const getWalletAgentContext = async (
  address: Address,
): Promise<WalletAgentContext> => {
  if (!isAddress(address)) {
    throw new Error('Invalid Ethereum address format');
  }

  const cacheKey = `${CACHE_PREFIX}${address.toLowerCase()}`;

  try {
    const cachedData = await kv.get<WalletBalanceCache>(cacheKey);

    if (
      cachedData &&
      Date.now() - cachedData.timestamp < CACHE_TTL_SECONDS * 1000
    ) {
      console.log(`[CACHE HIT] Using cached data for wallet ${address}`);
      return cachedData.data;
    }

    console.log(`[CACHE MISS] Fetching fresh data for wallet ${address}`);
    const zerionData = await getEvmBalances(address);
    const tokens = zerionData.tokens;

    const nativeTokens = tokens.filter(
      (token) =>
        !token.meta.contractAddress ||
        token.meta.contractAddress === zeroAddress,
    );

    const chainsWithGas = nativeTokens
      .filter((token) => token.balances.usdBalance >= GAS_ASSET_THRESHOLD)
      .map((token) => {
        const chainId = token.chain.chainId || 0;
        return {
          chain: chainIdToName[chainId] || `Chain ${chainId}`,
          symbol: token.meta.symbol,
        };
      });

    const chainsWithGasNames = chainsWithGas.map((item) => item.chain);

    const significantAssets = tokens
      .sort((a, b) => b.balances.usdBalance - a.balances.usdBalance)
      .slice(0, MAX_SIGNIFICANT_ASSETS)
      .map((token) => {
        const chainId = token.chain.chainId || 0;
        const chainName = chainIdToName[chainId] || `Chain ${chainId}`;
        return {
          symbol: token.meta.symbol,
          usdValue: token.balances.usdBalance,
          chains: [chainName],
          icon: zerionData.chainsIcons[chainId] || null,
        };
      });

    const actionableSummary = generateActionableSummary(
      zerionData.totalUsdBalance,
      chainsWithGas,
      significantAssets,
    );

    const result: WalletAgentContext = {
      portfolioValue: zerionData.totalUsdBalance,
      chainsWithGas: chainsWithGasNames,
      significantAssets,
      actionableSummary,
    };

    await kv.set(
      cacheKey,
      {
        data: result,
        timestamp: Date.now(),
      },
      {
        ex: CACHE_TTL_SECONDS,
      },
    );

    return result;
  } catch (error) {
    console.error('Failed to get wallet context:', error);
    throw new Error(
      `Failed to process wallet data: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

export const getEvmBalances = async (
  address: Address,
): Promise<UserDashboardResponse> => {
  if (!isAddress(address)) {
    throw new Error('Invalid Ethereum address format');
  }

  try {
    const zerion = getZerion();
    const balances = await zerion.ui.getUserBalances(address, {
      useStatic: true,
      options: {
        supportedChains: supportedMainnetChains,
        showZeroNative: false,
        hideDust: 0.0001,
      },
    });
    return balances;
  } catch (error) {
    console.error('Failed to fetch EVM balances:', error);
    throw new Error(
      `Failed to fetch wallet balances: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

export const getZerion = (): ZerionAPI => {
  const ZERION_API_KEY = process.env.ZERION_API_KEY;
  if (!ZERION_API_KEY) {
    throw new Error('Missing ZERION_API_KEY in environment variables');
  }
  return new ZerionAPI(ZERION_API_KEY, false);
};

function generateActionableSummary(
  totalValue: number,
  chainsWithGas: { chain: string; symbol: string }[],
  significantAssets: {
    symbol: string;
    usdValue: number;
    chains: string[];
    icon: string | null;
  }[],
): string {
  let summary = `Wallet holds ~$${Math.round(totalValue)} total value. `;
  console.log(significantAssets);
  if (chainsWithGas.length === 0) {
    summary += `No gas available on any chain. `;
  } else {
    summary += `Gas available on: ${chainsWithGas.map((c) => `${c.chain} (${c.symbol})`).join(', ')}. `;
  }

  if (significantAssets.length > 0) {
    const topAsset = significantAssets[0];

    summary += `Largest holding: $${Math.round(topAsset.usdValue)} in ${topAsset.symbol} on ${topAsset.chains[0]}. `;

    if (significantAssets.length > 1) {
      summary += `Also holds: ${significantAssets
        .slice(1)
        .map((asset) => `$${asset.usdValue.toFixed(3)} in ${asset.symbol}`)
        .join(', ')}.`;
    }
  } else {
    summary += `No significant token holdings found.`;
  }

  return summary;
}
