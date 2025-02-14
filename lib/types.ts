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
  verified: boolean;
  repo: string;
  generatedDescription: string;
}