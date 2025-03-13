/**
 * MCP API Handler for Next.js
 * 
 * This file provides a server implementation for the Model Context Protocol (MCP)
 * using Redis for communication between serverless functions.
 */

import getRawBody from "raw-body";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "http";
import { createClient } from "redis";
import { Socket } from "net";
import { Readable } from "stream";
import { ServerOptions } from "@modelcontextprotocol/sdk/server/index.js";
import vercelJson from "../vercel.json";

// =================== INTERFACES AND TYPES ===================

/**
 * Represents a serialized HTTP request that can be passed through Redis
 */
interface SerializedRequest {
  requestId: string;
  url: string;
  method: string;
  body: string;
  headers: IncomingHttpHeaders;
}

/**
 * Represents a serialized HTTP response that can be passed through Redis
 */
interface SerializedResponse {
  status: number;
  body: string;
}

/**
 * Options for creating a fake IncomingMessage
 */
interface FakeIncomingMessageOptions {
  method?: string;
  url?: string;
  headers?: IncomingHttpHeaders;
  body?: string | Buffer | Record<string, any> | null;
  socket?: Socket;
}

/**
 * Configuration for Redis connection
 */
interface RedisConfig {
  redisUrl: string;
  client: any; // Using any to avoid complex Redis typing issues
  publisher: any; // Using any to avoid complex Redis typing issues
}

/**
 * Logger with contextual information
 */
interface ContextualLogger {
  log: (...messages: string[]) => void;
  error: (...messages: string[]) => void;
  clearInterval: () => void;
}

// =================== UTILITY FUNCTIONS ===================

/**
 * Creates a fake IncomingMessage for testing or simulation purposes
 */
function createFakeIncomingMessage(
  options: FakeIncomingMessageOptions = {}
): IncomingMessage {
  console.log("Creating fake IncomingMessage with options:", JSON.stringify(options));
  const {
    method = "GET",
    url = "/",
    headers = {},
    body = null,
    socket = new Socket(),
  } = options;

  // Create a readable stream that will be used as the base for IncomingMessage
  const readable = new Readable();
  readable._read = (): void => {}; // Required implementation

  // Add the body content if provided
  if (body) {
    console.log("Adding body to fake IncomingMessage:", typeof body);
    if (typeof body === "string") {
      readable.push(body);
    } else if (Buffer.isBuffer(body)) {
      readable.push(body);
    } else {
      readable.push(JSON.stringify(body));
    }
    readable.push(null); // Signal the end of the stream
  }

  // Create the IncomingMessage instance
  const req = new IncomingMessage(socket);
  console.log("Created IncomingMessage instance");

  // Set the properties
  req.method = method;
  req.url = url;
  req.headers = headers;

  // Create wrapper methods that maintain the correct 'this' context and return type
  req.push = function(chunk: any, encoding?: BufferEncoding) {
    console.log("push called on fake IncomingMessage");
    return readable.push(chunk, encoding);
  };
  
  req.read = function(size?: number) {
    console.log("read called on fake IncomingMessage");
    return readable.read(size);
  };
  
  req.on = function(event: string, listener: (...args: any[]) => void) {
    console.log(`Event listener attached to fake IncomingMessage: ${event}`);
    readable.on(event, listener);
    return this;
  };
  
  req.pipe = function<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean }): T {
    console.log("pipe called on fake IncomingMessage");
    return readable.pipe(destination, options);
  };

  console.log("Fake IncomingMessage created successfully");
  return req;
}

/**
 * Creates a contextual logger that can be used across different scopes
 */
function createContextualLogger(): ContextualLogger {
  console.log("Creating contextual logger");
  let logs: { type: "log" | "error"; messages: string[] }[] = [];
  
  const interval = setInterval(() => {
    if (logs.length > 0) {
      console.log(`Processing ${logs.length} buffered logs`);
      for (const log of logs) {
        console[log.type].call(console, ...log.messages);
      }
      logs = [];
    }
  }, 100);
  
  const logger: ContextualLogger = {
    log: (...messages: string[]) => {
      logs.push({ type: "log", messages });
    },
    error: (...messages: string[]) => {
      logs.push({ type: "error", messages });
    },
    clearInterval: () => {
      console.log("Clearing logger interval");
      clearInterval(interval);
    }
  };
  
  console.log("Contextual logger created");
  return logger;
}

/**
 * Initializes Redis clients for pub/sub communication
 */
async function setupRedisClients(redisUrl: string): Promise<RedisConfig> {
  console.log("Setting up Redis clients with URL:", redisUrl);
  if (!redisUrl) {
    console.error("Redis URL is not provided");
    throw new Error("Redis URL is not provided");
  }

  console.log("Creating Redis client instances");
  const client = createClient({ url: redisUrl });
  const publisher = createClient({ url: redisUrl });

  client.on("error", (err: Error) => console.error("Redis client error:", err));
  publisher.on("error", (err: Error) => console.error("Redis publisher error:", err));

  try {
    console.log("Attempting to connect to Redis");
    await Promise.all([client.connect(), publisher.connect()]);
    console.log("Redis connections established successfully");
    
    return { redisUrl, client, publisher };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to connect to Redis:", error);
    throw new Error(`Redis connection failed: ${errorMessage}`);
  }
}

// =================== MAIN MCP API HANDLER ===================

/**
 * Initializes an MCP API handler for Next.js
 * 
 * @param initializeServer Function to initialize the MCP server
 * @param serverOptions Options for the MCP server
 * @returns An API handler function for handling MCP requests
 */
export function initializeMcpApiHandler(
  initializeServer: (server: McpServer) => void,
  serverOptions: ServerOptions = {}
) {
  console.log("Initializing MCP API handler with options:", JSON.stringify(serverOptions));
  // Get max duration from vercel.json or default to 800 seconds
  const maxDuration = 
    vercelJson?.functions?.["api/server.ts"]?.maxDuration || 800;
  console.log(`Max duration set to ${maxDuration} seconds`);

  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  console.log("Redis URL from environment:", redisUrl);
  
  if (!redisUrl) {
    console.error("REDIS_URL environment variable is not set");
    throw new Error("REDIS_URL environment variable is not set");
  }
  
  // Initialize Redis clients
  let redisPromise: Promise<RedisConfig>;
  let redisConfig: RedisConfig;

  // Initialize the promise but don't await it yet
  console.log("Creating Redis setup promise");
  redisPromise = setupRedisClients(redisUrl).then(config => {
    console.log("Redis setup completed");
    redisConfig = config;
    return config;
  });
  
  // Keep track of active servers
  let activeServers: McpServer[] = [];
  console.log("Active servers array initialized");

  /**
   * Handles the SSE endpoint for long-lived connections
   */
  async function handleSseConnection(
    req: IncomingMessage, 
    res: ServerResponse, 
    redis: RedisConfig
  ) {
    console.log("Got new SSE connection");
    
    // Create SSE transport
    console.log("Creating SSE transport");
    const transport = new SSEServerTransport("/message", res);
    const sessionId = transport.sessionId;
    console.log(`Created SSE transport with session ID: ${sessionId}`);
    
    // Create and initialize MCP server
    console.log("Creating MCP server");
    const server = new McpServer(
      {
        name: "mcp-typescript server on vercel",
        version: "0.1.0",
      },
      serverOptions
    );
    
    console.log("Initializing server with provided function");
    initializeServer(server);
    activeServers.push(server);
    console.log(`Active servers count: ${activeServers.length}`);
    
    // Set up server close handler
    server.server.onclose = () => {
      console.log(`SSE connection closed for session: ${sessionId}`);
      activeServers = activeServers.filter((s) => s !== server);
      console.log(`Active servers count after removal: ${activeServers.length}`);
    };
    
    // Set up contextual logger
    const logger = createContextualLogger();
    console.log("Contextual logger set up for SSE connection");
    
    // Handler for messages from Redis
    const handleMessage = async (message: string) => {
      console.log(`Received message from Redis for session ${sessionId}:`, message);
      logger.log(`Received message from Redis for session ${sessionId}:`, message);
      
      try {
        console.log("Parsing received message");
        const request = JSON.parse(message) as SerializedRequest;
        console.log(`Parsed request with ID: ${request.requestId}`);
        
        // Create synthetic request and response objects
        console.log("Creating synthetic request and response objects");
        const req = createFakeIncomingMessage({
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: request.body,
        });
        
        const syntheticRes = new ServerResponse(req);
        let status = 100;
        let body = "";
        
        // Override response methods to capture status and body
        console.log("Overriding response methods");
        syntheticRes.writeHead = (statusCode: number) => {
          console.log(`Setting status code to ${statusCode}`);
          status = statusCode;
          return syntheticRes;
        };
        
        syntheticRes.end = (b: unknown) => {
          console.log(`Setting response body: ${typeof b === 'string' ? b : JSON.stringify(b)}`);
          body = b as string;
          return syntheticRes;
        };
        
        // Process the message with the transport
        console.log(`Processing message with transport for request ${request.requestId}`);
        await transport.handlePostMessage(req, syntheticRes);
        console.log(`Message processed for request ${request.requestId}`);
        
        // Publish response back to Redis
        console.log(`Publishing response to Redis for ${sessionId}:${request.requestId}`);
        await redis.publisher.publish(
          `responses:${sessionId}:${request.requestId}`,
          JSON.stringify({
            status,
            body,
          })
        );
        console.log(`Response published to Redis for ${sessionId}:${request.requestId}`);
        
        // Log the result
        if (status >= 200 && status < 300) {
          logger.log(
            `Request ${sessionId}:${request.requestId} succeeded: ${body}`
          );
        } else {
          logger.error(
            `Message for ${sessionId}:${request.requestId} failed with status ${status}: ${body}`
          );
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error processing message for session ${sessionId}:`, errorMessage);
        logger.error(`Error processing message: ${errorMessage}`);
        // Try to send an error response
        try {
          console.log(`Attempting to publish error response for ${sessionId}`);
          await redis.publisher.publish(
            `responses:${sessionId}:${JSON.parse(message).requestId}`,
            JSON.stringify({
              status: 500,
              body: `Internal server error: ${errorMessage}`,
            })
          );
          console.log("Error response published successfully");
        } catch (publishError: unknown) {
          const publishErrorMessage = publishError instanceof Error ? publishError.message : String(publishError);
          console.error(`Failed to publish error response: ${publishErrorMessage}`);
          logger.error(`Failed to publish error response: ${publishErrorMessage}`);
        }
      }
    };
    
    // Set up timeout for maximum duration
    console.log(`Setting up timeout for ${maxDuration} seconds`);
    let timeout: NodeJS.Timeout;
    let resolveTimeout: (value: unknown) => void;

    const waitPromise = new Promise((resolve) => {
      resolveTimeout = resolve;
      timeout = setTimeout(() => {
        console.log(`Max duration of ${maxDuration} seconds reached for session ${sessionId}`);
        resolve("max duration reached");
      }, (maxDuration - 5) * 1000);
    });
    
    // Clean up function to be called when connection ends
    async function cleanup() {
      console.log(`Starting cleanup for session ${sessionId}`);
      clearTimeout(timeout);
      logger.clearInterval();
      try {
        console.log(`Unsubscribing from Redis channel requests:${sessionId}`);
        await redis.client.unsubscribe(`requests:${sessionId}`, handleMessage);
        console.log("Unsubscribed from Redis channel");
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to unsubscribe for session ${sessionId}: ${errorMessage}`);
      }
      console.log(`Cleanup completed for session ${sessionId}`);
      res.statusCode = 200;
      res.end();
    }
    
    // Handle client disconnection
    console.log("Setting up client disconnection handler");
    req.on("close", () => {
      console.log(`Client disconnected for session ${sessionId}`);
      resolveTimeout("client hang up");
    });
    
    // Subscribe to Redis channel for this session
    try {
      console.log(`Attempting to subscribe to requests:${sessionId}`);
      await redis.client.subscribe(`requests:${sessionId}`, handleMessage);
      console.log(`Successfully subscribed to requests:${sessionId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to subscribe to requests:${sessionId}:`, error);
      console.log(`Redis connection status: ${redis.client.isOpen ? 'open' : 'closed'}`);
      res.statusCode = 500;
      res.end(`Failed to subscribe to Redis: ${errorMessage}`);
      return;
    }
    
    // Connect the server to the transport
    try {
      console.log(`Attempting to connect server to transport for session: ${sessionId}`);
      await server.connect(transport);
      console.log(`Server successfully connected to transport for session: ${sessionId}`);
      
      console.log(`Waiting for connection to close or timeout for session: ${sessionId}`);
      const closeReason = await waitPromise;
      console.log(`Connection closing: ${closeReason} for session: ${sessionId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Server connection error for session ${sessionId}: ${errorMessage}`);
      console.error(`Connection details: transport=${transport.constructor.name}`);
    } finally {
      console.log(`Entering cleanup phase for session: ${sessionId}`);
      await cleanup();
      console.log(`Cleanup completed for session: ${sessionId}`);
    }
  }
  
  /**
   * Handles the message endpoint for individual messages
   */
  async function handleMessageEndpoint(
    req: IncomingMessage, 
    res: ServerResponse, 
    redis: RedisConfig
  ) {
    console.log("Received message request");
    
    try {
      // Parse the request body
      console.log("Parsing request body");
      const body = await getRawBody(req, {
        length: req.headers["content-length"],
        encoding: "utf-8",
      });
      console.log("Request body parsed successfully:", body);
      
      // Get the session ID from the URL
      const url = new URL(req.url || "", "https://example.com");
      const sessionId = url.searchParams.get("sessionId") || "";
      console.log(`Session ID from URL: ${sessionId}`);
      
      if (!sessionId) {
        console.log("No sessionId provided, returning 400");
        res.statusCode = 400;
        res.end("No sessionId provided");
        return;
      }
      
      // Create a unique request ID
      const requestId = crypto.randomUUID();
      console.log(`Generated request ID: ${requestId}`);
      
      // Serialize the request
      console.log("Serializing request");
      const serializedRequest: SerializedRequest = {
        requestId,
        url: req.url || "",
        method: req.method || "",
        body: body,
        headers: req.headers,
      };
      console.log("Request serialized:", JSON.stringify(serializedRequest));
      
      // Set up timeout for response
      console.log("Setting up response timeout");
      let timeout = setTimeout(async () => {
        console.log(`Request ${requestId} timed out after 10 seconds`);
        try {
          console.log(`Unsubscribing from responses:${sessionId}:${requestId} due to timeout`);
          await redis.client.unsubscribe(`responses:${sessionId}:${requestId}`);
          console.log("Unsubscribed successfully");
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Failed to unsubscribe on timeout: ${errorMessage}`);
        }
        res.statusCode = 408;
        res.end("Request timed out");
      }, 10 * 1000);
      
      // Clean up on response close
      console.log("Setting up response close handler");
      res.on("close", async () => {
        console.log(`Response closed for request ${requestId}`);
        clearTimeout(timeout);
        try {
          console.log(`Unsubscribing from responses:${sessionId}:${requestId} due to close`);
          await redis.client.unsubscribe(`responses:${sessionId}:${requestId}`);
          console.log("Unsubscribed successfully");
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Failed to unsubscribe on close: ${errorMessage}`);
        }
      });
      
      // Subscribe to responses for this request
      console.log(`Subscribing to responses:${sessionId}:${requestId}`);
      await redis.client.subscribe(
        `responses:${sessionId}:${requestId}`,
        (message: string) => {
          console.log(`Received response for request ${requestId}:`, message);
          clearTimeout(timeout);
          try {
            console.log("Parsing response message");
            const response = JSON.parse(message) as SerializedResponse;
            console.log(`Response status: ${response.status}, body: ${response.body}`);
            res.statusCode = response.status;
            res.end(response.body);
            console.log("Response sent to client");
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Failed to parse response: ${errorMessage}`);
            res.statusCode = 500;
            res.end(`Failed to parse response: ${errorMessage}`);
          }
        }
      );
      console.log(`Successfully subscribed to responses:${sessionId}:${requestId}`);
      
      // Publish the request to Redis
      console.log(`Publishing request to requests:${sessionId}`);
      await redis.publisher.publish(
        `requests:${sessionId}`,
        JSON.stringify(serializedRequest)
      );
      
      console.log(`Published request to requests:${sessionId}`, JSON.stringify(serializedRequest));
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error handling message: ${errorMessage}`);
      res.statusCode = 500;
      res.end(`Internal server error: ${errorMessage}`);
    }
  }
  
  /**
   * Main API handler function
   */
  return async function mcpApiHandler(
    req: IncomingMessage,
    res: ServerResponse
  ) {
    console.log("MCP API handler called with URL:", req.url);
    try {
      // Ensure Redis is connected
      if (!redisConfig) {
        console.log("Redis not yet connected, waiting for connection");
        redisConfig = await redisPromise;
        console.log("Redis connection established");
      }
      
      const url = new URL(req.url || "", "https://example.com");
      console.log("Parsed URL:", url.toString());
      
      // Route the request based on the path
      if (url.pathname === "/sse") {
        console.log("Handling SSE connection");
        await handleSseConnection(req, res, redisConfig);
      } else if (url.pathname === "/message") {
        console.log("Handling message endpoint");
        await handleMessageEndpoint(req, res, redisConfig);
      } else {
        console.log(`Path not found: ${url.pathname}`);
        res.statusCode = 404;
        res.end("Not found");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`API handler error: ${errorMessage}`);
      res.statusCode = 500;
      res.end(`Internal server error: ${errorMessage}`);
    }
  };
}

// =================== NEXTJS ADAPTER ===================

/**
 * Creates a Next.js adapter for the MCP API handler
 * Converts between Next.js Request/Response and Node.js IncomingMessage/ServerResponse
 * 
 * @param mcpApiHandler The MCP API handler to adapt
 * @returns A function that can be used as a Next.js API handler
 */
export function createNextJsAdapter(mcpApiHandler: ReturnType<typeof initializeMcpApiHandler>) {
  console.log("Creating NextJS adapter for MCP API handler");
  return async function nextJsApiHandler(req: Request): Promise<Response> {
    console.log("NextJS adapter called with request URL:", req.url);
    try {
      // Convert the NextJS Request to an IncomingMessage
      const url = new URL(req.url);
      console.log("Parsed URL in NextJS adapter:", url.toString());
      const headers: IncomingHttpHeaders = {};
      
      console.log("Converting headers");
      req.headers.forEach((value, key) => {
        console.log(`Header: ${key} = ${value}`);
        headers[key] = value;
      });
      
      let body = '';
      if (req.body) {
        console.log("Request has body, cloning and reading");
        const clonedReq = req.clone();
        body = await clonedReq.text();
        console.log("Request body:", body);
      } else {
        console.log("Request has no body");
      }
      
      console.log("Creating fake IncomingMessage");
      
      const incomingMessage = createFakeIncomingMessage({
        method: req.method,
        url: url.pathname + url.search,
        headers,
        body,
      });
      
      // Create a Promise that will be resolved with the response data
      console.log("Creating response promise");
      
      // Use a simpler approach with direct response handling
      const responsePromise = new Promise<Response>((resolve, reject) => {
        console.log("Inside promise executor");
        let isResolved = false;
        
        const serverResponse = new ServerResponse(incomingMessage);
        console.log("Created ServerResponse");
        
        // Check if this is an SSE connection
        const isSSE = url.pathname === "/sse" && 
          ((req.headers as any)["accept"] === "text/event-stream" || 
           incomingMessage.headers["accept"] === "text/event-stream");
        console.log(`Is this an SSE connection? ${isSSE}`);
        
        // Create a function to safely resolve the promise only once
        const safeResolve = (response: Response) => {
          console.log("safeResolve called with status:", response.status);
          if (!isResolved) {
            isResolved = true;
            console.log("Actually resolving promise with status:", response.status);
            resolve(response);
          } else {
            console.log("Promise already resolved, ignoring additional resolution attempt");
          }
        };
        
        // Add response monitoring
        const responseMonitor = setInterval(() => {
          console.log("Response monitor check - writableEnded:", serverResponse.writableEnded);
          console.log("Response statusCode:", serverResponse.statusCode);
        }, 5000);
        
        // Capture the response when it's ended
        console.log("Overriding ServerResponse methods");
        
        // Override writeHead to track status changes
        const originalWriteHead = serverResponse.writeHead;
        serverResponse.writeHead = function(statusCode: number, headers?: any) {
          console.log(`ServerResponse.writeHead called with status: ${statusCode}`);
          
          // Add essential SSE headers if this is an SSE connection with 200 status
          if (isSSE && statusCode === 200) {
            console.log("Adding SSE headers to response");
            this.setHeader('Content-Type', 'text/event-stream');
            this.setHeader('Cache-Control', 'no-cache');
            this.setHeader('Connection', 'keep-alive');
            this.setHeader('X-Accel-Buffering', 'no'); // Helps with Nginx proxy buffering
          }
          
          return originalWriteHead.call(this, statusCode, headers);
        };
        
        // Override end to capture and convert the response
        const originalEnd = serverResponse.end;
        serverResponse.end = function(
          this: ServerResponse<IncomingMessage>,
          chunk?: any, 
          encodingOrCallback?: BufferEncoding | (() => void), 
          callback?: () => void
        ): ServerResponse<IncomingMessage> {
          console.log("ServerResponse.end called with:", 
            typeof chunk === 'undefined' ? 'undefined' : 
            typeof chunk === 'string' ? `string(${chunk.length})` : 
            typeof chunk === 'object' ? `object(${JSON.stringify(chunk).length})` : 
            typeof chunk);
          
          clearInterval(responseMonitor);
          
          // Get the response data
          const statusCode = this.statusCode || 200;
          const headers: Record<string, string> = {};
          
          // Convert headers from ServerResponse to Response headers
          console.log("Converting response headers");
          const headerNames = this.getHeaderNames();
          for (const name of headerNames) {
            const value = this.getHeader(name);
            console.log(`Response header: ${name} = ${value}`);
            if (typeof value === 'string') {
              headers[name] = value;
            } else if (Array.isArray(value)) {
              headers[name] = value.join(', ');
            }
          }
          
          // Create and resolve with the Response
          console.log(`Creating Response with status ${statusCode}`);
          const response = new Response(chunk, {
            status: statusCode,
            headers: headers,
          });
          
          // Call the original end method first 
          // (in case there are side effects in the implementation)
          const result = originalEnd.apply(this, arguments as any);
          
          // Then resolve the promise
          console.log("Resolving promise with response");
          
          // Only resolve for non-SSE connections or if SSE connection is closing
          if (!isSSE || statusCode !== 200) {
            safeResolve(response);
          } else {
            console.log("Not resolving promise for active SSE connection");
          }
          
          return result;
        };
        
        // Set up a timeout as a fallback
        let timeout: NodeJS.Timeout | null = null;
        
        // Only set the timeout for non-SSE connections
        if (!isSSE) {
          console.log("Setting up timeout for non-SSE request");
          timeout = setTimeout(() => {
            console.log("TIMEOUT: No response after 30 seconds");
            clearInterval(responseMonitor);
            
            // Check if we've already responded
            if (!isResolved) {
              console.log("Force creating a response due to timeout");
              if (serverResponse.statusCode) {
                // We have a status code but end() wasn't called
                console.log(`Using existing status code: ${serverResponse.statusCode}`);
                safeResolve(new Response("Handler timed out, but status was set", { 
                  status: serverResponse.statusCode 
                }));
              } else {
                // Complete fallback
                console.log("Using fallback 504 status");
                safeResolve(new Response("Handler timed out without setting status", { 
                  status: 504 
                }));
              }
            }
          }, 30000);
        } else {
          console.log("SSE connection detected - no timeout will be applied");
        }
        
        // Process the request with the MCP API handler
        console.log("Calling MCP API handler");
        (async () => {
          try {
            await mcpApiHandler(incomingMessage, serverResponse);
            console.log("MCP API handler completed");
            
            // If we get here and response.end() was never called, resolve with 204
            // But don't do this for SSE connections
            if (!isResolved && !isSSE) {
              console.log("Handler completed but never called end(), resolving with 204");
              if (timeout) clearTimeout(timeout);
              clearInterval(responseMonitor);
              safeResolve(new Response(null, { status: 204 }));
            }
          } catch (error) {
            console.error("Error in MCP API handler:", error);
            if (timeout) clearTimeout(timeout);
            clearInterval(responseMonitor);
            if (!isResolved) {
              safeResolve(new Response(`MCP handler error: ${error instanceof Error ? error.message : String(error)}`, { 
                status: 500 
              }));
            }
          }
        })();
      });
      
      return responsePromise;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("NextJS adapter error:", error);
      return new Response(`Internal server error: ${errorMessage}`, { 
        status: 500 
      });
    }
  };
}
