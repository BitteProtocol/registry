import SwaggerParser from "@apidevtools/swagger-parser";
import { getPlugin, Prisma, Agent, prismaClient, getAgent } from "@bitte-ai/data";
import { NextResponse } from "next/server";
import {
  NextContext,
  NextRequestWithUnkeyContext,
  withUnkey,
} from "@unkey/nextjs";
import {
  ALLOW_EXTERNAL_REQUEST_HEADERS,
  OPEN_API_SPEC_PATH,
} from "@/lib/constants";
import {
  BitteOpenAPISpec,
  PluginToolSpec,
} from "@/lib/types";
import { unkeyConfig } from "@/lib/unkey";
import { getBaseUrl } from "@/lib/utils";
import { JSONValue } from "ai";
import { generateAssistantFromOpenAPISpec } from "@/lib/plugins";
import { errorString } from "@/lib/error";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ pluginId: string }> }
) => {
  try {
    const pluginId = (await params).pluginId;
    const plugin = await getPlugin(pluginId);

    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    return NextResponse.json(plugin);
  } catch (error) {
    console.error("Error fetching plugin:", error);
    return NextResponse.json(
      { error: "Failed to fetch plugin" },
      { status: 500 }
    );
  }
};

interface ErrorLog {
  step: string;
  error: string;
  details?: unknown;
}

const logError = (errorLog: ErrorLog) => {
  console.error(`[Plugin Registration Error] ${errorLog.step}:`, {
    error: errorLog.error,
    details: errorLog.details || {},
    timestamp: new Date().toISOString(),
  });
};

// Create new plugin
export const POST = withUnkey(
  async (req: NextRequestWithUnkeyContext, context: NextContext) => {
    try {
      // 1. Validate URL Parameter
      const urlParam = (await context.params)["pluginIds"]?.[0];
      if (!urlParam) {
        const error =
          "Missing pluginId in request params i.e. /api/ai-plugins/[pluginId]";
        logError({ step: "URL Parameter Validation", error });
        return NextResponse.json({ error }, { status: 400 });
      }

      // 2. Process Plugin ID
      const processIdResult = processPluginId(urlParam);
      const pluginId = processIdResult.pluginId;
      if (!pluginId) {
        const error = processIdResult.error || "Invalid plugin URL";
        logError({
          step: "Plugin ID Processing",
          error,
          details: { urlParam, processIdResult },
        });
        return NextResponse.json({ error }, { status: 400 });
      }

      // 3. Validate API Key
      const { valid, code, keyId } = req.unkey || {};
      if (!valid || !keyId) {
        return new NextResponse(code || "UNKNOWN_AUTH_ERROR", {
          status: 403,
          headers: ALLOW_EXTERNAL_REQUEST_HEADERS,
        });
      }

      // 4. Fetch Raw Spec
      const rawSpec = await fetchRawSpec(pluginId, OPEN_API_SPEC_PATH);
      if (!rawSpec) {
        const error = `Plugin spec not found at https://${pluginId}/${OPEN_API_SPEC_PATH}`;
        logError({
          step: "Fetch Raw Spec",
          error,
          details: { pluginId, specPath: OPEN_API_SPEC_PATH },
        });
        return NextResponse.json({ error }, { status: 400 });
      }

      // 6. Check for Existing Plugin
      const existingPlugin = await getPlugin(pluginId);
      const debugUrl = `${getBaseUrl(req)}/smart-actions/prompt/how%20can%20you%20assist%20me%3F?mode=debug&agentId=${pluginId}`;

      if (existingPlugin) {
        const error = "Plugin already registered";
        logError({
          step: "Duplicate Check",
          error,
          details: { pluginId, debugUrl },
        });
        return NextResponse.json({ error, debugUrl }, { status: 400 });
      }

      // 7. Validate and Process Spec
      let spec;
      try {
        spec = await sanitizeSpec(rawSpec);
      } catch (e: unknown) {
        const error = `Failed to sanitize plugin spec: ${errorString(e)}`;
        logError({
          step: "Spec Sanitization",
          error,
        });
        return NextResponse.json({ error }, { status: 400 });
      }

      // 8. Create Plugin Tools
      let pluginTools;
      try {
        pluginTools = createPluginToolsFromOpenAPISpec({ spec, pluginId }).map(
          (tool) => ({
            ...tool,
            function: tool.function as unknown as Prisma.InputJsonValue,
          })
        );
      } catch (e: unknown) {
        const error = `Failed to create plugin tools: ${errorString(e)}`;
        logError({
          step: "Tool Creation",
          error,
        });
        return NextResponse.json({ error }, { status: 400 });
      }

      // 9. Generate Assistant Definition
      const assistantDefinition =
        spec["x-mb"].assistant ||
        (await generateAssistantFromOpenAPISpec({ spec }));

      if (!assistantDefinition) {
        const error = "Failed to get or generate assistant definition";
        logError({
          step: "Assistant Definition",
          error,
          details: { spec: spec["x-mb"] },
        });
        return NextResponse.json({ error }, { status: 400 });
      }

      // 10. Process Account ID
      const accountId = spec["x-mb"]?.["account-id"];
      if (!accountId) {
        console.log("Missing accountId in plugin spec or bitte-api-key");
      }

      // 12. Create Assistant Config
      const agent: Agent = {
        id: pluginId,
        keyId,
        email: null, // FIXME: always null?
        name: assistantDefinition.name || spec.info.title || "",
        accountId: accountId || null,
        description:
          assistantDefinition.description || spec.info.description || "",
        instructions:
          assistantDefinition.instructions || spec.info.description || "",
        image: assistantDefinition.image || null,
        categories: assistantDefinition.categories || [],
        repo: assistantDefinition.repo || null,
        verified: false,
        chainIds: assistantDefinition.chainIds?.map((cid) => BigInt(cid)) || [],
      };

      // 13. Prepare and Execute Batch Write
      try {
        await prismaClient.$transaction([
          prismaClient.plugin.create({
            data: transformPlugin(pluginId, spec),
          }),
          prismaClient.agent.create({ data: agent }),
          prismaClient.tool.createMany({ data: pluginTools }),
        ]);
      } catch (err) {
        const error = `Failed to write plugin data to database: ${err}`;
        logError({
          step: "Database Write",
          error,
        });
        return NextResponse.json({ error }, { status: 500 });
      }

      // Success
      return NextResponse.json({ debugUrl }, { status: 201 });
    } catch (e) {
      const error = errorString(e);
      logError({
        step: "Unhandled Exception",
        error,
        details: { stack: e instanceof Error ? e.stack : undefined },
      });
      return NextResponse.json(
        { error: `Error registering plugin: ${error}` },
        { status: 500 }
      );
    }
  },
  unkeyConfig
);

export const PUT = withUnkey(
  async (req: NextRequestWithUnkeyContext, context: NextContext) => {
    try {
      const urlParam = (await context.params)["pluginIds"]?.[0];
      if (!urlParam) {
        return NextResponse.json(
          {
            error:
              "Missing pluginId in request params i.e. /api/ai-plugins/[pluginId]",
          },
          { status: 400 }
        );
      }

      const processIdResult = processPluginId(urlParam);
      const pluginId = processIdResult.pluginId;

      if (!pluginId) {
        return NextResponse.json(
          { error: processIdResult.error || "Invalid plugin URL" },
          { status: 400 }
        );
      }

      const rawSpec = await fetchRawSpec(pluginId, OPEN_API_SPEC_PATH);

      if (!rawSpec) {
        return NextResponse.json(
          {
            error: `Plugin spec not found at https://${pluginId}/${OPEN_API_SPEC_PATH}`,
          },
          { status: 400 }
        );
      }

      const { valid, code, keyId } = req.unkey || {};
      if (!valid || !keyId) {
        return new NextResponse(code || "UNKNOWN_AUTH_ERROR", {
          status: 403,
          headers: ALLOW_EXTERNAL_REQUEST_HEADERS,
        });
      }

      const existingAssistant = await getAgent(pluginId);

      if (!existingAssistant) {
        return NextResponse.json(
          { error: "Plugin not found. Please register the plugin first." },
          { status: 404 }
        );
      }

      if (existingAssistant.keyId !== keyId) {
        return NextResponse.json(
          { error: "Invalid API key. Please use a valid API key." },
          { status: 403 }
        );
      }

      // Validate and sanitize the spec
      const plugin = await sanitizeSpec(rawSpec);
      const pluginTools = createPluginToolsFromOpenAPISpec({
        spec: plugin,
        pluginId,
      }).map((tool) => ({
        ...tool,
        function: tool.function as unknown as Prisma.InputJsonValue,
      }));

      const assistantDefinition =
        plugin["x-mb"].assistant ||
        (await generateAssistantFromOpenAPISpec({
          spec: plugin,
        }));

      const accountId = plugin["x-mb"]?.["account-id"];
      if (!assistantDefinition) {
        return NextResponse.json(
          {
            error: `Failed to get or generate assistant definition`,
          },
          { status: 400 }
        );
      }

      // Match tools with primitives for full function definitions
      const agent: Agent = {
        id: pluginId,
        name: assistantDefinition.name || plugin.info.title || "",
        accountId: accountId || null,
        email: null, // FIXME: always null?
        keyId,
        description:
          assistantDefinition.description || plugin.info.description || "",
        instructions:
          assistantDefinition.instructions || plugin.info.description || "",
        image: assistantDefinition.image || null,
        verified: existingAssistant.verified,
        chainIds: assistantDefinition.chainIds?.map((cid) => BigInt(cid)) || [],
        ...(existingAssistant?.categories && {
          categories: existingAssistant.categories,
        }),
        repo: existingAssistant.repo || null,
      };

      try {
        // TODO: update using data package functions?
        await prismaClient.$transaction([
          prismaClient.plugin.update({
            where: { id: pluginId },
            data: transformPlugin(pluginId, plugin),
          }),
          prismaClient.agent.update({ where: { id: pluginId }, data: agent }),
          ...pluginTools.map((tool) =>
            prismaClient.tool.upsert({
              where: { id: tool.id },
              update: tool,
              create: tool,
            })
          ),
        ]);
      } catch (error) {
        console.error(error);
        return NextResponse.json({ error }, { status: 500 });
      }

      const debugUrl = `${getBaseUrl(
        req
      )}/smart-actions/prompt/how%20can%20you%20assist%20me%3F?mode=debug&agentId=${pluginId}`;

      return NextResponse.json(
        {
          message: "Plugin updated successfully",
          debugUrl,
        },
        { status: 200 }
      );
    } catch (e) {
      const error = errorString(e);
      return NextResponse.json(
        { error: `Error updating plugin: ${error}` },
        { status: 500 }
      );
    }
  },
  unkeyConfig
);

// DELETE PLUGIN
export const DELETE = withUnkey(
  async (req: NextRequestWithUnkeyContext, context: NextContext) => {
    try {
      const urlParam = (await context.params)["pluginIds"]?.[0];
      if (!urlParam) {
        return NextResponse.json(
          {
            error:
              "Missing pluginId in request params i.e. /api/ai-plugins/[pluginId]",
          },
          { status: 400 }
        );
      }
      const processIdResult = processPluginId(urlParam);

      const pluginId = processIdResult.pluginId;
      if (!pluginId) {
        return NextResponse.json(
          { error: processIdResult.error || "Invalid plugin URL" },
          { status: 400 }
        );
      }

      const { valid, code, keyId } = req.unkey || {};
      if (!valid || !keyId) {
        return new NextResponse(code || "UNKNOWN_AUTH_ERROR", {
          status: 403,
          headers: ALLOW_EXTERNAL_REQUEST_HEADERS,
        });
      }

      const [existingPlugin, existingAgent] = await Promise.all([
        getPlugin(pluginId),
        getAgent(pluginId),
      ]);

      if (!existingPlugin) {
        return NextResponse.json(
          { error: "No plugin found for this URL" },
          { status: 400 }
        );
      }

      if (!existingAgent?.keyId) {
        return NextResponse.json(
          {
            error:
              "Old plugin error: update make-agent and get an api key to manage this plugin",
          },
          { status: 400 }
        );
      }

      if (existingAgent.keyId !== keyId) {
        return NextResponse.json(
          { error: "Invalid API key. Please use a valid API key." },
          { status: 403 }
        );
      }

      try {
        await prismaClient.$transaction([
          prismaClient.agent.delete({ where: { id: pluginId } }),
          prismaClient.plugin.delete({ where: { id: pluginId } }),
          prismaClient.tool.deleteMany({ where: { agentId: pluginId } }),
        ]);
      } catch (error) {
        console.error(`Failed to destroy plugin ${pluginId}:`, error);
        return NextResponse.json({ error }, { status: 500 });
      }

      return NextResponse.json({ message: "Plugin deleted successfully" });
    } catch (e) {
      return NextResponse.json(
        { error: "Error deleting plugin", e },
        { status: 500 }
      );
    }
  },
  unkeyConfig
);

// converts pluginUrl to pluginId
const processPluginId = (
  urlParam: string | null
): { pluginId?: string; error?: string } => {
  if (!urlParam) {
    return {
      error: "Missing pluginId in URL i.e.  /api/ai-plugins/[pluginId]",
    };
  }

  if (urlParam === "{pluginId}") {
    return {
      error: "Missing pluginId, found placeholder {pluginId}",
    };
  }

  if (urlParam.startsWith("http://")) {
    return { error: "Plugin URL must use HTTPS" };
  }

  try {
    const urlWithProtocol = urlParam.startsWith("https://")
      ? urlParam
      : `https://${urlParam}`;

    const url = new URL(urlWithProtocol);
    const pluginId = url.hostname + url.pathname.replace(/\/$/, ""); // remove trailing slash

    return { pluginId };
  } catch (error) {
    return { error: `Invalid pluginId provided: ${error}` };
  }
};

const fetchRawSpec = async (
  pluginId: string,
  specPath: string,
  maxAttempts = 2
): Promise<BitteOpenAPISpec | null> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`https://${pluginId}/${specPath}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxAttempts - 1) {
        return null;
      }
    }
  }
  return null;
};

const sanitizeSpec = async (
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
            item !== "" &&
            (typeof item !== "object" || Object.keys(item).length > 0)
        );

      // Convert nested arrays to objects
      return sanitizedArray.map((item, index) =>
        Array.isArray(item) ? { [`item_${index}`]: item } : item
      );
    } else if (typeof value === "object" && value !== null) {
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
      return value === "" || value === null || value === undefined
        ? null
        : value;
    }
  };

  return sanitize(validatedSpec);
};


const transformPlugin = (id: string, spec: BitteOpenAPISpec) => {
  const transformed = {
    id,
    openapi: spec.openapi,
    info: spec.info as object,
    servers: spec.servers!.map((s) => s.url),
    paths: spec.paths as object,
    components: spec.components as object,
    security: spec.security,
    tags: spec.tags as object[],
    externalDocs: spec.externalDocs as object,
    extra: {},
  };

  Object.entries(spec).forEach(([k, v]) => {
    if (!Object.keys(transformed).includes(k)) {
      (transformed.extra as Record<string, unknown>)[k] = v;
    }
  });

  return transformed;
};

const createPluginToolsFromOpenAPISpec = ({
  spec,
  pluginId,
}: {
  spec: BitteOpenAPISpec;
  pluginId: string;
}): PluginToolSpec[] => {
  const apiUrl =
    spec.servers?.[0].url.replace("https://", "").replace(/\/$/, "") ||
    pluginId;

  if (!apiUrl) {
    throw new Error("apiUrl not found in OpenAPI spec");
  }

  const tools: PluginToolSpec[] = [];

  if (!spec.paths) {
    throw new Error("Paths not found in OpenAPI spec");
  }

  for (const [path, pathDetails] of Object.entries(spec.paths)) {
    if (!pathDetails) {
      continue;
    }
    for (const [httpMethod, methodDetails] of Object.entries(pathDetails)) {
      if (typeof methodDetails === "string" || Array.isArray(methodDetails)) {
        throw new Error("Invalid method details in OpenAPI spec");
      }
      const functionName = methodDetails?.operationId;
      if (!functionName) {
        throw new Error(
          "OperationId/functionName must be defined for each operation"
        );
      }

      const parameters = methodDetails.parameters?.reduce(
        (
          acc: { [key: string]: { type: string; description: string } },
          param
        ) => {
          if (
            "name" in param &&
            param.schema &&
            "type" in param.schema &&
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
        type: "function",
        function: {
          name: functionName,
          description: methodDetails.description || undefined,
          parameters:
            parameters && Object.keys(parameters).length > 0
              ? {
                  type: "object",
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
