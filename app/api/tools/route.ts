import { queryTools } from "@/lib/firestore";
import { NextRequest, NextResponse } from "next/server";
import { Tool } from "@/lib/types";
import { kv } from "@vercel/kv";
import { BittePrimitiveNames } from "@/lib/constants";

const getPingsByTool = async (toolName: string): Promise<number | null> => {
  return await kv.get<number>(`smart-action:v1.0:tool:${toolName}:pings`);
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const functionName = searchParams.get("function");
  const verifiedOnly = searchParams.get("verifiedOnly") !== "false";
  const offset = parseInt(searchParams.get("offset") || "0");
  const chainId = searchParams.get("chainId");

  try {
    const tools = await queryTools<Tool>({
      verified: verifiedOnly,
      functionName: functionName || undefined,
      offset,
      chainId: chainId || undefined,
    });

    const toolsWithPrimitiveFlags = tools.map((tool) => ({
      ...tool,
      isPrimitive: BittePrimitiveNames.includes(tool.function.name),
      image: BittePrimitiveNames.includes(tool.function.name)
        ? `/bitte-symbol-black.svg`
        : tool.image,
    }));

    const toolsWithPings = await Promise.all(
      toolsWithPrimitiveFlags.map(async (tool) => {
        const pings = await getPingsByTool(tool.function.name);
        return {
          ...tool,
          pings: pings || 0,
        };
      })
    );
    console.log(toolsWithPings);
    const sortedTools = toolsWithPings.sort((a, b) => b.pings - a.pings);

    return NextResponse.json(sortedTools);
  } catch (error) {
    console.error("Error fetching tools:", error);
    return NextResponse.json(
      { error: "Failed to fetch tools" },
      { status: 500 }
    );
  }
}
