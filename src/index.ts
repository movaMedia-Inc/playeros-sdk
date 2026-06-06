/**
 * PlayerOS SDK — official TypeScript/JavaScript client for the PlayerOS API.
 *
 * PlayerOS is a casino marketing platform for gaming operators: a unified player
 * database, multi-channel campaigns (email, SMS, AI voice, web push, Player Inbox),
 * journey automation, and TCPA/CCPA/GDPR compliance.
 *
 * Docs:    https://playeros.ai/api-docs
 * OpenAPI: https://playeros.ai/openapi.json
 * MCP:     https://api.playeros.ai/api/mcp
 *
 * @example
 * ```ts
 * import { PlayerOS } from "@playeros/sdk";
 * const playeros = new PlayerOS({ apiKey: process.env.PLAYEROS_API_KEY! });
 * const { data } = await playeros.players.list({ limit: 50 });
 * ```
 */

export const DEFAULT_BASE_URL = "https://api.playeros.ai";
export const SDK_VERSION = "0.1.0";

export interface PlayerOSOptions {
  /** Property-scoped API key, e.g. `pk_live_…`. Create one in Settings → API & MCP. */
  apiKey: string;
  /** Override the API base URL. Defaults to https://api.playeros.ai */
  baseUrl?: string;
  /** Optional custom fetch (defaults to global fetch; Node 18+ has it built in). */
  fetch?: typeof fetch;
  /** Per-request timeout in ms (default 30000). */
  timeoutMs?: number;
}

/** Structured error thrown for any non-2xx API response. Safe to branch on `.code`. */
export class PlayerOSError extends Error {
  readonly status: number;
  /** Stable condition token from the API body, e.g. `insufficient_scope`. */
  readonly code?: string;
  readonly requestId?: string;
  /** Seconds to wait before retrying (present on 429). */
  readonly retryAfter?: number;
  readonly body: unknown;
  constructor(status: number, body: unknown, requestId?: string) {
    const b = (body && typeof body === "object" ? (body as Record<string, unknown>) : {}) as Record<string, unknown>;
    const code = typeof b.error === "string" ? b.error : typeof b.code === "string" ? b.code : undefined;
    const message = (typeof b.message === "string" && b.message) || code || `PlayerOS API error ${status}`;
    super(message);
    this.name = "PlayerOSError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryAfter = typeof b.retry_after === "number" ? b.retry_after : undefined;
    this.body = body;
  }
}

/** Advisory rate-limit state parsed from `X-RateLimit-*` response headers. */
export interface RateLimit {
  limit?: number;
  remaining?: number;
  reset?: number;
}

/** Envelope returned by every SDK call: parsed body + useful response metadata. */
export interface Response<T> {
  data: T;
  status: number;
  requestId?: string;
  /** Total row count from `X-Total-Count` on list endpoints, when present. */
  totalCount?: number;
  rateLimit: RateLimit;
  /** True if this response replayed a prior request matched by Idempotency-Key. */
  idempotencyReplayed?: boolean;
}

export interface RequestOptions {
  /** Unique key so a retried write never double-applies (campaign sends, etc.). */
  idempotencyKey?: string;
  /** AbortSignal to cancel the request. */
  signal?: AbortSignal;
}

export interface Player {
  id?: string;
  property_id?: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  /** Gaming-native fields. */
  player_id?: string;
  tier?: string;
  adt?: number;
  coin_in?: number;
  [key: string]: unknown;
}

export interface ListParams {
  limit?: number;
  offset?: number;
  /** Free-text search. */
  q?: string;
  /** Restrict to a property (when the key is not already property-bound). */
  property_id?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface AsyncJob {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  type?: string;
  total?: number;
  processed?: number;
  status_url?: string;
  created_at?: string;
  [key: string]: unknown;
}

/**
 * The PlayerOS API client. Construct once and reuse; it is stateless and safe
 * to share across requests.
 */
export class PlayerOS {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly _fetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: PlayerOSOptions) {
    if (!opts?.apiKey) throw new Error("PlayerOS: `apiKey` is required (e.g. pk_live_…).");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
    const f = opts.fetch || (globalThis.fetch as typeof fetch | undefined);
    if (!f) throw new Error("PlayerOS: no fetch available. Use Node 18+ or pass `fetch` in options.");
    this._fetch = f;
    this.timeoutMs = opts.timeoutMs ?? 30000;
  }

  /** Low-level request. Most callers use the resource helpers below. */
  async request<T = unknown>(
    method: string,
    path: string,
    init: { query?: ListParams; body?: unknown } & RequestOptions = {}
  ): Promise<Response<T>> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(init.query || {})) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      "X-Api-Key": this.apiKey,
      Accept: "application/json",
      "User-Agent": `playeros-sdk/${SDK_VERSION}`,
    };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    if (init.signal) init.signal.addEventListener("abort", () => ac.abort(), { once: true });

    let res: globalThis.Response;
    try {
      res = await this._fetch(url.toString(), {
        method,
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const requestId = res.headers.get("x-request-id") || undefined;
    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) throw new PlayerOSError(res.status, parsed, requestId);

    const num = (h: string) => {
      const v = res.headers.get(h);
      return v == null || v === "" ? undefined : Number(v);
    };
    return {
      data: parsed as T,
      status: res.status,
      requestId,
      totalCount: num("x-total-count"),
      rateLimit: { limit: num("x-ratelimit-limit"), remaining: num("x-ratelimit-remaining"), reset: num("x-ratelimit-reset") },
      idempotencyReplayed: res.headers.get("idempotency-replayed") === "true",
    };
  }

  // ── Players ───────────────────────────────────────────────────────────────
  readonly players = {
    list: (params?: ListParams) => this.request<Player[]>("GET", "/api/players", { query: params }),
    get: (id: string) => this.request<Player>("GET", `/api/players/${encodeURIComponent(id)}`),
    create: (player: Player) => this.request<Player>("POST", "/api/players", { body: player }),
    update: (id: string, patch: Partial<Player>) =>
      this.request<Player>("PATCH", `/api/players/${encodeURIComponent(id)}`, { body: patch }),
    delete: (id: string) => this.request<void>("DELETE", `/api/players/${encodeURIComponent(id)}`),
    /** Start an async batch email-validation job. Poll with `validationJobs.get`. */
    validateBatch: (body: { property_id?: string; emails?: string[]; [k: string]: unknown }) =>
      this.request<AsyncJob>("POST", "/api/functions/validate-batch", { body }),
  };

  readonly validationJobs = {
    get: (id: string) => this.request<AsyncJob>("GET", `/api/validation_jobs/${encodeURIComponent(id)}`),
  };

  // ── Campaigns ─────────────────────────────────────────────────────────────
  readonly campaigns = {
    /** Send an email campaign. Pass an `idempotencyKey` to make retries safe. */
    sendEmail: (body: { campaignId: string; propertyId: string; [k: string]: unknown }, opts?: RequestOptions) =>
      this.request("POST", "/api/functions/send-campaign", { body, ...opts }),
    sendSms: (body: { campaignId: string; propertyId: string; [k: string]: unknown }, opts?: RequestOptions) =>
      this.request("POST", "/api/functions/send-sms-campaign", { body, ...opts }),
  };

  // ── Compliance ────────────────────────────────────────────────────────────
  readonly compliance = {
    /** Run the pre-send compliance check (consent, STOP, DNC, quiet hours). */
    check: (body: Record<string, unknown>) => this.request("POST", "/api/functions/compliance-check", { body }),
    recordConsent: (body: Record<string, unknown>) => this.request("POST", "/api/functions/consent-record", { body }),
  };

  // ── Data privacy (CCPA / GDPR) ──────────────────────────────────────────────
  readonly privacy = {
    exportData: (body: Record<string, unknown>) => this.request("POST", "/api/functions/data-export", { body }),
    deleteData: (body: Record<string, unknown>) => this.request("POST", "/api/functions/data-deletion", { body }),
  };

  // ── Webhooks ──────────────────────────────────────────────────────────────
  readonly webhooks = {
    list: () => this.request("GET", "/api/webhook_endpoints"),
    create: (body: { url: string; events?: string[]; [k: string]: unknown }) =>
      this.request("POST", "/api/webhook_endpoints", { body }),
  };

  // ── API keys (admin; requires a dashboard JWT, not an API key) ───────────────
  readonly apiKeys = {
    create: (body: { property_id: string; name: string; scopes?: string[] }) =>
      this.request("POST", "/api/functions/create-api-key", { body }),
    list: (body: { property_id: string }) => this.request("POST", "/api/functions/list-api-keys", { body }),
    revoke: (body: { key_id: string }) => this.request("POST", "/api/functions/revoke-api-key", { body }),
  };
}

export default PlayerOS;
