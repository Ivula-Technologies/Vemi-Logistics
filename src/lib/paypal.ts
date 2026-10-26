import "server-only";

/** PayPal Checkout (Orders v2) for cards and PayPal, priced in USD. Same account setup as the other Ivula apps. */

function baseUrl() {
  return process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PayPal is not configured.");
  const response = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!response.ok || !data?.access_token) throw new Error("Could not sign in to PayPal. Check the client ID and secret.");
  cachedToken = { value: data.access_token, expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000 };
  return data.access_token;
}

async function paypal<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}) {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...(init.idempotencyKey ? { "PayPal-Request-Id": init.idempotencyKey } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as T | null;
  return { status: response.status, data };
}

/** KES to USD at the rate ops set, rounded up to the cent so Vemi never collects less. */
export function kesToUsd(kes: number, rate: number) {
  return Math.ceil((kes / rate) * 100) / 100;
}

type Order = {
  id: string;
  status: string;
  links?: { href: string; rel: string }[];
  purchase_units?: { custom_id?: string; payments?: { captures?: { id: string; status: string; amount: { value: string; currency_code: string } }[] } }[];
  message?: string;
};

export async function createOrder(options: { usd: number; customId: string; description: string; returnUrl: string; cancelUrl: string; requestId: string }) {
  const { status, data } = await paypal<Order>("/v2/checkout/orders", {
    method: "POST",
    idempotencyKey: options.requestId,
    body: {
      intent: "CAPTURE",
      purchase_units: [{ custom_id: options.customId, description: options.description.slice(0, 127), amount: { currency_code: "USD", value: options.usd.toFixed(2) } }],
      payment_source: { paypal: { experience_context: { brand_name: "Vemi Logistics", user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", return_url: options.returnUrl, cancel_url: options.cancelUrl } } },
    },
  });
  const approve = data?.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
  if (status >= 300 || !data?.id || !approve) throw new Error(data?.message ?? "PayPal could not start the payment.");
  return { id: data.id, approveUrl: approve };
}

/** Captures an approved order. PayPal is asked directly, so the result never depends on what the browser claimed. */
export async function captureOrder(orderId: string) {
  if (!/^[A-Z0-9]{10,30}$/.test(orderId)) return null;
  const { data } = await paypal<Order>(`/v2/checkout/orders/${orderId}/capture`, { method: "POST", body: {}, idempotencyKey: `capture-${orderId}` });
  let order = data;
  // Already captured (for example a refreshed return page): read the order instead.
  if (!order?.purchase_units?.[0]?.payments?.captures?.length) order = (await paypal<Order>(`/v2/checkout/orders/${orderId}`)).data;
  const capture = order?.purchase_units?.[0]?.payments?.captures?.[0];
  if (!order || order.status !== "COMPLETED" || !capture || capture.status !== "COMPLETED" || capture.amount.currency_code !== "USD") return null;
  return { captureId: capture.id, usd: Number(capture.amount.value), customId: order.purchase_units?.[0]?.custom_id ?? null, raw: order };
}
