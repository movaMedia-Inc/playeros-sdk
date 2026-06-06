#!/usr/bin/env node
/**
 * PlayerOS CLI — script the PlayerOS API from a terminal or an agent.
 *
 *   export PLAYEROS_API_KEY=pk_live_…
 *   playeros players list --limit 25
 *   playeros players get <id>
 *   playeros players create --data '{"email":"vip@example.com","tier":"Gold"}'
 *   playeros campaigns send <campaignId> --property <propertyId>
 *   playeros compliance check --data '{"propertyId":"…","playerId":"…","channel":"sms"}'
 *
 * Output is JSON on stdout (pipe to `jq`). Errors go to stderr; exit code is
 * non-zero on failure. Zero runtime dependencies.
 */
import { PlayerOS, PlayerOSError, SDK_VERSION } from "./index.js";

interface Parsed {
  _: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Parsed {
  const _: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else {
        flags[key] = next;
        i++;
      }
    } else {
      _.push(a);
    }
  }
  return { _, flags };
}

const HELP = `PlayerOS CLI v${SDK_VERSION}

Usage: playeros <resource> <action> [args] [--flags]

Auth: set PLAYEROS_API_KEY=pk_… (or pass --api-key pk_…)

Resources & actions:
  players list [--limit N] [--offset N] [--q text]
  players get <id>
  players create --data '<json>'
  players update <id> --data '<json>'
  players delete <id>
  campaigns send <campaignId> --property <propertyId> [--idempotency-key <k>]
  campaigns send-sms <campaignId> --property <propertyId> [--idempotency-key <k>]
  compliance check --data '<json>'
  compliance record-consent --data '<json>'
  privacy export --data '<json>'
  webhooks list
  webhooks create --url <url> [--events a,b,c]

Global flags:
  --api-key <key>   Override PLAYEROS_API_KEY
  --base-url <url>  Override the API base URL
  --help, -v/--version
`;

function out(v: unknown): void {
  process.stdout.write(JSON.stringify(v, null, 2) + "\n");
}
function fail(msg: string, code = 1): never {
  process.stderr.write(msg + "\n");
  process.exit(code);
}
function jsonFlag(flags: Record<string, string | boolean>, name: string): Record<string, unknown> {
  const v = flags[name];
  if (typeof v !== "string") fail(`--${name} '<json>' is required`);
  try {
    return JSON.parse(v as string);
  } catch (e) {
    return fail(`--${name} is not valid JSON: ${(e as Error).message}`);
  }
}

async function main(): Promise<void> {
  const { _, flags } = parseArgs(process.argv.slice(2));
  if (flags.version || flags.v) return out({ version: SDK_VERSION });
  if (flags.help || _.length === 0) {
    process.stdout.write(HELP);
    return;
  }

  const apiKey = (flags["api-key"] as string) || process.env.PLAYEROS_API_KEY;
  if (!apiKey) fail("No API key. Set PLAYEROS_API_KEY or pass --api-key. Get one at https://playeros.ai/dashboard/mcp");
  const client = new PlayerOS({ apiKey, baseUrl: (flags["base-url"] as string) || undefined });
  const idempotencyKey = flags["idempotency-key"] as string | undefined;

  const [resource, action, arg] = _;
  const key = `${resource} ${action}`;

  switch (key) {
    case "players list":
      return out((await client.players.list({ limit: numFlag(flags, "limit"), offset: numFlag(flags, "offset"), q: flags.q as string })).data);
    case "players get":
      return out((await client.players.get(need(arg, "id"))).data);
    case "players create":
      return out((await client.players.create(jsonFlag(flags, "data"))).data);
    case "players update":
      return out((await client.players.update(need(arg, "id"), jsonFlag(flags, "data"))).data);
    case "players delete":
      await client.players.delete(need(arg, "id"));
      return out({ deleted: arg });
    case "campaigns send":
      return out((await client.campaigns.sendEmail({ campaignId: need(arg, "campaignId"), propertyId: needFlag(flags, "property") }, { idempotencyKey })).data);
    case "campaigns send-sms":
      return out((await client.campaigns.sendSms({ campaignId: need(arg, "campaignId"), propertyId: needFlag(flags, "property") }, { idempotencyKey })).data);
    case "compliance check":
      return out((await client.compliance.check(jsonFlag(flags, "data"))).data);
    case "compliance record-consent":
      return out((await client.compliance.recordConsent(jsonFlag(flags, "data"))).data);
    case "privacy export":
      return out((await client.privacy.exportData(jsonFlag(flags, "data"))).data);
    case "webhooks list":
      return out((await client.webhooks.list()).data);
    case "webhooks create":
      return out((await client.webhooks.create({ url: needFlag(flags, "url"), events: (flags.events as string)?.split(",") })).data);
    default:
      fail(`Unknown command: ${key}\n\n${HELP}`);
  }
}

function need(v: string | undefined, name: string): string {
  if (!v) fail(`Missing argument: <${name}>`);
  return v as string;
}
function needFlag(flags: Record<string, string | boolean>, name: string): string {
  const v = flags[name];
  if (typeof v !== "string") fail(`--${name} is required`);
  return v;
}
function numFlag(flags: Record<string, string | boolean>, name: string): number | undefined {
  const v = flags[name];
  return typeof v === "string" ? Number(v) : undefined;
}

main().catch((e: unknown) => {
  if (e instanceof PlayerOSError) {
    fail(JSON.stringify({ error: e.code || e.message, status: e.status, requestId: e.requestId, body: e.body }, null, 2), 1);
  }
  fail(String((e as Error)?.message || e), 1);
});
