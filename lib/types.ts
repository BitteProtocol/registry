import { Tool as OpenAITool, JSONValue, CoreMessage, Message } from "ai";
import { FunctionTool } from "openai/resources/beta/assistants";
import { FunctionDefinition } from "openai/resources/index";
import { OpenAPIV3 } from "openapi-types";
import { QueryDocumentSnapshot, Timestamp } from '@google-cloud/firestore';
import {
  FunctionCallAction,
  Transaction,
  TransferAction,
} from '@near-wallet-selector/core';


// [x-mb].assistant shared fields
export type BitteAssistantBase = {
  name: string;
  description: string;
  instructions: string;
  tools?: BitteToolSpec[];
  image?: string;
  chainIds?: number[];
  categories?: string[];
  repo?: string;
};

export type BitteAssistantConfig = BitteAssistantBase & {
  id: string;
  accountId?: string;
  verified: boolean;
};

// TODO: Remove this once we have a better way to handle this. Also in runtime `./src/lib/types.ts`
export type AnyBitteTool = BitteTool<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type BitteAssistant = Omit<BitteAssistantConfig, "tools"> & {
  toolSpecs?: FunctionTool[];
  tools?: Record<string, OpenAITool>;
};

// --------------------------------- Agents --------------------------------- //
export type BitteAgentConfig = {
  id: string;
  name: string;
  accountId?: string;
  description: string;
  instructions: string;
  verified: boolean;
  tools?: BitteToolSpec[];
  image?: string;
  repo?: string;
  categories?: string[];
  chainIds?: number[];
};

export type BitteAgent = Omit<BitteAgentConfig, 'tools'> & {
  toolSpecs?: FunctionTool[];
  tools?: Record<string, OpenAITool>;
};

export type BitteOpenAPISpec = OpenAPIV3.Document & {
  'x-mb': {
    'account-id'?: string;
    assistant: BitteAgentBase;
  };
};

export type BitteAgentBase = {
  name: string;
  description: string;
  instructions: string;
  tools?: BitteToolSpec[];
  image?: string;
  chainIds?: number[];
  categories?: string[];
  repo?: string;
};

export type AgentMetadata = {
  evmAddress?: string;
  accountId?: string;
  network: string;
  localAgent?: LocalAgentSpec;
  agentId: string;
};

export type LocalAgentSpec = {
  pluginId: string;
  accountId: string;
  spec: BitteOpenAPISpec;
};

// --------------------------------- Tools ---------------------------------- //
export type BitteMetadata = Record<string, unknown>;

export type BitteToolSpec = PluginToolSpec | FunctionTool;

export type PluginToolSpec = {
  id: string;
  agentId: string;
  type: 'function';
  function: FunctionDefinition;
  execution: ExecutionDefinition;
  verified: boolean;
};

export type ExecutionDefinition = {
  baseUrl: string;
  path: string;
  httpMethod: string;
};

export type BitteTool<TArgs = Record<string, JSONValue>, TResult = unknown> = {
  toolSpec: FunctionTool;
  execute?: BitteToolExecutor<TArgs, TResult>;
  // render?: BitteToolRenderer; // TODO: remove if this stays unused
};

export type BitteToolExecutor<
  TArgs = Record<string, JSONValue>,
  TResult = unknown,
> = (
  args: TArgs,
  metadata?: BitteMetadata,
) => Promise<BitteToolResult<TResult>>;

export type BitteToolResult<TResult = unknown> =
  | { data: TResult; error?: never }
  | { data?: never; error: string };

export type BitteToolWarning = {
  message: string;
  final: boolean;
};

// ---------------------------- Firestore utils ----------------------------- //
export type Converter<T> = {
  toFirestore: (data: T) => T;
  fromFirestore: (snapshot: QueryDocumentSnapshot) => T;
};

// ------------------------------- Primitives ------------------------------- //
export type BittePrimitiveRef = {
  type: string;
};

export type AccountTransaction = Omit<Transaction, 'actions'> & {
  actions: Array<FunctionCallAction | TransferAction>;
};

// FT balances
export type UserToken = {
  chain: UserTokenChain;
  balances: UserTokenBalance;
  meta: UserTokenMeta;
};

export type UserTokenChain = {
  chainId?: number; // undefined is Near
  chainName: string;
  chainIcon?: string;
};

export type UserTokenBalance = {
  balance: number;
  usdBalance: number;
  price?: number;
};

export type UserTokenMeta = {
  name: string;
  symbol: string;
  decimals: number;
  tokenIcon?: string;
  contractAddress?: string;
  isSpam: boolean;
};

export type AllowlistedToken = {
  name: string;
  symbol: string;
  contractId: string;
  decimals: number;
  icon?: string;
};

// GQL queries
export type GqlFetchResult<T> = {
  data?: T;
  error?: string;
};

// Image generation
export type GenerateImageResponse = {
  url: string;
  hash: string;
};

// NFT drops
export type TokenDrop = {
  creator: string;
  enabled: boolean;
  id: string;
  media: string;
  total_minted: number;
  name: string | null;
  description: string | null;
  proxy: string;
  contract_id: string;
  owners?: string[];
  reference?: string;
  transactionUrl?: string;
  start_date?: string;
  end_date?: string;
};

export type DbTokenDrop = Omit<TokenDrop, 'start_date' | 'end_date'> & {
  start_date: Timestamp;
  end_date?: Timestamp;
};

export type CreateTokenDrop = Pick<
  DbTokenDrop,
  'id' | 'name' | 'description' | 'media' | 'contract_id' | 'creator'
>;

export type TokenDropsOwned = {
  drops: string[];
};

// Charts
export type ChartType = 'line' | 'bar' | 'area' | 'candle';
export type DataFormat = 'number' | 'currency' | 'percentage';
export type TimeValue = string | number;
export type RawDataPoint = [TimeValue, number, ...number[]];
export type ChartDataPoint = {
  time: number;
  [key: string]: number;
};
export type OhlcDataPoint = {
  time: number;
  open: number;
  close: number;
  high: number;
  low: number;
};

export type MetricData = {
  metric: string;
  percentageChange: number;
  isPositive: boolean;
  isCandle: boolean;
};

export type ChartProps<T extends ChartType = ChartType> = {
  chartConfig: ChartConfig;
  timeKey: string;
  metricKeys: string[];
  chartData: T extends 'candle' ? OhlcDataPoint[] : ChartDataPoint[];
  dateFormatter: (timestamp: number, compact?: boolean) => string;
  valueFormatter: (value: unknown, compact?: boolean) => string;
};

export type ChartConfig = {
  [k in string]: {
    label?: string;
    icon?: string;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<'light' | 'dark', string> }
  );
};

export type ChartWrapperProps<T extends ChartType = ChartType> = Omit<
  ChartProps<T>,
  'dateFormatter' | 'valueFormatter' | 'metricKeys' | 'timeKey'
> & {
  title: string;
  description: string;
  metricLabels: string[];
  metricData: MetricData[];
  chartType: T;
  dataFormat?: DataFormat;
};

export type RenderChartArgs = Omit<
  ChartWrapperProps,
  'chartConfig' | 'chartData'
> & {
  metricLabels: string[];
  dataPoints: [TimeValue, ...number[]][];
};

// Sign message

export type SignMessageParams = {
  message: string;
  callbackUrl: string;
  recipient: string;
  nonce: string;
};

export type SignMessageResult = {
  accountId: string;
  publicKey: string;
  signature: string;
  message: string;
  nonce: string;
  recipient: string;
  callbackUrl: string;
  state: string;
};

// ----------------------------- Smart Actions ------------------------------ //
export type SmartAction = {
  id: string;
  agentId: string;
  message: string;
  creator: string;
  createdAt: number;
};

export type SmartActionMessage = CoreMessage & {
  id: string;
  agentId?: string;
};

export type SmartActionChat = SmartAction & {
  messages: SmartActionMessage[];
};

export type SaveSmartAction = {
  agentId: string;
  creator: string;
  message: string;
};

export type SaveMessages = {
  id: string;
  agentId: string;
  creator: string;
  messages: Message[];
};

// ---------------------------------- Misc ---------------------------------- //
export enum ChatMode {
  DEFAULT = 'default',
  DEBUG = 'debug', // Used for Playground
}

export type NearNetworkId = 'mainnet' | 'testnet';
export const isNearNetworkId = (x: unknown): x is NearNetworkId =>
  typeof x === 'string' && ['mainnet', 'testnet'].includes(x);

//------------------------------ Tokens ------------------------------------//
export interface WalletBalanceCache {
  data: WalletAgentContext;
  timestamp: number;
}

export type WalletAgentContext = {
  portfolioValue: number;
  chainsWithGas: string[];
  significantAssets: {
    symbol: string;
    usdValue: number;
    chains: string[];
  }[];
  actionableSummary: string;
};

//---------------------------- Firestore types ----------------------------//
export interface Tool {
  id: string;
  agentId: string;
  type: 'function';
  function: {
    name: string;
    description: string;
  };
  execution: {
    baseUrl: string;
    path: string;
    httpMethod: string;
  };
  image?: string;
  isPrimitive?: boolean;
}

export type Agent = {
  id: string;
  name: string;
  accountId: string;
  description: string;
  instructions: string;
  tools: Tool[];
  image: string;
  chainIds: number[];
  verified: boolean;
  repo: string;
  generatedDescription: string;
}