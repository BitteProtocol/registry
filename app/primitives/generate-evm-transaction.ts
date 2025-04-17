import { Transaction } from '@near-wallet-selector/core';
import {
  EncodedTxData,
  EthTransactionParams,
  SafeEncodedSignRequest,
  SignRequestData,
  Network as EvmNetwork,
  NearSafe,
} from 'near-safe';
import { z } from 'zod';
import { getErrorMsg } from '@/lib/error';
import { BitteTool } from '@/lib/types';
import {
  IS_TESTNET,
  NEAR_NETWORK_ID,
  NEAR_RPC_URL,
  PIMLICO_KEY,
} from '@/app/config';

const SAFE_SPONSORED_CHAIN_IDS: { [key: number]: string | undefined } = {
  137: 'sp_safe_gas_station_polygon', // Polygon (Safe Gas Station Grant)
};

// TODO(bh2smith): Replace with dynamic loading
//  https://github.com/BitteProtocol/near-safe/pull/82
const BITTE_SPONSORED_CHAINS = [
  10, // Optimism
  56, // Binance Smart Chain (BSC)
  100, // xDai (Gnosis Chain)
  8453, // Base (Coinbase L2)
  34443, // Mode
  42161, // Arbitrum One
  43114, // Avalanche
];

export const SAFE_SALT_NONCE = '130811896738364156958237239906781888512';

const MAINNET_ROOT_KEY =
  'secp256k1:3tFRbMqmoa6AAALMrEFAYCEoHcqKxeW38YptwowBVBtXK1vo36HDbUWuR6EZmoK4JcH6HDkNMGGqP1ouV7VZUWya';

const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
  .transform((val): `0x${string}` => val as `0x${string}`);

const HexDataSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]*$/)
  .transform((val): `0x${string}` => val as `0x${string}`);

const MetaTransactionSchema = z.object({
  to: AddressSchema,
  data: HexDataSchema,
  value: HexDataSchema,
  from: AddressSchema,
});
const SignRequestParamsSchema = z.union([
  z.array(MetaTransactionSchema),
  HexDataSchema,
]);

const SignRequestSchema = z.object({
  method: z.literal('eth_sendTransaction'),
  chainId: z.number().int(),
  params: SignRequestParamsSchema,
});

export const generateEvmTx: BitteTool<
  { accountId?: string; evmAddress: string } & SignRequestData,
  {
    transactions?: Transaction[];
    evmSignRequest: SafeEncodedSignRequest | SignRequestData;
  }
> = {
  toolSpec: {
    function: {
      name: 'generate-evm-tx',
      description:
        'Generate or format an EVM transaction payload, will prompt the UI for the review transcation UI when given an object that follows the specified params',
      parameters: {
        type: 'object',
        required: ['method', 'chainId', 'params', 'evmAddress'],
        properties: {
          accountId: {
            type: 'string',
            description:
              'The NEAR account ID of the user (optional for native EVM transactions)',
          },
          evmAddress: {
            type: 'string',
            description:
              'The EVM address corresponding to the users accounts, also used to populate the from field',
          },
          method: {
            type: 'string',
            enum: ['eth_sendTransaction'],
          },
          chainId: {
            type: 'integer',
          },
          params: {
            type: 'array',
            items: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    to: {
                      type: 'string',
                      pattern: '^0x[a-fA-F0-9]{40}$',
                      description:
                        'The destination address for the transaction',
                    },
                    data: {
                      type: 'string',
                      pattern: '^0x[a-fA-F0-9]*$',
                      description: 'The encoded data for the transaction',
                    },
                    value: {
                      type: 'string',
                      pattern: '^0x[a-fA-F0-9]*$',
                      description: 'The value to be sent with the transaction',
                    },
                    from: {
                      type: 'string',
                      pattern: '^0x[a-fA-F0-9]{40}$',
                      description:
                        "The sender's address. Use the provided 'from' address if specified, otherwise default to using the evmAddress parameter. The evmAddress parameter will be used in most cases.",
                    },
                  },
                  required: ['to', 'data', 'value', 'from'],
                },
                {
                  type: 'string',
                  pattern: '^0x[a-fA-F0-9]*$',
                  description: 'Encoded transaction data.',
                },
              ],
            },
          },
        },
      },
    },
    type: 'function',
  },
  execute: async ({ accountId, evmAddress, method, chainId, params }) => {
    try {
      const validatedSignRequest = SignRequestSchema.parse({
        method,
        chainId,
        params,
      });

      if (!accountId) {
        return {
          data: {
            evmSignRequest: validatedSignRequest,
          },
        };
      }

      const adapter = await initializeAdapter(accountId);
      const adapterAddress = adapter?.address;
      if (evmAddress != adapterAddress) {
        return {
          data: {
            evmSignRequest: validatedSignRequest,
          },
        };
      }

      return {
        data: await getMpcTransactionData(validatedSignRequest, accountId),
      };
    } catch (error) {
      return {
        error: getErrorMsg(error),
      };
    }
  },
};

export const getMpcTransactionData = async (
  evmData: Omit<SignRequestData, 'params'> & {
    params: Extract<
      SignRequestData['params'],
      `0x${string}` | EthTransactionParams[]
    >;
  },
  accountId: string | undefined,
): Promise<{
  transactions: Transaction[];
  evmSignRequest: SafeEncodedSignRequest;
}> => {
  if (!evmData || !accountId) {
    throw new Error('EVM transaction or accountId invalid');
  }

  const encodedTx = await encodeEvmTx(accountId, evmData);

  return {
    transactions: [encodedTx.nearPayload],
    evmSignRequest: encodedTx.evmData,
  };
};

export async function initializeAdapter(accountId: string): Promise<NearSafe> {
  return NearSafe.create({
    mpc: {
      accountId: accountId,
      mpcContractId: IS_TESTNET ? 'v1.signer-prod.testnet' : 'v1.signer',
      network: {
        networkId: NEAR_NETWORK_ID,
        nodeUrl: NEAR_RPC_URL,
      },
      rootPublicKey: IS_TESTNET ? undefined : MAINNET_ROOT_KEY,
    },
    pimlicoKey: PIMLICO_KEY,
    safeSaltNonce: SAFE_SALT_NONCE,
  });
}

export async function encodeEvmTx(
  accountId: string,
  signRequest: SignRequestData,
): Promise<EncodedTxData> {
  const adapter = await initializeAdapter(accountId);
  try {
    return adapter.encodeSignRequest(
      signRequest,
      getSponsorshipPolicy(signRequest.chainId),
    );
  } catch (error: unknown) {
    const message = `failed encodeEvmTx: ${getErrorMsg(error)}`;
    console.error(message);
    throw new Error(message);
  }
}

export function getSponsorshipPolicy(chainId: number): string | undefined {
  if (
    EvmNetwork.fromChainId(chainId).testnet ||
    BITTE_SPONSORED_CHAINS.includes(chainId)
  ) {
    return 'sp_round_ego'; // Testnet & Bitte Sponsored Networks
  }

  // Access the sponsorship policy through Grant Program
  return SAFE_SPONSORED_CHAIN_IDS[chainId];
}
