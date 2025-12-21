import { ApolloServer } from "@apollo/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvers } from "../graphql/resolvers";
import { createContext } from "../graphql/context";

const typeDefs = readFileSync(
  join(process.cwd(), "server/graphql/schema.graphql"),
  "utf-8"
);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  csrfPrevention: false, // Disable CSRF protection for same-origin requests
});

// Start the server
const serverPromise = server.start();

export default defineEventHandler(async (event) => {
  // #region agent log
  console.log('[DEBUG] GraphQL request received:', {
    method: event.method,
    path: event.path,
    hasBody: !!event.node.req.readable
  });
  // #endregion
  
  // Wait for server to start
  await serverPromise;

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
        console.log('[DEBUG] Creating GraphQL context');
        // #endregion
        return createContext(event);
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
    console.error('[DEBUG] GraphQL handler error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      errorName: error instanceof Error ? error.name : typeof error
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

