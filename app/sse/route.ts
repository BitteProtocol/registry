import { NextRequest } from "next/server";
import { nextApiHandler } from "@/lib/mcp-handler";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient } from "redis";
import crypto from "crypto";

// Configure route to handle streaming responses
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  console.log("POST request received");
  return nextApiHandler(request);
}

export async function GET(request: NextRequest) {
  console.log("GET SSE request received");
  
  // If this is an SSE request, handle it with direct streaming
  if (request.headers.get("accept") === "text/event-stream") {
    return createSseStream(request);
  }
  
  // Otherwise use the regular handler
  return nextApiHandler(request);
}

async function createSseStream(request: NextRequest) {
  console.log("Creating direct SSE stream");
  
  const encoder = new TextEncoder();
  const sessionId = crypto.randomUUID();
  console.log(`Created session ID for direct SSE stream: ${sessionId}`);
  
  // Get Redis URL from environment
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  if (!redisUrl) {
    console.error("No Redis URL available for SSE stream");
    return new Response("Configuration error: No Redis connection available", { status: 500 });
  }
  
  // Create Redis clients
  let redisSubscriber;
  let redisPublisher;
  
  try {
    console.log("Creating Redis clients for SSE stream");
    redisSubscriber = createClient({ url: redisUrl });
    redisPublisher = createClient({ url: redisUrl });
    
    // Connect to Redis
    console.log("Connecting to Redis for SSE stream");
    await Promise.all([
      redisSubscriber.connect(),
      redisPublisher.connect()
    ]);
    console.log("Redis connected for SSE stream");
  } catch (error) {
    console.error("Failed to connect to Redis for SSE:", error);
    return new Response("Failed to establish server connection", { status: 500 });
  }
  
  // Create a stream with a custom controller we can write to
  const stream = new ReadableStream({
    start(controller) {
      console.log("SSE stream started");
      
      // Function to send SSE formatted messages
      const sendMessage = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };
      
      // Send initial connection message with session ID
      sendMessage(JSON.stringify({ 
        type: "connection", 
        status: "established",
        sessionId 
      }));
      
      // Set up Redis subscriber
      const setupRedisSubscription = async () => {
        try {
          console.log(`Subscribing to Redis channel events:${sessionId}`);
          
          // Subscribe to events channel for this session
          await redisSubscriber.subscribe(`events:${sessionId}`, (message) => {
            console.log(`Received event for session ${sessionId}:`, message);
            sendMessage(message);
          });
          
          // Publish the connection event
          console.log(`Publishing connection event for session ${sessionId}`);
          await redisPublisher.publish(
            `session:${sessionId}`,
            JSON.stringify({ 
              type: "client_connected", 
              sessionId,
              timestamp: Date.now() 
            })
          );
          
          console.log(`Redis subscription established for session ${sessionId}`);
        } catch (error) {
          console.error(`Redis subscription error for session ${sessionId}:`, error);
          sendMessage(JSON.stringify({ 
            type: "error", 
            message: "Failed to establish subscription",
            error: String(error)
          }));
        }
      };
      
      // Set up the subscription
      setupRedisSubscription();
      
      // Set up keep-alive interval
      const keepAlive = setInterval(() => {
        sendMessage(JSON.stringify({ type: "ping", timestamp: Date.now() }));
      }, 30000);
      
      // Store references in request object for cleanup
      (request as any).sseCleanup = async () => {
        console.log(`Cleaning up SSE resources for session ${sessionId}`);
        clearInterval(keepAlive);
        
        try {
          // Unsubscribe and publish disconnection event
          console.log(`Unsubscribing from events:${sessionId}`);
          await redisSubscriber.unsubscribe(`events:${sessionId}`);
          
          console.log(`Publishing disconnection event for session ${sessionId}`);
          await redisPublisher.publish(
            `session:${sessionId}`,
            JSON.stringify({ 
              type: "client_disconnected", 
              sessionId,
              timestamp: Date.now() 
            })
          );
          
          // Disconnect Redis clients
          await Promise.all([
            redisSubscriber.disconnect(),
            redisPublisher.disconnect()
          ]);
          console.log(`Redis clients disconnected for session ${sessionId}`);
        } catch (cleanupError) {
          console.error(`Error during SSE cleanup for session ${sessionId}:`, cleanupError);
        }
      };
      
      // Handle stream closing
      request.signal.addEventListener("abort", () => {
        console.log(`SSE request aborted for session ${sessionId}`);
        (request as any).sseCleanup();
      });
    },
    async cancel() {
      console.log(`SSE stream cancelled for session ${sessionId}`);
      if ((request as any).sseCleanup) {
        await (request as any).sseCleanup();
      }
    }
  });

  console.log("SSE stream created");
  
  // Return a Response with the appropriate headers for SSE
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
