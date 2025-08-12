import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { listAgentsFiltered, createAgent, Agent } from "@bitte-ai/data";
import { stringifyJsonWithBigint } from "@/lib/utils";

type AgentWithPings = Agent & { pings: number };

const getTotalPingsByAgentIds = async (
  agentIds: string[]
): Promise<Record<string, number | null>> => {
  if (agentIds.length === 0) {
    return {};
  }

  const pipeline = kv.pipeline();
  agentIds.forEach((id) => {
    pipeline.get<number>(`smart-action:v1.0:agent:${id}:pings`);
  });

  const values = await pipeline.exec<number[]>();

  return agentIds.reduce((acc, id, index) => {
    acc[id] = values[index];
    return acc;
  }, {} as Record<string, number | null>);
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainIds = searchParams.get("chainIds")?.split(",");
    const limit = parseInt(searchParams.get("limit") || "20000");
    const offset = parseInt(searchParams.get("offset") || "0");
    const verifiedOnlyParam = searchParams.get("verifiedOnly");
    const verifiedOnly = verifiedOnlyParam
      ? verifiedOnlyParam !== "false"
      : undefined;
    const category = searchParams.get("category") || undefined;
    const accountId = searchParams.get("accountId") || undefined;
    const searchTerm = searchParams.get("searchTerm") || undefined;

    // When verifiedOnly is false, we need to fetch all agents first to sort by pings properly
    // before applying pagination. Otherwise, we paginate before sorting which gives wrong results.
    const shouldSortByPings = verifiedOnly === false;

    const agents = await listAgentsFiltered({
      searchTerm,
      verified: verifiedOnly,
      chainIds,
      offset: shouldSortByPings ? 0 : offset,
      limit: shouldSortByPings ? 20000 : limit, // Get all agents when we need to sort by pings
      categories: category ? [category] : undefined,
      accountId,
    });

    if (agents.length === 0) {
      const response = NextResponse.json(agents, { status: 200 });
      response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=120');
      return response;
    }

    const agentIds = agents.map((agent: Agent) => agent.id);
    const pingsByAgent = await getTotalPingsByAgentIds(agentIds);

    const agentsWithPings: AgentWithPings[] = agents.map((agent: Agent) => ({
      ...agent,
      pings: pingsByAgent[agent.id] || 0,
    }));

    let finalAgents = agentsWithPings;

    // Sort by pings when verifiedOnly is false
    if (shouldSortByPings) {
      const sortedAgents = agentsWithPings.sort(
        (a: AgentWithPings, b: AgentWithPings) => b.pings - a.pings
      );

      // Apply pagination after sorting
      finalAgents = sortedAgents.slice(offset, offset + limit);
    }

    const result = JSON.parse(stringifyJsonWithBigint(finalAgents));

    const response = NextResponse.json(result);
    // Add cache headers for browser/CDN caching
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=120');
    response.headers.set('Vary', 'Accept-Encoding');

    return response;
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const newAgent: Agent = {
      ...body,
      verified: false,
      id: crypto.randomUUID(),
    };

    const requiredFields = [
      "name",
      "accountId",
      "description",
      "instructions",
      "tools",
      "primitives",
      "image",
      "generatedDescription",
    ];
    const missingFields = requiredFields.filter(
      (field) => !(field in newAgent)
    );

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    await createAgent(newAgent);

    return NextResponse.json(JSON.parse(stringifyJsonWithBigint(newAgent)), {
      status: 201,
    });
  } catch (error) {
    console.error("Error creating agent:", error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
