import { Agent } from "@/lib/types";
import { NextRequest, NextResponse } from "next/server";
import { write, readAll } from "@/lib/firestore";
import { COLLECTIONS } from "@/lib/constants";

export async function GET(
) {
  try {
    const agents = await readAll<Agent>(COLLECTIONS.AGENTS);
    return NextResponse.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const body = await request.json();
    
    const newAgent: Agent = {
      ...body,
      verified: false,
      id: crypto.randomUUID(),
    };

    const requiredFields = ['name', 'accountId', 'description', 'instructions', 'tools', 'image', 'repo', 'generatedDescription'];
    const missingFields = requiredFields.filter(field => !(field in newAgent));
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await write(COLLECTIONS.AGENTS, newAgent.id, newAgent);

    if (!result.success) {
      throw result.error;
    }

    return NextResponse.json(newAgent, { status: 201 });
    
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
