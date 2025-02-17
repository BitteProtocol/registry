import { read } from "@/lib/firestore";
import { NextResponse } from "next/server";
import { COLLECTIONS } from "@/lib/constants";
import { Agent } from "@/lib/types";

export async function GET(
  _request: Request,
  context: { params: { agentId: string } }
) {
  try {
    const agent = await read<Agent>(COLLECTIONS.AGENTS, context.params.agentId);
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}