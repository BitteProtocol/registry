import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { z } from 'zod';
import { BitteTool } from '@/lib/types';
import { getErrorMsg } from '@/lib/error';
import { MIST_PER_SUI } from '@mysten/sui/utils';

const SUI_NETWORKS = ['mainnet', 'testnet', 'devnet'] as const;
type SuiNetwork = (typeof SUI_NETWORKS)[number];

const SUI_RPC_URLS: Record<SuiNetwork, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io',
  testnet: 'https://fullnode.testnet.sui.io',
  devnet: 'https://fullnode.devnet.sui.io',
};

const GenerateSuiTxSchema = z.object({
  transactionBytes: z.string().optional(),
  recipientAddress: z.string().optional(),
  senderAddress: z.string().optional(),
  amountInSui: z.number().positive().optional(),
  network: z.enum(SUI_NETWORKS).optional().default('mainnet'),
});

type GenerateSuiTxParams = z.infer<typeof GenerateSuiTxSchema>;

interface GenerateSuiTxResult {
  suiTransactionBytes: string;
}

export const generateSuiTx: BitteTool<
  GenerateSuiTxParams,
  GenerateSuiTxResult
> = {
  toolSpec: {
    function: {
      name: 'generate-sui-tx',
      description:
        'Validate existing transaction bytes or build new transaction bytes for sending SUI',
      parameters: {
        type: 'object',
        properties: {
          transactionBytes: {
            type: 'string',
            description: 'Base64-encoded transaction bytes to validate',
          },
          recipientAddress: {
            type: 'string',
            description: 'The address to which someone wants to send SUI',
          },
          senderAddress: {
            type: 'string',
            description: 'The address from which to send SUI',
          },
          amountInSui: {
            type: 'integer',
            description: 'Amount to send in SUI',
          },
          network: {
            type: 'string',
            enum: ['mainnet', 'testnet', 'devnet'],
            default: 'mainnet',
            description: 'Sui network to use',
          },
        },
      },
    },
    type: 'function',
  },
  execute: async (params) => {
    try {
      const validatedParams = GenerateSuiTxSchema.parse(params);
      const {
        transactionBytes,
        recipientAddress,
        senderAddress,
        amountInSui,
        network = 'mainnet',
      } = validatedParams;
      const suiClient = new SuiClient({ url: SUI_RPC_URLS[network] });

      // Mode 1: Validate existing transaction bytes
      if (transactionBytes) {
        const txBytes = Buffer.from(transactionBytes, 'base64');
        const tx = Transaction.from(txBytes);

        if (!tx) {
          throw new Error('Failed to decode transaction bytes');
        }

        return {
          data: { suiTransactionBytes: transactionBytes },
        };
      }

      // Mode 2: Build a new transfer transaction
      if (recipientAddress && amountInSui !== undefined && senderAddress) {
        const tx = new Transaction();
        const amountInMist = Math.floor(amountInSui * Number(MIST_PER_SUI));

        if (amountInMist > Number.MAX_SAFE_INTEGER) {
          throw new Error('Amount exceeds maximum safe integer value');
        }

        const [coin] = tx.splitCoins(tx.gas, [
          tx.pure.u64(BigInt(amountInMist)),
        ]);
        tx.setSender(senderAddress);

        tx.transferObjects([coin], tx.pure.address(recipientAddress));

        const txBytes = await tx.build({
          client: suiClient,
        });
        const suiTransactionBytes = Buffer.from(txBytes).toString('base64');

        return {
          data: { suiTransactionBytes },
        };
      }

      throw new Error(
        'Must provide either transactionBytes OR (recipientAddress, senderAddress, amountInSui)',
      );
    } catch (error) {
      return { error: getErrorMsg(error) };
    }
  },
};
