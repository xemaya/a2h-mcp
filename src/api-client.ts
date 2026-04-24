import { request } from "undici";

/**
 * HTTP client talking to a2hmarket-concierge. Sends JSON + Bearer PAT.
 */
export class A2hApiClient {
  constructor(
    private readonly base: string,
    private readonly token: string,
  ) {}

  get apiBase(): string {
    return this.base;
  }

  get bearer(): string {
    return this.token;
  }

  /**
   * POST /api/v1/agent/messages — send a user message to the AI assistant.
   * Returns the `data` payload from the `ApiResponse` envelope (concierge
   * wraps responses with `ApiResponse<T>`).
   */
  async sendMessage(
    content: string,
    attachments?: unknown[],
  ): Promise<{ messageId: string; sentAt: string }> {
    const url = `${this.base}/api/v1/agent/messages`;
    const { statusCode, body } = await request(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, attachments }),
      // undici defaults to a 300s body timeout which is absurdly long for a
      // user-facing send. Bound both the handshake and body read explicitly.
      headersTimeout: 10_000,
      bodyTimeout: 30_000,
    });
    const text = await body.text();
    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(`sendMessage failed ${statusCode}: ${text}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`sendMessage invalid JSON: ${text}`);
    }
    // concierge returns ApiResponse<T>; unwrap `data`.
    const data =
      parsed && typeof parsed === "object" && "data" in parsed
        ? (parsed as { data: unknown }).data
        : parsed;
    return data as { messageId: string; sentAt: string };
  }
}
