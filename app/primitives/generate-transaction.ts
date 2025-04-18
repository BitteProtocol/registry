import { nearPrice } from '@mintbase-js/data';
import { ftBalance, getBalance } from '@mintbase-js/rpc';
import { Transaction } from '@near-wallet-selector/core';
import { formatUnits } from 'viem';
import { z } from 'zod';

import { getErrorMsg } from '@/lib/error';
import { AccountTransaction, BitteTool, UserToken } from '@/lib/types';
import { FTS_METADATA, NEAR_NETWORK_ID, NEAR_RPC_URL } from '@/app/config';
import { logAgentError, logAgentWarning } from '@/lib/logging';

const FINANCIAL_TRANSACTION_METHODS = ['ft_transfer'];
const WARNING_PRICE = 100; // $100 USD

// Zod schemas
const ActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('FunctionCall'),
    params: z.object({
      methodName: z.string(),
      args: z.record(z.unknown()),
      gas: z.string(),
      deposit: z.string(),
    }),
  }),
  z.object({
    type: z.literal('Transfer'),
    params: z.object({
      deposit: z.string(),
    }),
  }),
]);

const TransactionSchema = z.object({
  signerId: z.string(),
  receiverId: z.string(),
  actions: z.array(ActionSchema),
});

const TransactionSchemaWithWarnings = TransactionSchema.transform(
  async (txn) => {
    const warnings: string[] = [];

    const { totalCost, totalFT, totalNear } =
      await calculateTransactionCosts(txn);

    if (totalCost > WARNING_PRICE) {
      logAgentWarning(
        'DEFAULT',
        `High transaction cost detected: $${totalCost.toFixed(2)}`,
      );
      warnings.push(`High transaction cost detected: $${totalCost.toFixed(2)}`);
    }
    if (totalNear) {
      const userNearBalance = await getBalance({
        accountId: txn.signerId,
        rpcUrl: NEAR_RPC_URL,
      });
      if (userNearBalance.lt(BigInt(totalNear.toString()))) {
        logAgentError(
          'DEFAULT',
          new Error(`User does not have enough near to complete the transaction:
        Owned Near: ${userNearBalance}
        Near Needed: ${totalNear}`),
          { txn, userNearBalance },
        );
        warnings.push('Not enough near to complete transaction.');
      }
    }
    if (totalFT) {
      const userFTBalance = BigInt(
        await ftBalance({
          accountId: txn.signerId,
          contractId: txn.receiverId,
          rpcUrl: NEAR_RPC_URL,
        }),
      );
      if (userFTBalance < totalFT) {
        logAgentError(
          'DEFAULT',
          new Error(`User does not have enough balance to complete the transaction:
        Owned amount: ${userFTBalance}
        Amount Needed: ${totalFT}`),
          { txn, userFTBalance },
        );
        warnings.push(`Not enough balance to complete transaction.`);
      }
    }
    return {
      transaction: txn,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },
);

const FtMetadataSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  decimals: z.number(),
});

type GenerateTransactionParams = {
  transactions: AccountTransaction[];
  network?: 'mainnet' | 'testnet';
};

type GenerateTransactionResult = {
  transactions: AccountTransaction[];
  warnings: string[] | null;
};

export const generateTransaction: BitteTool<
  GenerateTransactionParams,
  GenerateTransactionResult
> = {
  toolSpec: {
    function: {
      name: 'generate-transaction',
      description:
        'Render a Near transaction payload for the user to review and sign.',
      parameters: {
        type: 'object',
        required: ['transactions'],
        properties: {
          transactions: {
            type: 'array',
            description: 'An array of standard Near transaction objects.',
            items: {
              type: 'object',
              properties: {
                signerId: {
                  type: 'string',
                  description: 'The account ID of the transaction signer.',
                },
                receiverId: {
                  type: 'string',
                  description:
                    'The account ID of the transaction receiver (usually a smart contract).',
                },
                actions: {
                  type: 'array',
                  description:
                    'An array of actions to be included in the transaction. Only Transfer and FunctionCall actions are supported.',
                  items: {
                    type: 'object',
                    required: ['type', 'params'],
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['FunctionCall', 'Transfer'],
                        description: 'The type of action to be performed.',
                      },
                      params: {
                        type: 'object',
                        description: 'Parameters specific to each action type.',
                        oneOf: [
                          {
                            type: 'object',
                            required: ['methodName', 'args', 'gas', 'deposit'],
                            properties: {
                              methodName: {
                                type: 'string',
                                description:
                                  'The name of the contract method to call.',
                              },
                              args: {
                                type: 'object',
                                description:
                                  'Arguments to pass to the smart contract method.',
                                properties: {},
                              },
                              gas: {
                                type: 'string',
                                description:
                                  'The maximum amount of gas that can be used by this action, specified in yoctoNEAR (1 NEAR = 1e24 yoctoNEAR).',
                              },
                              deposit: {
                                type: 'string',
                                description:
                                  'The amount of NEAR to attach to this action, specified in yoctoNEAR (1 NEAR = 1e24 yoctoNEAR). For FunctionCall actions use `1` (yoctoNEAR) if no deposit is needed.',
                              },
                            },
                          },
                          {
                            type: 'object',
                            required: ['deposit'],
                            properties: {
                              deposit: {
                                type: 'string',
                                description:
                                  'The amount of NEAR to transfer, specified in yoctoNEAR (1 NEAR = 1e24 yoctoNEAR).',
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
              required: ['signerId', 'receiverId', 'actions'],
            },
          },
        },
      },
    },
    type: 'function',
  },
  execute: async ({ transactions, network = 'mainnet' }) => {
    const validatedTransactions: z.infer<
      typeof TransactionSchemaWithWarnings
    >[] = [];

    try {
      // FIXME: Shouldn't do this
      if (network === 'testnet') {
        return {
          data: {
            transactions,
            warnings: null,
          },
        };
      }

      // Validate transactions
      for (const transaction of transactions) {
        const validatedTransaction =
          await TransactionSchemaWithWarnings.parseAsync(transaction);

        if (validatedTransaction) {
          validatedTransactions.push(validatedTransaction);
        }
      }

      const warningsArray = validatedTransactions.flatMap(
        (t) => t.warnings || [],
      );

      return {
        data: {
          transactions: validatedTransactions.map((t) => t.transaction),
          warnings: warningsArray.length > 0 ? warningsArray : null,
        },
      };
    } catch (error) {
      return { error: getErrorMsg(error) };
    }
  },
};

async function calculateTransactionCosts(
  transaction: Transaction,
): Promise<{ totalCost: number; totalFT: bigint; totalNear: bigint }> {
  const { data: currentNearPrice } = await nearPrice();
  let totalNear = BigInt(0);
  let totalFT = BigInt(0);
  let totalCost = 0;

  for (const action of transaction.actions) {
    switch (action.type) {
      case 'FunctionCall':
        if (FINANCIAL_TRANSACTION_METHODS.includes(action.params.methodName)) {
          const ftMetadata = FTS_METADATA.find(
            (ft) => transaction.receiverId === ft[NEAR_NETWORK_ID],
          );

          if (ftMetadata) {
            const validatedFtMetadata = FtMetadataSchema.parse(ftMetadata);
            totalFT += BigInt(
              'amount' in action.params.args
                ? String(action.params.args.amount)
                : '0',
            );
            const ftBalance: UserToken = {
              meta: {
                contractAddress: transaction.receiverId,
                symbol: validatedFtMetadata.symbol,
                tokenIcon: '',
                isSpam: false,
                decimals: validatedFtMetadata.decimals,
                name: validatedFtMetadata.name,
              },
              balances: {
                balance: parseFloat(
                  formatUnits(totalFT, validatedFtMetadata.decimals),
                ),
                usdBalance: 0,
              },
              chain: { chainName: 'NEAR' },
            };

            const amountInUsd = calculateUsd(
              Number(currentNearPrice),
              ftBalance,
            );
            totalCost += amountInUsd || 0;
          }
        }
        break;
      case 'Transfer':
        totalNear += BigInt(action.params.deposit);
        const amountInUsd =
          (Number(currentNearPrice) * Number(action.params.deposit)) / 1e24; // deposit is in yocto so we divide by 1e24 (near decimals)

        totalCost += amountInUsd;
        break;
    }
  }
  return { totalCost, totalFT, totalNear };
}

export const calculateUsd = (
  currentNearPrice: number,
  token?: UserToken,
  price?: string | number,
): number | null => {
  let tokenUsdCalc: number | null = null;
  if (!token && !price) return null;
  if (token) {
    const tokenBalance = token.balances.balance;

    if ('price' in token && token.price) {
      tokenUsdCalc = token.balances.balance * Number(token.price);
    }

    if ('symbol' in token) {
      if (['USDT.e', 'USDC.e'].includes(token.meta.symbol)) {
        tokenUsdCalc = tokenBalance;
      }

      if (token.symbol === 'wNEAR') {
        const wNearCalc = currentNearPrice * Number(token.balances.balance);
        tokenUsdCalc =
          parseFloat(wNearCalc.toString()) / Math.pow(10, token.meta.decimals);
      }
    }
  }

  if (!!price) {
    tokenUsdCalc = parseFloat((currentNearPrice * Number(price)).toString());
  }

  return tokenUsdCalc;
};
