import { request } from "undici";
import { writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { hostname } from "node:os";
import open from "open";

import { resolveApiBase, credPath } from "./config.js";

interface StartResponse {
  code: string;
  verifyUrl: string;
}

interface PollResponse {
  status: "PENDING" | "READY" | "EXPIRED";
  token?: string;
  agentId?: string;
  tokenName?: string;
}

async function unwrap<T>(body: { text(): Promise<string> }): Promise<T> {
  const text = await body.text();
  const parsed = JSON.parse(text);
  const data =
    parsed && typeof parsed === "object" && "data" in parsed
      ? (parsed as { data: unknown }).data
      : parsed;
  return data as T;
}

/**
 * Device Authorization Grant flow. Prints the verify URL, opens the browser,
 * polls until READY or EXPIRED, then writes credentials.json (0600).
 */
export async function main(): Promise<void> {
  const base = resolveApiBase();

  const startResp = await request(`${base}/api/v1/agent/bind/start`, {
    method: "POST",
  });
  if (startResp.statusCode !== 200) {
    const text = await startResp.body.text();
    throw new Error(`bind/start failed ${startResp.statusCode}: ${text}`);
  }
  const startData = await unwrap<StartResponse>(startResp.body);
  const { code, verifyUrl } = startData;
  const fullUrl = `${verifyUrl}&hostname=${encodeURIComponent(hostname())}`;

  process.stderr.write(
    `\nOpen this URL in your browser to authorize:\n  ${fullUrl}\n\n`,
  );
  try {
    await open(fullUrl);
  } catch {
    // headless / no browser; user will copy-paste
  }
  // Even when `open` resolves successfully, some environments (SSH / headless
  // servers / WSL without browser integration) don't actually pop a window.
  // Print an explicit hint so the user knows to copy the URL above.
  process.stderr.write(
    `(If your browser didn't open, copy the URL above.)\n\n`,
  );

  const pollEveryMs = 5000;
  const maxAttempts = 60; // 5 minutes
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollEveryMs));
    const pollResp = await request(
      `${base}/api/v1/agent/bind/poll?code=${encodeURIComponent(code)}`,
    );
    if (pollResp.statusCode !== 200) {
      const text = await pollResp.body.text();
      process.stderr.write(
        `poll attempt ${i + 1} failed ${pollResp.statusCode}: ${text}\n`,
      );
      continue;
    }
    const poll = await unwrap<PollResponse>(pollResp.body);
    if (poll.status === "READY" && poll.token && poll.agentId) {
      saveCredentials({
        token: poll.token,
        agentId: poll.agentId,
        tokenName: poll.tokenName ?? "default",
        createdAt: new Date().toISOString(),
      });
      process.stderr.write(
        `\nLogged in as ${poll.tokenName ?? "default"}\n` +
          `Credentials saved to ${credPath()}\n` +
          `Restart Claude Code to activate the a2h MCP server.\n`,
      );
      return;
    }
    if (poll.status === "EXPIRED") {
      process.stderr.write(`\nBind code expired. Re-run login.\n`);
      process.exit(1);
    }
  }
  process.stderr.write(`\nTimed out waiting for browser confirmation.\n`);
  process.exit(1);
}

function saveCredentials(c: {
  token: string;
  agentId: string;
  tokenName: string;
  createdAt: string;
}): void {
  const path = credPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(c, null, 2));
  try {
    chmodSync(path, 0o600);
  } catch {
    // Windows may not support chmod; best-effort
  }
}
