import { listTools } from "@bitte-ai/data";
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { BittePrimitiveNames } from "@/lib/constants";
import { FunctionDefinition } from "openai/resources/shared.mjs";

const getPingsByTool = async (toolName: string): Promise<number | null> => {
  return await kv.get<number>(`smart-action:v1.0:tool:${toolName}:pings`);
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const agentId = (await params).agentId;

    // Get all tools and filter by agentId
    const allTools = await listTools();
    const tools = allTools.filter((tool) => tool.agentId === agentId);

    if (tools.length === 0) {
      return NextResponse.json([]);
    }

    // Add isPrimitive flag to each tool
    const toolsWithPrimitiveFlags = tools.map((tool) => ({
      ...tool,
      isPrimitive: BittePrimitiveNames.includes(tool.id),
    }));

    // Add pings data to each tool
    const toolsWithPings = await Promise.all(
      toolsWithPrimitiveFlags.map(async (tool) => {
        const pings = await getPingsByTool(
          (tool.function as unknown as FunctionDefinition).name
        );
        return {
          ...tool,
          pings: pings || 0,
        };
      })
    );

    // Sort by pings (most pinged first)
    const sortedTools = toolsWithPings.sort((a, b) => b.pings - a.pings);

    return NextResponse.json(sortedTools);
  } catch (error) {
    console.error("Error fetching agent tools:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent tools" },
      { status: 500 }
    );
  }
}
