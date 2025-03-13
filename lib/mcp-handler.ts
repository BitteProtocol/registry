import { z } from "zod";
import { initializeMcpApiHandler, createNextJsAdapter } from "./mcp-api-handler-next";

// Create a single instance of the MCP handler that will be shared across route handlers
export const mcpHandler = initializeMcpApiHandler(
  (server) => {
    // Add tools, resources, and prompts here
    server.tool("echo", { message: z.string() }, async ({ message }) => ({
      content: [{ type: "text", text: `Tool echo: ${message}` }],
    }));

    // Add a simpler test tool
    server.tool("test", {}, async () => ({
      content: [{ type: "text", text: "Test tool executed successfully" }],
    }));
  },
  {
    capabilities: {
      tools: {
        echo: {
          description: "Echo a message",
        },
        test: {
          description: "A simple test tool that takes no parameters",
        },
      },
    }
  }
);

// Create a Next.js-compatible handler using our adapter
export const nextApiHandler = createNextJsAdapter(mcpHandler); 