import { Context } from '@netlify/functions';
import { sql } from './lib/fmm-license.js';

const ABACATE_BASE = "https://api.abacatepay.com/v2";

const PRODUCT_ENV_KEY: Record<string, Record<string, string>> = {
  basic: {
    monthly:   "FMM_BASIC_MONTHLY_PRODUCT_ID",
    quarterly: "FMM_BASIC_QUARTERLY_PRODUCT_ID",
    lifetime:  "FMM_BASIC_LIFETIME_PRODUCT_ID",
  },
  pro: {
    monthly:   "FMM_PRO_MONTHLY_PRODUCT_ID",
    quarterly: "FMM_PRO_QUARTERLY_PRODUCT_ID",
    lifetime:  "FMM_PRO_LIFETIME_PRODUCT_ID",
  },
};

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 });
  }

  const apiKey = process.env.ABACATEPAY_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Payment not configured" }), { status: 500 });
  }

  const { plan, period } = await req.json();

  if (!PRODUCT_ENV_KEY[plan]?.[period]) {
    return new Response(JSON.stringify({ error: "Invalid plan or period" }), { status: 400 });
  }

  const productId = process.env[PRODUCT_ENV_KEY[plan][period]];
  if (!productId) {
    return new Response(
      JSON.stringify({ error: `Env var ${PRODUCT_ENV_KEY[plan][period]} not set` }),
      { status: 503 }
    );
  }

  const ref = crypto.randomUUID();
  const baseUrl = process.env.URL || "http://localhost:8888";
  const completionUrl = `${baseUrl}/fmm-activated?ref=${ref}`;

  try {
    const res = await fetch(`${ABACATE_BASE}/checkouts/create`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ id: productId, quantity: 1 }],
        externalId: ref,
        completionUrl,
      }),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || "AbacatePay error");

    const checkoutId = data.data.id;

    await sql`
      CREATE TABLE IF NOT EXISTS fmm_orders (
        ref TEXT PRIMARY KEY,
        abacate_checkout_id TEXT NOT NULL,
        plan TEXT NOT NULL,
        period TEXT NOT NULL,
        license_key TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      INSERT INTO fmm_orders (ref, abacate_checkout_id, plan, period)
      VALUES (${ref}, ${checkoutId}, ${plan}, ${period})
    `;

    return new Response(JSON.stringify({ url: data.data.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal Server Error" }),
      { status: 500 }
    );
  }
};
