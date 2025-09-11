import { Tool as OpenAITool, JSONValue } from "ai";
import { FunctionTool } from "openai/resources/beta/assistants";
import { FunctionDefinition } from "openai/resources/index";
import { OpenAPIV3 } from "openapi-types";


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

// // TODO: Remove this once we have a better way to handle this. Also in runtime `./src/lib/types.ts`
// export type AnyBitteTool = BitteTool<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type BitteAssistant = Omit<BitteAssistantConfig, "tools"> & {
  toolSpecs?: FunctionTool[];
  tools?: Record<string, OpenAITool>;
};

// // --------------------------------- Agents --------------------------------- //
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

// // --------------------------------- Tools ---------------------------------- //
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
