import { getAgent } from "@bitte-ai/data";
import { NextResponse } from "next/server";
import { stringifyJsonWithBigint } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const agentId = (await params).agentId;
    const agent = await getAgent(agentId);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const serializedAgent = stringifyJsonWithBigint(agent);
    return new NextResponse(serializedAgent, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error fetching agent:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent" },
      { status: 500 }
    );
  }
}
