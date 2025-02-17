import { read } from "@/lib/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { Agent } from "@/lib/types";
import { NextResponse } from "next/server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {

  try {
    const agentId = (await params).agentId;
    const agent = await read<Agent>(COLLECTIONS.AGENTS, agentId);
    
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