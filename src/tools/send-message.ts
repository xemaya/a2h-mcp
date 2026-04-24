import type { A2hApiClient } from "../api-client.js";
import type { Credentials } from "../config.js";

export interface ToolContext {
  api: A2hApiClient;
  creds: Credentials;
}

const descriptor = {
  name: "send_message_to_ai",
  description:
    "Send a message to the A2H AI assistant. The reply arrives asynchronously via notifications/message.",
  inputSchema: {
    type: "object" as const,
    properties: {
      content: {
        type: "string" as const,
        description: "The user message text",
      },
    },
    required: ["content" as const],
  },
};

export const sendMessageTool = {
  name: descriptor.name,
  descriptor,
  handler: async (
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
    const content = args?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error("content is required");
    }
    const result = await ctx.api.sendMessage(content);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result),
        },
      ],
    };
  },
};
