import { FunctionTool } from 'openai/resources/beta/assistants';
import { AnyBitteTool, BittePrimitiveRef, BitteToolSpec } from '@/lib/types';
import { createDrop } from './create-drop';
import { generateEvmTx } from './generate-evm-transaction';
import { generateImage } from './generate-image';
import { generateTransaction } from './generate-transaction';
import { getPortfolio } from './get-portfolio';
import { getSwapTransactions, getTokenMetadata } from './ref-finance-tools';
import { renderChart } from './render-chart';
import { signMessage } from './sign-message';
import { submitQuery } from './submit-query';
import { transferFt } from './transfer-ft';
import { generateSuiTx } from './generate-sui-tx';

export enum BittePrimitiveName {
  TRANSFER_FT = 'transfer-ft',
  GENERATE_TRANSACTION = 'generate-transaction',
  SUBMIT_QUERY = 'submit-query',
  GENERATE_IMAGE = 'generate-image',
  CREATE_DROP = 'create-drop',
  GET_SWAP_TRANSACTIONS = 'getSwapTransactions',
  GET_TOKEN_METADATA = 'getTokenMetadata',
  GENERATE_EVM_TX = 'generate-evm-tx',
  GENERATE_SUI_TX = 'generate-sui-tx',
  RENDER_CHART = 'render-chart',
  SIGN_MESSAGE = 'sign-message',
  GET_PORTFOLIO = 'get-portfolio',
}

export const isBittePrimitiveName = (
  value: unknown,
): value is BittePrimitiveName => {
  return Object.values(BittePrimitiveName).includes(
    value as BittePrimitiveName,
  );
};

export const BITTE_PRIMITIVES = {
  [BittePrimitiveName.TRANSFER_FT]: transferFt,
  [BittePrimitiveName.GENERATE_TRANSACTION]: generateTransaction,
  [BittePrimitiveName.GENERATE_EVM_TX]: generateEvmTx,
  [BittePrimitiveName.SUBMIT_QUERY]: submitQuery,
  [BittePrimitiveName.GENERATE_IMAGE]: generateImage,
  [BittePrimitiveName.CREATE_DROP]: createDrop,
  [BittePrimitiveName.GET_SWAP_TRANSACTIONS]: getSwapTransactions,
  [BittePrimitiveName.GET_TOKEN_METADATA]: getTokenMetadata,
  [BittePrimitiveName.RENDER_CHART]: renderChart,
  [BittePrimitiveName.SIGN_MESSAGE]: signMessage,
  [BittePrimitiveName.GET_PORTFOLIO]: getPortfolio,
  [BittePrimitiveName.GENERATE_SUI_TX]: generateSuiTx,
} satisfies Record<BittePrimitiveName, AnyBitteTool>;

export const BITTE_PRIMITIVE_SPECS = Object.fromEntries(
  Object.entries(BITTE_PRIMITIVES).map(([key, value]) => [key, value.toolSpec]),
) as Record<BittePrimitiveName, BitteToolSpec>;

export const findPrimitiveTools = (
  tools: BittePrimitiveRef[] | undefined,
): FunctionTool[] => {
  return (
    tools?.flatMap(
      (tool) =>
        Object.values(BITTE_PRIMITIVE_SPECS).find(
          (p) => p.function.name === tool.type,
        ) || [],
    ) || []
  );
};
