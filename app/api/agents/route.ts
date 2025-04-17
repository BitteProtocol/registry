import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { listAgentsFiltered, createAgent, Agent } from "@bitte-ai/data";
import { stringifyJsonWithBigint } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainIds = searchParams.get("chainIds")?.split(",");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const verifiedOnlyParam = searchParams.get("verifiedOnly");
    const verifiedOnly = verifiedOnlyParam
      ? verifiedOnlyParam !== "false"
      : undefined;
    const category = searchParams.get("category") || undefined;

    const agents = await listAgentsFiltered({
      verified: verifiedOnly,
      chainIds,
      offset,
      limit,
      categories: category ? [category] : undefined,
    });

    if (agents.length === 0) {
      return NextResponse.json(agents, { status: 200 });
    }

    const agentIds = agents.map((agent) => agent.id);
    const pingsByAgent = await getTotalPingsByAgentIds(agentIds);

    const agentsWithPings = agents.map((agent) => ({
      ...agent,
      pings: pingsByAgent[agent.id] || 0,
    }));

    const sortedAgents = agentsWithPings.sort(
      (a, b) => (b.pings as number) - (a.pings as number)
    );

    return NextResponse.json(JSON.parse(stringifyJsonWithBigint(sortedAgents)));
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
