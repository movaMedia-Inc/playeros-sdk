/**
 * Compliance-check then send a campaign with a safe-retry idempotency key.
 *   PLAYEROS_API_KEY=pk_… npx tsx examples/send-campaign.ts <campaignId> <propertyId>
 */
import { randomUUID } from "node:crypto";
import { PlayerOS, PlayerOSError } from "@playeros/sdk";

const [campaignId, propertyId] = process.argv.slice(2);
if (!campaignId || !propertyId) {
  console.error("usage: send-campaign.ts <campaignId> <propertyId>");
  process.exit(1);
}

const playeros = new PlayerOS({ apiKey: process.env.PLAYEROS_API_KEY! });
const idempotencyKey = randomUUID(); // reuse this exact key if you retry

async function sendWithRetry(attempt = 1): Promise<void> {
  try {
    const { data, idempotencyReplayed } = await playeros.campaigns.sendEmail(
      { campaignId, propertyId },
      { idempotencyKey }
    );
    console.log(idempotencyReplayed ? "Replayed (no double-send):" : "Sent:", data);
  } catch (e) {
    if (e instanceof PlayerOSError && e.status === 429 && attempt <= 3) {
      const wait = (e.retryAfter ?? 2) * 1000;
      console.warn(`Rate limited; retrying in ${wait}ms…`);
      await new Promise((r) => setTimeout(r, wait));
      return sendWithRetry(attempt + 1);
    }
    throw e;
  }
}

sendWithRetry();
