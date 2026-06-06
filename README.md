# PlayerOS SDK

Official TypeScript/JavaScript SDK **and CLI** for the [PlayerOS](https://playeros.ai)
API — the casino marketing platform for gaming operators (unified player database,
multi-channel campaigns, journey automation, and TCPA/CCPA/GDPR compliance).

- **Docs:** https://playeros.ai/api-docs · [Markdown](https://playeros.ai/api-docs.md)
- **OpenAPI 3.1:** https://playeros.ai/openapi.json
- **MCP server (for AI agents):** https://api.playeros.ai/api/mcp · [manifest](https://playeros.ai/.well-known/mcp.json)
- **Auth guide:** https://playeros.ai/auth.md

Zero runtime dependencies. Node 18+ (uses built-in `fetch`).

## Install

```bash
npm install @playeros/sdk
```

## Authenticate

Create a **property-scoped API key** (`pk_…`) in **Settings → API & MCP**
(https://playeros.ai/dashboard/mcp). Keys carry `read` and/or `write` scopes and are
bound to one property. Send it as `X-Api-Key` (the SDK does this for you).

## Quickstart

```ts
import { PlayerOS } from "@playeros/sdk";

const playeros = new PlayerOS({ apiKey: process.env.PLAYEROS_API_KEY! });

// List players
const { data: players, totalCount } = await playeros.players.list({ limit: 50, q: "gold" });

// Create a player (gaming-native fields)
await playeros.players.create({ email: "vip@example.com", tier: "Gold", adt: 250, coin_in: 18000 });

// Send a campaign — pass an idempotencyKey so retries never double-send
await playeros.campaigns.sendEmail(
  { campaignId: "…", propertyId: "…" },
  { idempotencyKey: crypto.randomUUID() }
);
```

## Resources

| Group | Methods |
|---|---|
| `players` | `list`, `get`, `create`, `update`, `delete`, `validateBatch` |
| `validationJobs` | `get` (poll an async batch job) |
| `campaigns` | `sendEmail`, `sendSms` (both accept `{ idempotencyKey }`) |
| `compliance` | `check`, `recordConsent` |
| `privacy` | `exportData`, `deleteData` (CCPA / GDPR) |
| `webhooks` | `list`, `create` |
| `apiKeys` | `create`, `list`, `revoke` (admin; needs a dashboard JWT) |

Every call returns `{ data, status, requestId, totalCount?, rateLimit, idempotencyReplayed? }`.

## Errors

Non-2xx responses throw `PlayerOSError` with a stable `.code` you can branch on:

```ts
import { PlayerOSError } from "@playeros/sdk";

try {
  await playeros.players.create({ /* … */ });
} catch (e) {
  if (e instanceof PlayerOSError) {
    if (e.code === "insufficient_scope") { /* use a write-scoped key */ }
    if (e.status === 429) await sleep((e.retryAfter ?? 1) * 1000); // then retry
    console.error(e.status, e.code, e.requestId);
  }
}
```

Honor the `rateLimit` (`X-RateLimit-*`) hints and back off on `429`.

## CLI

The package ships a `playeros` command:

```bash
export PLAYEROS_API_KEY=pk_live_…

playeros players list --limit 25
playeros players get <id>
playeros players create --data '{"email":"vip@example.com","tier":"Gold"}'
playeros campaigns send <campaignId> --property <propertyId> --idempotency-key $(uuidgen)
playeros compliance check --data '{"propertyId":"…","playerId":"…","channel":"sms"}'
playeros --help
```

Output is JSON on stdout — pipe to `jq`. Run one-off without installing: `npx @playeros/sdk --help`.

## For AI agents

See [AGENTS.md](./AGENTS.md). PlayerOS also exposes a [Model Context Protocol](https://modelcontextprotocol.io)
server at `https://api.playeros.ai/api/mcp` with 25 tools and discoverable resources.

## License

MIT © PlayerOS
