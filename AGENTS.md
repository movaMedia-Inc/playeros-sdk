# AGENTS.md — PlayerOS SDK

Guidance for AI coding agents working in this repository or integrating PlayerOS.

## What this is

The official TypeScript/JavaScript SDK + CLI for **PlayerOS**, a casino marketing
platform for gaming operators (players, campaigns, journeys, compliance). This repo is
a thin, faithful client over the PlayerOS REST API — the API is the source of truth.

## Canonical references (prefer these over guessing)

- OpenAPI 3.1 spec: https://playeros.ai/openapi.json
- API docs (Markdown): https://playeros.ai/api-docs.md
- Auth ceremony: https://playeros.ai/auth.md
- Agent context: https://playeros.ai/llms.txt
- MCP server: https://api.playeros.ai/api/mcp (manifest: https://playeros.ai/.well-known/mcp.json)
- Protected-resource metadata: https://api.playeros.ai/.well-known/oauth-protected-resource

## Authentication

Property-scoped API keys (`pk_…`). Send `X-Api-Key: pk_…` (or `Authorization: Bearer pk_…`).
Keys carry `read`/`write` scopes and are bound to one property. Get one at
https://playeros.ai/dashboard/mcp. Never hardcode a key — read `PLAYEROS_API_KEY` from env.

## Using the SDK

```ts
import { PlayerOS } from "@playeros/sdk";
const playeros = new PlayerOS({ apiKey: process.env.PLAYEROS_API_KEY! });
const { data } = await playeros.players.list({ limit: 50 });
```

- Construct one client and reuse it; it is stateless.
- Mutating calls (`campaigns.sendEmail/sendSms`) accept `{ idempotencyKey }` — always
  pass a unique key so a retry never double-sends.
- Errors throw `PlayerOSError` with `.status`, `.code`, `.requestId`, `.retryAfter`.
  Retry `429` after `retryAfter`; do **not** retry `401`/`403` without fixing the credential.
- Respect the returned `rateLimit` (`X-RateLimit-*`) hints.

## Working in this repo

- Source is `src/index.ts` (SDK) and `src/cli.ts` (CLI). Build with `npm run build` (tsc → `dist/`).
- Typecheck only: `npm run typecheck`.
- Zero runtime dependencies — keep it that way; the SDK must run on Node 18+ with built-in `fetch`.
- When the API gains an operation, mirror it from the OpenAPI spec: add a method under the
  matching resource group in `src/index.ts`, then a CLI case in `src/cli.ts`, then docs.
- Do not invent endpoints or fields; verify against https://playeros.ai/openapi.json.

## Safety

- This SDK can send real messages to real players and delete data. Treat `campaigns.*`,
  `players.delete`, and `privacy.deleteData` as destructive — confirm intent before running.
- Every send runs a server-side TCPA/CCPA/GDPR pre-send compliance check; do not attempt
  to bypass it.
