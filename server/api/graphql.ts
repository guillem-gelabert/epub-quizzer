import { ApolloServer } from "@apollo/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvers } from "../graphql/resolvers";
import { createContext } from "../graphql/context";

// #region agent log
const LOG_ENDPOINT = "http://127.0.0.1:7245/ingest/2fc64e3d-fe57-477f-9bb1-fd781caa27df";
const LOG_FILE = "/Users/guillem/projects/guillem/epub-quizzer/.cursor/debug.log";
const log = async (h: string, l: string, m: string, d: any) => {
  const entry = JSON.stringify({id: `log_${Date.now()}_${Math.random().toString(36).substr(2,9)}`, timestamp: Date.now(), location: l, message: m, data: d, sessionId: "debug-session", runId: "server-debug", hypothesisId: h}) + "\n";
  try {
    await fetch(LOG_ENDPOINT, {method: "POST", headers: {"Content-Type": "application/json"}, body: entry.trim()}).catch(()=>{});
  } catch {}
  try {
    const fs = await import("node:fs/promises");
    await fs.appendFile(LOG_FILE, entry).catch(()=>{});
  } catch {}
  console.error(`[DEBUG ${h}] ${l}: ${m}`, d);
};
// #endregion

// #region agent log
log("C", "graphql.ts:module-init", "GraphQL module initialization", {cwd: process.cwd(), nodeEnv: process.env.NODE_ENV, hasDatabaseUrl: !!process.env.DATABASE_URL}).catch(()=>{});
// #endregion

let typeDefs: string;
try {
  // #region agent log
  const schemaPath = join(process.cwd(), "server/graphql/schema.graphql");
  log("C", "graphql.ts:schema-read:before", "reading schema file", {schemaPath, cwd: process.cwd()}).catch(()=>{});
  // #endregion
  typeDefs = readFileSync(schemaPath, "utf-8");
  // #region agent log
  log("C", "graphql.ts:schema-read:after", "schema file read", {typeDefsLength: typeDefs.length}).catch(()=>{});
  // #endregion
} catch (error) {
  // #region agent log
  log("C", "graphql.ts:schema-read:error", "schema file read error", {error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined}).catch(()=>{});
  // #endregion
  throw error;
}

let server: ApolloServer;
let serverPromise: Promise<void>;
try {
  // #region agent log
  log("C", "graphql.ts:apollo-init:before", "creating Apollo Server", {hasTypeDefs: !!typeDefs, hasResolvers: !!resolvers}).catch(()=>{});
  // #endregion
  server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: false, // Disable CSRF protection for same-origin requests
  });
  // #region agent log
  log("C", "graphql.ts:apollo-init:after", "Apollo Server created", {}).catch(()=>{});
  // #endregion
  
  // Start the server
  // #region agent log
  log("C", "graphql.ts:apollo-start:before", "starting Apollo Server", {}).catch(()=>{});
  // #endregion
  serverPromise = server.start();
  // #region agent log
  log("C", "graphql.ts:apollo-start:after", "Apollo Server start initiated", {}).catch(()=>{});
  // #endregion
} catch (error) {
  // #region agent log
  log("C", "graphql.ts:apollo-init:error", "Apollo Server initialization error", {error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined}).catch(()=>{});
  // #endregion
  throw error;
}

export default defineEventHandler(async (event) => {
  // #region agent log
  await log("D", "graphql.ts:handler:entry", "GraphQL request received", {method: event.method, path: event.path, hasBody: !!event.node.req.readable});
  // #endregion
  
  // Wait for server to start
  try {
    // #region agent log
    await log("D", "graphql.ts:handler:server-wait:before", "waiting for Apollo Server", {});
    // #endregion
    await serverPromise;
    // #region agent log
    await log("D", "graphql.ts:handler:server-wait:after", "Apollo Server ready", {});
    // #endregion
  } catch (error) {
    // #region agent log
    await log("D", "graphql.ts:handler:server-wait:error", "Apollo Server start error", {error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined});
    // #endregion
    setResponseStatus(event, 500);
    return JSON.stringify({
      errors: [{
        message: `Apollo Server failed to start: ${error instanceof Error ? error.message : String(error)}`
      }]
    });
  }

  // Get the request body - Apollo Server expects a parsed JSON object
  let body: any = {};
  try {
    const rawBody = await readBody(event);
    // #region agent log
    console.log('[DEBUG] Raw body type:', typeof rawBody, 'is object:', typeof rawBody === 'object');
    // #endregion
    
    // If body is already an object, use it; otherwise try to parse
    if (typeof rawBody === 'object' && rawBody !== null) {
      body = rawBody;
    } else if (typeof rawBody === 'string') {
      body = JSON.parse(rawBody);
    } else {
      body = {};
    }
  } catch (error) {
    // #region agent log
    console.error('[DEBUG] Failed to read/parse body:', error);
    // #endregion
    body = {};
  }

  // #region agent log
  console.log('[DEBUG] GraphQL request body:', {
    hasQuery: !!(body as any).query,
    queryLength: (body as any).query?.length,
    hasVariables: !!(body as any).variables,
    bodyKeys: Object.keys(body || {}),
    bodyString: JSON.stringify(body).substring(0, 200)
  });
  // #endregion

  // Convert H3 headers to Map format for Apollo
  const headers = new Map<string, string>();
  for (const [key, value] of Object.entries(event.headers)) {
    if (value) {
      headers.set(key.toLowerCase(), Array.isArray(value) ? value.join(", ") : value);
    }
  }
  
  // Ensure Content-Type is set for Apollo Server CSRF protection
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  
  // #region agent log
  console.log('[DEBUG] GraphQL request headers:', {
    hasContentType: headers.has('content-type'),
    contentType: headers.get('content-type'),
    allHeaders: Array.from(headers.entries())
  });
  // #endregion

  try {
    // #region agent log
    console.log('[DEBUG] About to execute GraphQL request:', {
      method: event.method || "POST",
      bodyType: typeof body,
      bodyIsObject: body && typeof body === 'object',
      bodyKeys: body && typeof body === 'object' ? Object.keys(body) : 'N/A'
    });
    // #endregion
    
    // Apollo Server expects body to be a JSON object with query and optionally variables
    // Ensure body is properly formatted
    if (!body || typeof body !== 'object' || !body.query) {
      // #region agent log
      console.error('[DEBUG] Invalid GraphQL request body:', {
        bodyType: typeof body,
        hasQuery: !!(body as any)?.query,
        body: JSON.stringify(body).substring(0, 200)
      });
      // #endregion
      setResponseStatus(event, 400);
      return JSON.stringify({
        errors: [{
          message: "Invalid GraphQL request: missing query"
        }]
      });
    }
    
    // Convert headers Map to HeaderMap format
    const headerMap = new Map<string, string>();
    for (const [key, value] of headers.entries()) {
      headerMap.set(key, value);
    }

    // Handle GraphQL request
    const httpGraphQLResponse = await server.executeHTTPGraphQLRequest({
      httpGraphQLRequest: {
        method: event.method || "POST",
        headers: headerMap as any, // Apollo expects HeaderMap but accepts Map
        search: new URL(event.path || "", "http://localhost").search,
        body,
      },
      context: async () => {
        // #region agent log
        await log("D", "graphql.ts:handler:context:before", "creating GraphQL context", {});
        // #endregion
        try {
          const ctx = await createContext(event);
          // #region agent log
          await log("D", "graphql.ts:handler:context:after", "GraphQL context created", {hasPrisma: !!ctx.prisma, hasSessionId: !!ctx.sessionId});
          // #endregion
          return ctx;
        } catch (error) {
          // #region agent log
          await log("D", "graphql.ts:handler:context:error", "GraphQL context creation error", {error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined});
          // #endregion
          throw error;
        }
      },
    });

    // #region agent log
    console.log('[DEBUG] GraphQL response:', {
      status: httpGraphQLResponse.status,
      hasHeaders: !!httpGraphQLResponse.headers,
      bodyKind: httpGraphQLResponse.body.kind
    });
    // #endregion

    // Set response headers
    if (httpGraphQLResponse.headers) {
      for (const [key, value] of httpGraphQLResponse.headers) {
        setHeader(event, key, value);
      }
    }

    // Set status code
    setResponseStatus(event, httpGraphQLResponse.status || 200);

    // Return response body
    if (httpGraphQLResponse.body.kind === "complete") {
      const responseBody = httpGraphQLResponse.body.string;
      // #region agent log
      console.log('[DEBUG] GraphQL response body (first 200 chars):', responseBody?.substring(0, 200));
      // #endregion
      return responseBody;
    } else {
      // For chunked responses, we need to handle the async iterator
      // For now, return the string representation
      const chunks: string[] = [];
      for await (const chunk of httpGraphQLResponse.body.asyncIterator) {
        chunks.push(chunk);
      }
      return chunks.join("");
    }
  } catch (error) {
    // #region agent log
    await log("D", "graphql.ts:handler:error", "GraphQL handler error", {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      errorString: String(error),
      errorKeys: error && typeof error === 'object' ? Object.keys(error) : []
    });
    // #endregion
    
    // If it's a 400 error from Apollo, return it as-is
    if (error && typeof error === 'object' && 'status' in error && (error as any).status === 400) {
      setResponseStatus(event, 400);
      return JSON.stringify({
        errors: [{
          message: error instanceof Error ? error.message : String(error)
        }]
      });
    }
    
    setResponseStatus(event, 500);
    return JSON.stringify({
      errors: [{
        message: error instanceof Error ? error.message : String(error)
      }]
    });
  }
});

