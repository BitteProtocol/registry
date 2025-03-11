import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log("POST request received", body);
  return new Response("POST Hello, world!");
}

export async function GET(request: NextRequest) {
  return new Response("GET Hello, world!");
}
