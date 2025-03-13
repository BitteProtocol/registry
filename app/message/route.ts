import { NextRequest } from "next/server";
import { createClient } from "redis";

// Configure route to be dynamic
export const dynamic = 'force-dynamic';

// Handler for POST requests to send messages to SSE clients
export async function POST(request: NextRequest) {
  console.log("Message POST received");
  
  try {
    // Get the message data
    const data = await request.json();
    console.log("Message data:", data);
    
    // Validate required fields
    if (!data.sessionId) {
      console.error("Missing sessionId in message request");
      return new Response(JSON.stringify({ error: "Missing sessionId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Get Redis URL from environment
    const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
    if (!redisUrl) {
      console.error("No Redis URL available for message endpoint");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Create Redis client
    console.log("Creating Redis client for message endpoint");
    const redisPublisher = createClient({ url: redisUrl });
    
    // Connect to Redis
    console.log("Connecting to Redis for message endpoint");
    await redisPublisher.connect();
    console.log("Redis connected for message endpoint");
    
    // Publish message to the events channel for the session
    const sessionId = data.sessionId;
    console.log(`Publishing message to events:${sessionId}`);
    
    // Create the event message
    const eventMessage = JSON.stringify({
      type: data.type || "message",
      data: data.data || data,
      timestamp: Date.now()
    });
    
    // Publish to Redis
    await redisPublisher.publish(`events:${sessionId}`, eventMessage);
    console.log(`Message published to events:${sessionId}`);
    
    // Disconnect from Redis
    await redisPublisher.disconnect();
    console.log("Redis disconnected after message publish");
    
    // Return success response
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("Error in message endpoint:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
