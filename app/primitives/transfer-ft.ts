import { ftStorageBalance } from '@mintbase-js/rpc';
import { GAS_CONSTANTS, ONE_YOCTO } from '@mintbase-js/sdk';
import { FunctionCallAction } from '@near-wallet-selector/core';
import { parseUnits } from 'viem';

import {
  AccountTransaction,
  AllowlistedToken,
  BitteTool,
  NearNetworkId,
} from '@/lib/types';
import { generateTransaction } from './generate-transaction';
import { getErrorMsg } from '@/lib/error';
import { FTS_METADATA, NEAR_RPC_URL } from '@/app/config';
import Fuse from 'fuse.js';

type TransferFtParams = {
  signerId: string;
  receiverId: string;
  tokenIdentifier: string;
  amount: string;
  network?: 'mainnet' | 'testnet';
};

type TransferFtResult = {
  transactions: AccountTransaction[];
  warnings?: string[];
};

export const transferFt: BitteTool<TransferFtParams, TransferFtResult> = {
  toolSpec: {
    function: {
      name: 'transfer-ft',
      description:
        'Transfer fungible tokens.  Automates the process of transferring fungible tokens and renders a Near transaction payload for the user to review and sign.',
      parameters: {
        type: 'object',
        required: ['signerId', 'receiverId', 'tokenIdentifier', 'amount'],
        properties: {
          signerId: {
            type: 'string',
            description:
              'Address of the account sending the fungible token amount.',
          },
          receiverId: {
            type: 'string',
            description:
              'Address of the account to receive the fungible token amount.',
          },
          tokenIdentifier: {
            type: 'string',
            description:
              'Name, symbol, or contract ID of the fungible token being transferred.  This will be used in a fuzzy search to find the token.',
          },
          amount: {
            type: 'string',
            description:
              "Amount of tokens to be transferred.  Example: '1' for 1 token, '0.001' for 0.001 tokens.",
          },
          network: {
            type: 'string',
            description: 'The NEAR network on which the transfer will occur.',
            enum: ['mainnet', 'testnet'],
          },
        },
      },
    },
    type: 'function',
  },
  execute: async ({
    signerId,
    receiverId,
    tokenIdentifier,
    amount,
    network = 'mainnet',
  }) => {
    try {
      const transactions: AccountTransaction[] = [];
      const warnings: string[] = [];

      const tokenInfo = searchToken(tokenIdentifier, network)?.[0];

      if (!tokenInfo) {
        return {
          error: `Token '${tokenIdentifier}' not found. Please check the token name and try again.`,
        };
      }

      const contractId = tokenInfo.contractId;

      const args = {
        receiver_id: receiverId,
        amount: parseUnits(amount, tokenInfo.decimals).toString(),
        memo: null,
      };

      const isUserRegistered = await ftStorageBalance({
        contractId,
        accountId: receiverId,
        rpcUrl: NEAR_RPC_URL,
      });

      // Check and build storage_deposit transaction if needed
      if (!isUserRegistered) {
        const storageDeposit: FunctionCallAction = {
          type: 'FunctionCall',
          params: {
            methodName: 'storage_deposit',
            args: { account_id: receiverId },
            deposit: ONE_YOCTO,
            gas: GAS_CONSTANTS.DEFAULT_GAS,
          },
        };

        const { data: storageDepositData, error: storageDepositError } =
          await generateTransaction.execute!({
            transactions: [
              {
                signerId,
                receiverId: contractId,
                actions: [storageDeposit],
              },
            ],
            network,
          });

        if (
          storageDepositError ||
          !storageDepositData ||
          storageDepositData.transactions.length === 0
        ) {
          return {
            error:
              storageDepositError ||
              'Error generating storage_deposit transaction',
          };
        }

        transactions.push(...storageDepositData.transactions);
        if (storageDepositData.warnings) {
          warnings.push(...storageDepositData.warnings);
        }
      }

      // Build ft_transfer transaction
      const ftTransfer: FunctionCallAction = {
        type: 'FunctionCall',
        params: {
          methodName: 'ft_transfer',
          args,
          deposit: ONE_YOCTO,
          gas: GAS_CONSTANTS.FT_TRANSFER,
        },
      };
      const { data: ftTransferData, error: ftTransferError } =
        await generateTransaction.execute!({
          transactions: [
            {
              signerId,
              receiverId: contractId,
              actions: [ftTransfer],
            },
          ],
          network,
        });

      if (
        ftTransferError ||
        !ftTransferData ||
        ftTransferData.transactions.length === 0
      ) {
        return {
          error: ftTransferError || 'Error generating ft_transfer transaction',
        };
      }

      transactions.push(...ftTransferData.transactions);
      if (ftTransferData.warnings) {
        warnings.push(...ftTransferData.warnings);
      }

      return {
        data: {
          transactions,
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      };
    } catch (error) {
      return {
        error: getErrorMsg(error),
      };
    }
  },
};

const tokens = ((): {
  mainnet: AllowlistedToken[];
  testnet: AllowlistedToken[];
} => {
  const mainnet: AllowlistedToken[] = [];
  const testnet: AllowlistedToken[] = [];

  for (const token of FTS_METADATA) {
    const { name, symbol, decimals, icon } = token;

    if (token.mainnet) {
      mainnet.push({
        name,
        symbol,
        decimals,
        icon,
        contractId: token.mainnet,
      });
    }

    if (token.testnet) {
      testnet.push({
        name,
        symbol,
        decimals,
        icon,
        contractId: token.testnet,
      });
    }
  }
  return { mainnet, testnet };
})();

export const searchToken = (
  query: string,
  network: NearNetworkId = 'mainnet',
): AllowlistedToken[] | null => {
  const isMainnet = network === 'mainnet';
  if (query.toLowerCase() === 'near') {
    query = isMainnet ? 'wrap.near' : 'wrap.testnet'; // Special case for NEAR
  }
  const fuse = new Fuse(isMainnet ? tokens.mainnet : tokens.testnet, {
    keys: [
      { name: 'name', weight: 0.5 },
      { name: 'symbol', weight: 0.4 },
      { name: 'contractId', weight: 0.1 },
    ],
    isCaseSensitive: false,
    threshold: 0.0,
  });

  const result = fuse.search(query);

  if (result.length === 0) {
    return null;
  }

  return result.map((item) => item.item);
};
