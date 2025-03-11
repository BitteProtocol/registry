import { NextRequest } from "next/server";
import { z } from "zod";
import { initializeMcpApiHandler, createNextJsAdapter } from "@/lib/mcp-api-handler-next";

const mcpHandler = initializeMcpApiHandler(
  (server) => {
    // Add more tools, resources, and prompts here
    server.tool("echo", { message: z.string() }, async ({ message }) => ({
      content: [{ type: "text", text: `Tool echo: ${message}` }],
    }));
  },
  {
    capabilities: {
      tools: {
        echo: {
          description: "Echo a message",
        },
      },
    },
  }
);

// Create a Next.js-compatible handler using our adapter
const nextApiHandler = createNextJsAdapter(mcpHandler);

export async function POST(request: NextRequest) {
  return nextApiHandler(request);
}

export async function GET(request: NextRequest) {
  return nextApiHandler(request);
}
