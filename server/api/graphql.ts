import { ApolloServer } from "@apollo/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvers } from "../graphql/resolvers";
import { createContext } from "../graphql/context";
import type { GraphQLContext } from "../graphql/context";

let typeDefs: string;
const schemaPath = join(process.cwd(), "server/graphql/schema.graphql");
typeDefs = readFileSync(schemaPath, "utf-8");

const server = new ApolloServer<GraphQLContext>({
  typeDefs,
  resolvers,
  csrfPrevention: false, // allow same-origin + reverse-proxy setups
});
const serverPromise = server.start();

export default defineEventHandler(async (event) => {
  // Wait for server to start
  await serverPromise;

  // Get the request body - Apollo Server expects a parsed JSON object
  let body: any = {};
  try {
    const rawBody = await readBody(event);
    if (typeof rawBody === "object" && rawBody !== null) {
      body = rawBody;
    } else if (typeof rawBody === "string") {
      body = JSON.parse(rawBody);
    } else {
      body = {};
    }
  } catch (error) {
    body = {};
  }

  // Convert H3 headers to Map format for Apollo
  const headers = new Map<string, string>();
  for (const [key, value] of Object.entries(event.headers)) {
    if (value) {
      headers.set(key.toLowerCase(), Array.isArray(value) ? value.join(", ") : value);
    }
  }
  
  // Ensure Content-Type is set for Apollo Server CSRF protection
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  try {
    // Apollo Server expects body to be a JSON object with query and optionally variables
    // Ensure body is properly formatted
    if (!body || typeof body !== 'object' || !body.query) {
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

    const url = new URL(event.node.req.url ?? "", "http://localhost");

    // Handle GraphQL request
    const httpGraphQLResponse = await server.executeHTTPGraphQLRequest({
      httpGraphQLRequest: {
        method: event.method || "POST",
        headers: headerMap as any, // Apollo expects HeaderMap but accepts Map
        search: url.search,
        body,
      },
      context: async () => {
        return await createContext(event);
      },
    });

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
      return httpGraphQLResponse.body.string;
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

