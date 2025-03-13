import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const origin = "http://localhost:3000";

async function main() {
  console.log("Starting MCP test client...");
  try {
    console.log("Creating SSE transport...");
    const transport = new SSEClientTransport(
      new URL(`${origin}/sse`),
      new URL(`${origin}/message`)
    );
    console.log("SSE transport created");

    console.log("Creating MCP client...");
    const client = new Client(
      {
        name: "test-client",
        version: "1.0.0",
      },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {},
        },
      }
    );
    console.log("MCP client created");

    console.log("Connecting to server...");
    await client.connect(transport);
    console.log("Connected to server!");

    // Get server capabilities
    const capabilities = client.getServerCapabilities();
    console.log("Server capabilities:", JSON.stringify(capabilities, null, 2));

    // List available tools
    console.log("Listing tools...");
    const tools = await client.listTools();
    console.log("Available tools:", JSON.stringify(tools, null, 2));

    // Test the echo tool
    console.log("Testing echo tool...");
    const result = await client.callTool("echo", { message: "Hello, MCP!" });
    console.log("Echo result:", JSON.stringify(result, null, 2));

    // Test the simple test tool
    console.log("Testing simple test tool...");
    const testResult = await client.callTool("test", {});
    console.log("Test tool result:", JSON.stringify(testResult, null, 2));

    console.log("Test completed successfully");
  } catch (error) {
    console.error("Error in MCP test client:", error);
  }
}

main(); 