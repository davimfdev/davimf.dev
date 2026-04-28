import { Context } from '@netlify/functions';

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
    return new Response(JSON.stringify({ error: "ABACATEPAY_KEY not set" }), { status: 500 });
  }

  let body: { plan?: string; period?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const { plan, period } = body;

  if (!plan || !period || !PRODUCT_ENV_KEY[plan]?.[period]) {
    return new Response(JSON.stringify({ error: `Invalid plan="${plan}" or period="${period}"` }), { status: 400 });
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

  // Create AbacatePay checkout
  let checkoutUrl: string;
  let checkoutId: string;
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

    const rawText = await res.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("[abacate-checkout] Non-JSON response:", rawText.slice(0, 500));
      return new Response(JSON.stringify({ error: "AbacatePay returned invalid response" }), { status: 502 });
    }

    console.log("[abacate-checkout] AbacatePay response:", JSON.stringify(data));

    if (!data.success) {
      return new Response(JSON.stringify({ error: data.error || "AbacatePay checkout failed" }), { status: 502 });
    }

    checkoutUrl = data.data.url;
    checkoutId = data.data.id;
  } catch (err: any) {
    console.error("[abacate-checkout] Fetch error:", err);
    return new Response(JSON.stringify({ error: `Network error: ${err.message}` }), { status: 502 });
  }

  // Persist order — non-fatal if DB fails
  try {
    const { sql } = await import('./lib/fmm-license.js');
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
  } catch (err: any) {
    console.error("[abacate-checkout] DB error (non-fatal):", err);
  }

  return new Response(JSON.stringify({ url: checkoutUrl }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
