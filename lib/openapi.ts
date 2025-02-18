import { OpenAPIV3 } from 'openapi-types';

export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'Agent and Tools API',
    version: '1.0.0',
    description: 'API for managing AI agents and their tools',
  },
  paths: {
    '/api/agents': {
      get: {
        summary: 'Get all agents',
        parameters: [
          {
            name: 'verifiedOnly',
            in: 'query',
            description: 'Filter for verified agents only',
            schema: { type: 'boolean', default: true },
          },
          {
            name: 'chainIds',
            in: 'query',
            description: 'Filter agents by chain IDs (comma-separated)',
            schema: { type: 'string' },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of agents to return',
            schema: { type: 'integer', default: 50 },
          },
          {
            name: 'offset',
            in: 'query',
            description: 'Number of agents to skip',
            schema: { type: 'integer', default: 0 },
          }
        ],
        responses: {
          '200': {
            description: 'List of agents',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Agent',
                  },
                },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/agents/{agentId}': {
      get: {
        summary: 'Get agent by ID',
        parameters: [
          {
            name: 'agentId',
            in: 'path',
            required: true,
            description: 'ID of the agent',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Agent details',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Agent',
                },
              },
            },
          },
          '404': {
            description: 'Agent not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/tools': {
      get: {
        summary: 'Get all tools',
        parameters: [
          {
            name: 'function',
            in: 'query',
            description: 'Filter tools by function name',
            schema: { type: 'string' },
          },
          {
            name: 'verifiedOnly',
            in: 'query',
            description: 'Filter for verified tools only',
            schema: { type: 'boolean', default: true },
          },
          {
            name: 'offset',
            in: 'query',
            description: 'Number of tools to skip',
            schema: { type: 'integer', default: 0 },
          },
          {
            name: 'chainId',
            in: 'query',
            description: 'Filter tools by chain ID',
            schema: { type: 'string' },
          }
        ],
        responses: {
          '200': {
            description: 'List of tools',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Tool',
                  },
                },
              },
            },
          },
          '500': {
            description: 'Server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Tool: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['function'] },
          parameters: { type: 'object' },
          image: { type: 'string' },
          isPrimitive: { type: 'boolean' },
          pings: { type: 'integer' },
          function: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            },
            required: ['name']
          }
        },
        required: ['name', 'description', 'type'],
      },
      Agent: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          generatedDescription: { type: 'string' },
          image: { type: 'string' },
          instructions: { type: 'string' },
          tools: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Tool',
            },
          },
          verified: { type: 'boolean' },
          pings: { type: 'integer' },
          accountId: { type: 'string' },
          repo: { type: 'string' }
        },
        required: ['id', 'name', 'description', 'verified', 'accountId', 'instructions', 'tools', 'image', 'repo', 'generatedDescription'],
      },
    },
  },
}; 