import { createExecutor } from '@/lib/plugins';
import { BitteTool, PluginToolSpec } from '@/lib/types';

export const refFinanceToolSpecs: Record<string, PluginToolSpec> = {
  getSwapTransactions: {
    execution: {
      path: '/api/swap/{tokenIn}/{tokenOut}/{quantity}',
      baseUrl: 'ref-finance-agent.vercel.app',
      httpMethod: 'get',
    },
    agentId: 'ref-finance-agent.vercel.app',
    function: {
      name: 'get-swap-transactions',
      description:
        'Get a transaction payload for swapping between two tokens using the best trading route on Ref.Finance. Token identifiers can be the name, symbol, or contractId and will be fuzzy matched automatically.  Use the `generate-transaction` tool to show the transaction to the user.  Do not modify token identifiers, they will be fuzzy matched automatically.',
      parameters: {
        type: 'object',
        properties: {
          tokenIn: {
            description: 'The identifier for the input token.',
            type: 'string',
          },
          tokenOut: {
            description: 'The identifier for the output token.',
            type: 'string',
          },
          quantity: {
            description: 'The amount of tokens to swap (input amount).',
            type: 'string',
          },
        },
        required: ['tokenIn', 'tokenOut', 'quantity'],
      },
    },
    id: 'ref-finance-agent.vercel.app-get-swap-transactions',
    type: 'function',
    verified: true,
  },
  getTokenMetadata: {
    execution: {
      path: '/api/{token}',
      baseUrl: 'ref-finance-agent.vercel.app',
      httpMethod: 'get',
    },
    agentId: 'ref-finance-agent.vercel.app',
    function: {
      name: 'get-token-metadata',
      description:
        'Get token metadata from Ref Finance. Token identifier can be the name, symbol, or contractId and will be fuzzy matched automatically.',
      parameters: {
        type: 'object',
        properties: {
          token: {
            description: 'The identifier for the token to get metadata for.',
            type: 'string',
          },
        },
        required: ['token'],
      },
    },
    id: 'ref-finance-agent.vercel.app-get-token-metadata',
    type: 'function',
    verified: true,
  },
};
export const getSwapTransactions: BitteTool = {
  toolSpec: refFinanceToolSpecs.getSwapTransactions,
  execute: async (args, metadata) =>
    await createExecutor(refFinanceToolSpecs.getSwapTransactions)(
      args,
      metadata,
    ),
};

export const getTokenMetadata: BitteTool = {
  toolSpec: refFinanceToolSpecs.getTokenMetadata,
  execute: async (args, metadata) =>
    await createExecutor(refFinanceToolSpecs.getTokenMetadata)(args, metadata),
};
