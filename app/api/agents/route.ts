import { NextRequest, NextResponse } from "next/server";
import { queryAgents } from "@/lib/firestore";
import { kv } from "@vercel/kv";
import { listAgents, createAgent, Agent } from "@bitte-ai/data";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainIds = searchParams.get("chainIds")?.split(",");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const verifiedOnly = searchParams.get("verifiedOnly") !== "false";
    const category = searchParams.get("category") || undefined;

    // TODO: remove firestore after migration
    const firestoreAgents = await queryAgents({
      verified: verifiedOnly,
      chainIds,
      offset,
      limit,
      category: category === "" ? undefined : category,
    });
    // FIXME: wait for version that is camel case
    const sqlAgents = await listAgents();
    const agents = [...firestoreAgents, ...sqlAgents];

    const agentIds = agents.map((agent) => agent.id);
    const pingsByAgent = await getTotalPingsByAgentIds(agentIds);

    const agentsWithPings = agents.map((agent) => ({
      ...agent,
      pings: pingsByAgent[agent.id] || 0,
    }));

    const sortedAgents = agentsWithPings.sort(
      (a, b) => (b.pings as number) - (a.pings as number)
    );

    return NextResponse.json(sortedAgents);
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

    return NextResponse.json(newAgent, { status: 201 });
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
