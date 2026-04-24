import type { ToolContext } from "./send-message.js";

const descriptor = {
  name: "get_user_info",
  description:
    "Get current A2H user identity (agentId, token name, login time).",
  inputSchema: {
    type: "object" as const,
    properties: {},
    required: [] as string[],
  },
};

export const getUserInfoTool = {
  name: descriptor.name,
  descriptor,
  handler: async (
    _args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
    const payload = {
      agentId: ctx.creds.agentId,
      tokenName: ctx.creds.tokenName,
      createdAt: ctx.creds.createdAt,
    };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(payload),
        },
      ],
    };
  },
};
