import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { loadCredentials, resolveApiBase } from "./config.js";
import { A2hApiClient } from "./api-client.js";
import { EventStreamClient } from "./event-stream.js";
import { sendMessageTool } from "./tools/send-message.js";
import { getUserInfoTool } from "./tools/get-user-info.js";

const SERVER_NAME = "a2h-mcp";
const SERVER_VERSION = "0.1.0";

/**
 * Entry point for the stdio MCP server. If no credentials are present, only a
 * `login` helper tool is exposed. When authenticated the real tools plus a
 * concierge SSE subscription are wired up.
 */
export async function start(): Promise<void> {
  const creds = loadCredentials();
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, logging: {} } },
  );

  if (!creds) {
    registerUnauthenticated(server);
  } else {
    registerAuthenticated(server, creds);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function registerUnauthenticated(server: Server): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "login",
        description:
          "Run this tool to authenticate with A2H Market. It will print a command to run in a separate terminal.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    if (name === "login") {
      return {
        content: [
          {
            type: "text",
            text:
              "Not logged in. Run in a separate terminal:\n" +
              "  npx -y @a2hmarket/a2h-mcp-login\n" +
              "Then restart this MCP server (or the host app).",
          },
        ],
      };
    }
    throw new Error(`Unknown tool: ${name}`);
  });
}

function registerAuthenticated(
  server: Server,
  creds: ReturnType<typeof loadCredentials> & object,
): void {
  const apiBase = resolveApiBase();
  const api = new A2hApiClient(apiBase, creds.token);

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [sendMessageTool.descriptor, getUserInfoTool.descriptor],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    const ctx = { api, creds };
    if (name === sendMessageTool.name) {
      return await sendMessageTool.handler(args, ctx);
    }
    if (name === getUserInfoTool.name) {
      return await getUserInfoTool.handler(args, ctx);
    }
    throw new Error(`Unknown tool: ${name}`);
  });

  // SSE bridge → MCP notifications/message
  const events = new EventStreamClient(apiBase, creds.token);
  events.on("message", (payload) => {
    void server.notification({
      method: "notifications/message",
      params: payload as Record<string, unknown>,
    });
  });
  events.on("error", (err: unknown) => {
    // Log to stderr; stdout is reserved for the JSON-RPC channel.
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[a2h-mcp] event-stream error: ${msg}\n`);
  });
  events.start();
}
