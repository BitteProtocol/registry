export const OPEN_API_SPEC_PATH = ".well-known/ai-plugin.json";

export const ALLOW_EXTERNAL_REQUEST_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
export const COLLECTIONS = {
  AGENTS: "ai-assistants",
  TOOLS: "tools",
} as const;

// ------------------------------- Primitives ------------------------------- //

export const BittePrimitiveNames = [
  "create-drop",
  "generate-evm-tx",
  "generate-image",
  "generate-transaction",
  "getSwapTransactions",
  "getTokenMetadata",
  "render-chart",
  "share-twitter",
  "sign-message",
  "submit-query",
  "transfer-ft",
];

export const DEFAULT_MODEL = "gpt-4o";


export const supportedMainnetChains = [
  10, // Optimism
  56, // Binance Smart Chain (BSC)
  137, // Polygon
  100, // xDai (Gnosis Chain)
  8453, // Base
  34443, // Mode
  42161, // Arbitrum One
  43114, // Avalanche
  1, // Ethereum Mainnet
];

export const chainIdToName: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  56: 'BSC',
  137: 'Polygon',
  100: 'Gnosis',
  8453: 'Base',
  34443: 'Mode',
  42161: 'Arbitrum',
  43114: 'Avalanche',
};