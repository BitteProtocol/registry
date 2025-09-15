import SwaggerParser from '@apidevtools/swagger-parser';
import { JSONValue } from 'ai';
import { OpenAI } from 'openai';
import { DEFAULT_MODEL } from '@/lib/constants';
import type {
  BitteAssistantConfig,
  BitteOpenAPISpec,
  PluginToolSpec,
} from '@/lib/types';
import { errorString } from './error';

const openai = new OpenAI();
export const createPluginToolsFromOpenAPISpec = ({
  spec,
  pluginId,
}: {
  spec: BitteOpenAPISpec;
  pluginId: string;
}): PluginToolSpec[] => {
  const apiUrl =
    spec.servers?.[0].url.replace('https://', '').replace(/\/$/, '') ||
    pluginId;

  if (!apiUrl) {
    throw new Error('apiUrl not found in OpenAPI spec');
  }

  const tools: PluginToolSpec[] = [];

  if (!spec.paths) {
    throw new Error('Paths not found in OpenAPI spec');
  }

  for (const [path, pathDetails] of Object.entries(spec.paths)) {
    if (!pathDetails) {
      continue;
    }
    for (const [httpMethod, methodDetails] of Object.entries(pathDetails)) {
      if (typeof methodDetails === 'string' || Array.isArray(methodDetails)) {
        throw new Error('Invalid method details in OpenAPI spec');
      }
      const functionName = methodDetails?.operationId;
      if (!functionName) {
        throw new Error(
          'OperationId/functionName must be defined for each operation'
        );
      }

      const parameters = methodDetails.parameters?.reduce(
        (
          acc: { [key: string]: { type: string; description: string } },
          param
        ) => {
          if (
            'name' in param &&
            param.schema &&
            'type' in param.schema &&
            param.schema.type &&
            param.description
          ) {
            acc[param.name] = {
              type: param.schema.type,
              description: param.description,
            };
          }
          return acc;
        },
        {}
      );

      const tool: PluginToolSpec = {
        id: `${pluginId}-${functionName}`,
        agentId: pluginId,
        type: 'function',
        function: {
          name: functionName,
          description: methodDetails.description || undefined,
          parameters:
            parameters && Object.keys(parameters).length > 0
              ? {
                  type: 'object',
                  properties: parameters,
                  required: Object.keys(parameters) || [],
                }
              : undefined,
        },
        execution: {
          baseUrl: apiUrl,
          path,
          httpMethod,
        },
        verified: false,
      };

      // Remove undefined properties
      Object.keys(tool).forEach((key) => {
        if (tool[key as keyof PluginToolSpec] === undefined) {
          delete tool[key as keyof PluginToolSpec];
        }
      });

      if (tool.function.parameters === undefined) {
        delete tool.function.parameters;
      }

      tools.push(tool);
    }
  }

  return tools;
};

const CREATE_ASSISTANT_PROMPT = `Given an OpenAPI specification, generate a JSON object that describes an AI assistant based on the information in the spec. The JSON object should have the following structure:
{
  "name": "string",
  "description": "string",
  "instructions": "string"
}

Follow these guidelines:

Name (max 256 characters):
Use the title from the OpenAPI spec's "info" section as a basis.
Make it concise and descriptive of the assistant's main function.

Description (max 512 characters):
Summarize the main capabilities of the assistant.
Highlight key features or unique aspects of the assistant.

Instructions (max 256,000 characters):
Write clear and detailed instructions for the assistant based on the available endpoints and operations in the OpenAPI spec.`;

export const generateAssistantFromOpenAPISpec = async ({
  spec,
}: {
  spec: BitteOpenAPISpec;
}): Promise<Omit<BitteAssistantConfig, 'id'>> => {
  const completionResponse = await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: CREATE_ASSISTANT_PROMPT,
      },
      {
        role: 'user',
        content: JSON.stringify(spec),
      },
    ],
    model: DEFAULT_MODEL,
    response_format: {
      type: 'json_object',
    },
  });

  const completion = completionResponse.choices[0].message.content;

  const assistantObject = completion
    ? ({
        ...JSON.parse(completion),
        model: DEFAULT_MODEL,
      } satisfies BitteAssistantConfig)
    : undefined;

  if (
    !assistantObject ||
    !assistantObject.name ||
    !assistantObject.description ||
    !assistantObject.instructions
  ) {
    throw new Error('Failed to generate a valid assistant from OpenAPI spec');
  }

  return assistantObject;
};

export const processPluginId = (
  urlParam: string | null
): { pluginId?: string; error?: string } => {
  if (!urlParam) {
    return {
      error: 'Missing pluginId in URL i.e.  /api/ai-plugins/[pluginId]',
    };
  }

  if (urlParam === '{pluginId}') {
    return {
      error: 'Missing pluginId, found placeholder {pluginId}',
    };
  }

  if (urlParam.startsWith('http://')) {
    return { error: 'Plugin URL must use HTTPS' };
  }

  try {
    const urlWithProtocol = urlParam.startsWith('https://')
      ? urlParam
      : `https://${urlParam}`;

    const url = new URL(urlWithProtocol);
    const pluginId = url.hostname + url.pathname.replace(/\/$/, ''); // remove trailing slash

    return { pluginId };
  } catch (error) {
    return { error: 'Invalid pluginId provided. Error: ' + errorString(error) };
  }
};

export const sanitizeSpec = async (
  spec: BitteOpenAPISpec
): Promise<BitteOpenAPISpec> => {
  const validatedSpec = await SwaggerParser.validate(spec);
  // remove empty objects and arrays form a spec or spec part
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sanitize = (value: unknown): any => {
    if (Array.isArray(value)) {
      // Handle arrays
      const sanitizedArray = value
        .map(sanitize)
        .filter(
          (item) =>
            item !== null &&
            item !== undefined &&
            item !== '' &&
            (typeof item !== 'object' || Object.keys(item).length > 0)
        );

      // Convert nested arrays to objects
      return sanitizedArray.map((item, index) =>
        Array.isArray(item) ? { [`item_${index}`]: item } : item
      );
    } else if (typeof value === 'object' && value !== null) {
      // Handle objects
      const sanitizedObj: Record<string, JSONValue> = {};
      for (const [key, val] of Object.entries(value)) {
        const sanitizedValue = sanitize(val);
        if (sanitizedValue !== undefined && sanitizedValue !== null) {
          sanitizedObj[key] = sanitizedValue;
        }
      }
      return Object.keys(sanitizedObj).length > 0 ? sanitizedObj : null;
    } else {
      // Handle primitive values
      return value === '' || value === null || value === undefined
        ? null
        : value;
    }
  };

  return sanitize(validatedSpec);
};
