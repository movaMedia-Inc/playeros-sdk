/**
 * List players, handling pagination and rate limits.
 *   PLAYEROS_API_KEY=pk_… npx tsx examples/list-players.ts
 */
import { PlayerOS, PlayerOSError } from "@playeros/sdk";

const playeros = new PlayerOS({ apiKey: process.env.PLAYEROS_API_KEY! });

async function main() {
  try {
    const { data, totalCount, rateLimit } = await playeros.players.list({ limit: 25, q: "gold" });
    console.log(`Showing ${data.length} of ${totalCount ?? "?"} players`);
    for (const p of data) console.log(`- ${p.email ?? p.id} (tier ${p.tier ?? "—"})`);
    console.log("Rate limit remaining:", rateLimit.remaining);
  } catch (e) {
    if (e instanceof PlayerOSError) console.error(`API error ${e.status} ${e.code} (req ${e.requestId})`);
    else throw e;
  }
}

main();
