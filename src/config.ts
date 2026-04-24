import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Credentials {
  token: string;
  agentId: string;
  tokenName: string;
  createdAt: string;
}

/**
 * Resolve the credentials path. Respects `A2H_HOME` env var for testability.
 * Falls back to `$HOME/.a2h`.
 */
export function credDir(): string {
  const override = process.env.A2H_HOME;
  if (override) {
    return override;
  }
  return join(homedir(), ".a2h");
}

export function credPath(): string {
  return join(credDir(), "credentials.json");
}

export function loadCredentials(): Credentials | null {
  const path = credPath();
  if (!existsSync(path)) {
    return null;
  }
  try {
    const text = readFileSync(path, "utf-8");
    const parsed = JSON.parse(text);
    if (
      typeof parsed?.token !== "string" ||
      typeof parsed?.agentId !== "string" ||
      typeof parsed?.tokenName !== "string"
    ) {
      return null;
    }
    return parsed as Credentials;
  } catch {
    return null;
  }
}

export function resolveApiBase(): string {
  const override = process.env.A2H_API_BASE;
  if (override) {
    return override.replace(/\/$/, "");
  }
  const isStaging = process.argv.includes("--staging");
  return isStaging
    ? "https://api-staging.a2hmarket.ai/a2hmarket-concierge"
    : "https://api.a2hmarket.ai/a2hmarket-concierge";
}
