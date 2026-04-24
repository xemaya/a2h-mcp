import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  credPath,
  loadCredentials,
  resolveApiBase,
} from "../src/config.js";

let tmp: string;
let originalArgv: string[];
let originalEnvBase: string | undefined;
let originalHome: string | undefined;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "a2h-mcp-test-"));
  process.env.A2H_HOME = tmp;
  originalArgv = process.argv;
  originalEnvBase = process.env.A2H_API_BASE;
  originalHome = process.env.A2H_HOME;
  delete process.env.A2H_API_BASE;
  process.argv = ["node", "test"];
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  process.argv = originalArgv;
  if (originalEnvBase === undefined) {
    delete process.env.A2H_API_BASE;
  } else {
    process.env.A2H_API_BASE = originalEnvBase;
  }
  if (originalHome === undefined) {
    delete process.env.A2H_HOME;
  } else {
    process.env.A2H_HOME = originalHome;
  }
});

describe("config.loadCredentials", () => {
  it("returns null when file does not exist", () => {
    expect(loadCredentials()).toBeNull();
  });

  it("parses a valid credentials file", () => {
    mkdirSync(tmp, { recursive: true });
    writeFileSync(
      credPath(),
      JSON.stringify({
        token: "a2h_pat_abc",
        agentId: "ag_1",
        tokenName: "my-laptop",
        createdAt: "2026-04-24T00:00:00Z",
      }),
    );
    const c = loadCredentials();
    expect(c).not.toBeNull();
    expect(c?.token).toBe("a2h_pat_abc");
    expect(c?.agentId).toBe("ag_1");
  });

  it("returns null on malformed JSON", () => {
    writeFileSync(credPath(), "not json {{{");
    expect(loadCredentials()).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    writeFileSync(credPath(), JSON.stringify({ token: "x" }));
    expect(loadCredentials()).toBeNull();
  });
});

describe("config.resolveApiBase", () => {
  it("defaults to prod", () => {
    expect(resolveApiBase()).toBe(
      "https://api.a2hmarket.ai/a2hmarket-concierge",
    );
  });

  it("switches to staging with --staging flag", () => {
    process.argv = ["node", "test", "--staging"];
    expect(resolveApiBase()).toBe(
      "https://api-staging.a2hmarket.ai/a2hmarket-concierge",
    );
  });

  it("A2H_API_BASE env var overrides everything", () => {
    process.env.A2H_API_BASE = "http://localhost:8821/a2hmarket-concierge/";
    process.argv = ["node", "test", "--staging"];
    expect(resolveApiBase()).toBe(
      "http://localhost:8821/a2hmarket-concierge",
    );
  });
});
