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

This runs the **AuthCode** flow (shared with the existing Openclaw / A2H
skill authorization page):

1. Generates a local code `SKILL-<hex>`
2. Opens `https://a2hmarket.ai/authcode?code=SKILL-...` in your default browser
3. You log in to A2H Market (if not already) and click **Confirm authorize** —
   the front-end calls `PUT /findu-user/api/v1/user/agent/auth?code=...`
   on your behalf
4. The CLI polls `GET /findu-user/api/v1/public/user/agent/auth?code=...`
   every 5s and, as soon as it sees a `patToken`, writes
   `~/.a2h/credentials.json` (0600) — 180-day PAT + agentId

> The `/authcode` page is the same page Openclaw and the A2H skill use for
> agent authorization. One confirmation issues one PAT; subsequent MCP
> requests are authenticated with that PAT only.

Restart the MCP host (Claude Code / Openclaw / Hermes) afterwards so it
re-initializes the server with credentials.

## Staging / local

Three URL knobs (each CLI flag or env var — flags take precedence, envs
override flags):

| Variable            | Default (prod)                                     | Default (staging)                                |
| ------------------- | -------------------------------------------------- | ------------------------------------------------ |
| `A2H_API_BASE`      | `https://api.a2hmarket.ai/a2hmarket-concierge`     | `https://api-staging.a2hmarket.ai/a2hmarket-concierge` |
| `A2H_USER_BASE`     | derived → `https://api.a2hmarket.ai/findu-user`    | derived → `https://api-staging.a2hmarket.ai/findu-user` |
| `A2H_FRONT_BASE`    | derived → `https://a2hmarket.ai`                   | derived → `https://demo.a2hmarket.ai` *(staging CloudFront)* |

```bash
# Staging
npx -y @a2hmarket/a2h-mcp --staging
npx -y @a2hmarket/a2h-mcp-login --staging

# Fully custom (e.g. local concierge + local findu-user + local vite)
A2H_API_BASE=http://localhost:8821/a2hmarket-concierge \
A2H_USER_BASE=http://localhost:8802/findu-user \
A2H_FRONT_BASE=http://localhost:5173 \
  npx -y @a2hmarket/a2h-mcp-login
```

Env vars take precedence over `--staging`. `A2H_USER_BASE` and
`A2H_FRONT_BASE` default to values *derived* from `A2H_API_BASE` (same host,
path swapped to `/findu-user`; host stripped of `api.` / `api-staging.`
prefix).

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
