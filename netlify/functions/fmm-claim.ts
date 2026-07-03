import { Context } from '@netlify/functions';
import {
  sql, generateKeyString, sha256Hex, jsonResponse, errorResponse,
} from './lib/fmm-license.js';

const ABACATE_BASE = "https://api.abacatepay.com/v2";

const DURATION_DAYS: Record<string, number> = {
  monthly:   30,
  quarterly: 90,
  lifetime:  36500,
};

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") return errorResponse("Method Not Allowed", 405);

  const ref = new URL(req.url).searchParams.get("ref");
  if (!ref) return errorResponse("Missing ref", 400);

  const rows = await sql`
    SELECT abacate_checkout_id, plan, period, license_key
    FROM fmm_orders
    WHERE ref = ${ref}
    LIMIT 1
  ` as Array<{
    abacate_checkout_id: string;
    plan: string;
    period: string;
    license_key: string | null;
  }>;

  if (!rows.length) return errorResponse("Order not found", 404);

  const order = rows[0];

  if (order.license_key) {
    return jsonResponse({ key: order.license_key, plan: order.plan, period: order.period });
  }

  const apiKey = process.env.ABACATEPAY_KEY;
  if (!apiKey) return errorResponse("Payment not configured", 500);

  const res = await fetch(`${ABACATE_BASE}/checkouts/list`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });

  const data = await res.json();
  if (!data.success) return errorResponse("Failed to verify payment", 502);

  const checkout = (data.data as any[]).find(
    (c) => c.id === order.abacate_checkout_id || c.externalId === ref
  );
  if (!checkout) return jsonResponse({ status: "PENDING" });

  const status = checkout.status;

  if (status !== "PAID") {
    return jsonResponse({ status: status ?? "PENDING" });
  }

  // Payment confirmed — generate key
  const rawKey = generateKeyString();
  const keyHash = sha256Hex(rawKey);
  const keyPrefix = rawKey.substring(0, 12);
  const durationDays = DURATION_DAYS[order.period] ?? 30;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);

  const authHeader = req.headers.get('authorization');
  let discordUserId: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const discordRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: authHeader },
      });
      if (discordRes.ok) {
        const u = await discordRes.json();
        discordUserId = u.id ?? null;
      }
    } catch { /* non-fatal */ }
  }

  await sql`
    INSERT INTO fmm_license_keys (key_hash, key_prefix, level, duration_days, expires_at, notes, discord_user_id)
    VALUES (
      ${keyHash}, ${keyPrefix}, ${order.plan}, ${durationDays},
      ${expiresAt.toISOString()},
      ${`Auto-generated via AbacatePay checkout ${order.abacate_checkout_id}`},
      ${discordUserId}
    )
  `;

  await sql`
    UPDATE fmm_orders SET license_key = ${rawKey} WHERE ref = ${ref}
  `;

  return jsonResponse({ key: rawKey, plan: order.plan, period: order.period });
};
