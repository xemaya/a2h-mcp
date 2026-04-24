# @a2hmarket/a2h-mcp

Local MCP server that bridges Claude Code / Openclaw / Hermes to the
**A2H Market AI assistant**.

Talks stdio MCP on one side and HTTPS + SSE to
[`a2hmarket-concierge`](https://github.com/keman-ai/a2hmarket-concierge) on the
other.

## Install

Add one block to your MCP host config — e.g. Claude Code's `.mcp.json`:

```json
{
  "mcpServers": {
    "a2h": {
      "command": "npx",
      "args": ["-y", "@a2hmarket/a2h-mcp"]
    }
  }
}
```

## Login

Before the tools become usable you have to bind this machine to your A2H
account:

```bash
npx -y @a2hmarket/a2h-mcp-login
```

This runs the OAuth **Device Authorization Grant** flow:

1. Prints a URL (`https://a2hmarket.ai/bind/skill?code=BIND-xxx&hostname=...`)
2. Opens it in your default browser
3. Polls concierge until the code is confirmed
4. Writes `~/.a2h/credentials.json` (0600), containing the PAT + agentId

Restart the MCP host (Claude Code / Openclaw) afterwards so it re-initializes
the server with credentials.

## Staging / local

Two knobs — `--staging` CLI flag or `A2H_API_BASE` env var:

```bash
# Staging
npx -y @a2hmarket/a2h-mcp --staging
npx -y @a2hmarket/a2h-mcp-login --staging

# Fully custom (e.g. local concierge)
A2H_API_BASE=http://localhost:8821/a2hmarket-concierge npx -y @a2hmarket/a2h-mcp
```

`A2H_API_BASE` takes precedence over `--staging`.

## Tools exposed

| Tool | Purpose |
| --- | --- |
| `send_message_to_ai` | Send a user message. Reply lands asynchronously as `notifications/a2h/event`. |
| `get_user_info`      | Return the bound `agentId` / tokenName / createdAt.                           |
| `login`              | Only when unauthenticated: nudges the user to run `a2h-mcp-login`.             |

Extra messages pushed by concierge (AI replies, system notifications) are
forwarded to the MCP host via `notifications/a2h/event`. (MCP's built-in
`notifications/message` is reserved for server logging under 2024-11-05 spec,
so we use a custom method to avoid strict-host payload drops.)

## Architecture

```
┌──────────────────────────────────┐
│ Claude Code / Openclaw / Hermes  │
└──────────────┬───────────────────┘
               │ stdio JSON-RPC (MCP)
               ▼
┌──────────────────────────────────┐
│  @a2hmarket/a2h-mcp (this package)  │
│  ├── tools: send_message, …      │
│  ├── ~/.a2h/credentials.json     │
│  └── SSE subscriber → notify     │
└──────────────┬───────────────────┘
               │ HTTPS + Bearer PAT
               ▼
┌──────────────────────────────────┐
│  a2hmarket-concierge             │
│  POST /api/v1/agent/messages     │
│  GET  /api/v1/agent/events/stream│
└──────────────────────────────────┘
```

Detailed plan: [`agent_tasks/exec-plans/2026-04-24-skill-mcp-v2-local.md`](https://github.com/keman-ai/aws_codebase/blob/main/agent_tasks/exec-plans/2026-04-24-skill-mcp-v2-local.md).

## Development

```bash
git clone https://github.com/xemaya/a2h-mcp
cd a2h-mcp
npm install
npm run build
npm test
```

Smoke test the stdio handshake:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  | node dist/index.js
```

Release:

```bash
npm version patch
git push --follow-tags
```

CI publishes on tag `v*`. Requires `NPM_TOKEN` GitHub secret.

## Contributing

PRs welcome. Requires:
- Node 18+
- `npm test` green
- `npm run build` green

## License

MIT — see [LICENSE](./LICENSE).
