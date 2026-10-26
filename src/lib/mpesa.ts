import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Safaricom Daraja STK Push ("Lipa na M-Pesa Online"), the same integration as the other Ivula apps. */

function baseUrl() {
  return process.env.MPESA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
}

export function mpesaConfigured() {
  const env = process.env;
  return Boolean(env.MPESA_CONSUMER_KEY && env.MPESA_CONSUMER_SECRET && env.MPESA_SHORTCODE && env.MPESA_PASSKEY && env.MPESA_CALLBACK_SECRET);
}

function config() {
  const env = process.env;
  const shortcode = env.MPESA_SHORTCODE;
  const passkey = env.MPESA_PASSKEY;
  if (!env.MPESA_CONSUMER_KEY || !env.MPESA_CONSUMER_SECRET || !shortcode || !passkey) throw new Error("M-Pesa is not configured.");
  const transactionType = env.MPESA_TRANSACTION_TYPE === "CustomerBuyGoodsOnline" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline";
  // For a Till (Buy Goods), PartyB is the till number while the shortcode is the store number.
  return { key: env.MPESA_CONSUMER_KEY, secret: env.MPESA_CONSUMER_SECRET, shortcode, passkey, transactionType, partyB: env.MPESA_PARTY_B || shortcode };
}

/** Daraja expects the timestamp in Kenyan time (UTC+3, no daylight saving) as YYYYMMDDHHmmss. */
export function darajaTimestamp(now = new Date()) {
  return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().replace(/[-:TZ]/g, "").slice(0, 14);
}

function password(shortcode: string, passkey: string, time: string) {
  return Buffer.from(`${shortcode}${passkey}${time}`).toString("base64");
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const { key, secret } = config();
  const response = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: string | number } | null;
  if (!response.ok || !data?.access_token) throw new Error("Could not sign in to M-Pesa. Check the consumer key and secret.");
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in ?? 3599) - 60) * 1000 };
  return data.access_token;
}

export type StkPushResult = { merchantRequestId: string; checkoutRequestId: string; customerMessage: string };

export async function stkPush(options: { phone: string; amount: number; callbackUrl: string; reference: string; description: string }): Promise<StkPushResult> {
  const { shortcode, passkey, transactionType, partyB } = config();
  const time = darajaTimestamp();
  const response = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password(shortcode, passkey, time),
      Timestamp: time,
      TransactionType: transactionType,
      Amount: options.amount,
      PartyA: options.phone,
      PartyB: partyB,
      PhoneNumber: options.phone,
      CallBackURL: options.callbackUrl,
      AccountReference: options.reference.slice(0, 12),
      TransactionDesc: options.description.slice(0, 13),
    }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as Record<string, string> | null;
  if (!response.ok || data?.ResponseCode !== "0" || !data.CheckoutRequestID) {
    throw new Error(data?.errorMessage ?? data?.ResponseDescription ?? "M-Pesa could not send the payment prompt.");
  }
  return { merchantRequestId: data.MerchantRequestID, checkoutRequestId: data.CheckoutRequestID, customerMessage: data.CustomerMessage ?? "Check your phone to enter your M-Pesa PIN." };
}

export type StkQueryResult = { state: "paid" | "failed" | "pending"; description: string };

/** Asks Safaricom for the outcome of a prompt, for when the callback is slow or never arrives. */
export async function stkQuery(checkoutRequestId: string): Promise<StkQueryResult> {
  const { shortcode, passkey } = config();
  const time = darajaTimestamp();
  const response = await fetch(`${baseUrl()}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ BusinessShortCode: shortcode, Password: password(shortcode, passkey, time), Timestamp: time, CheckoutRequestID: checkoutRequestId }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as Record<string, string> | null;
  // While the customer has not answered yet, Daraja replies with an error such as 500.001.1001.
  if (!data || data.ResultCode === undefined) return { state: "pending", description: data?.errorMessage ?? "Waiting for the customer." };
  if (String(data.ResultCode) === "0") return { state: "paid", description: data.ResultDesc ?? "Paid" };
  return { state: "failed", description: data.ResultDesc ?? "The payment was not completed." };
}

export type StkCallback = {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: number | string;
  ResultDesc?: string;
  CallbackMetadata?: { Item?: Array<{ Name: string; Value?: string | number }> };
};

export function callbackItem(callback: StkCallback, name: string) {
  return callback.CallbackMetadata?.Item?.find((item) => item.Name === name)?.Value;
}

// ---------------------------------------------------------------------------------------------
// B2C: Vemi pays carriers and wallet cash-outs straight to M-Pesa (needs a B2C shortcode from Safaricom).
// ---------------------------------------------------------------------------------------------

export function b2cConfigured() {
  const env = process.env;
  return Boolean(env.MPESA_B2C_SHORTCODE && env.MPESA_B2C_INITIATOR && env.MPESA_B2C_SECURITY_CREDENTIAL && (env.MPESA_B2C_CONSUMER_KEY || env.MPESA_CONSUMER_KEY) && env.MPESA_CALLBACK_SECRET);
}

let cachedB2cToken: { value: string; expiresAt: number } | null = null;

async function b2cToken() {
  if (cachedB2cToken && cachedB2cToken.expiresAt > Date.now()) return cachedB2cToken.value;
  const key = process.env.MPESA_B2C_CONSUMER_KEY || process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_B2C_CONSUMER_SECRET || process.env.MPESA_CONSUMER_SECRET;
  const response = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: string | number } | null;
  if (!response.ok || !data?.access_token) throw new Error("Could not sign in to M-Pesa B2C.");
  cachedB2cToken = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in ?? 3599) - 60) * 1000 };
  return data.access_token;
}

/** Sends money to a phone. conversationId is ours (OriginatorConversationID) and comes back in the result. */
export async function b2cPay(options: { phone: string; amount: number; conversationId: string; remarks: string; resultUrl: string; timeoutUrl: string }) {
  const response = await fetch(`${baseUrl()}/mpesa/b2c/v3/paymentrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await b2cToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      OriginatorConversationID: options.conversationId,
      InitiatorName: process.env.MPESA_B2C_INITIATOR,
      SecurityCredential: process.env.MPESA_B2C_SECURITY_CREDENTIAL,
      CommandID: "BusinessPayment",
      Amount: options.amount,
      PartyA: process.env.MPESA_B2C_SHORTCODE,
      PartyB: options.phone,
      Remarks: options.remarks.slice(0, 100),
      QueueTimeOutURL: options.timeoutUrl,
      ResultURL: options.resultUrl,
      Occasion: "Vemi",
    }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as Record<string, string> | null;
  if (!response.ok || data?.ResponseCode !== "0") throw new Error(data?.errorMessage ?? data?.ResponseDescription ?? "M-Pesa did not accept the payout.");
  return data;
}

export type B2cResult = {
  Result?: {
    ResultCode?: number | string;
    ResultDesc?: string;
    OriginatorConversationID?: string;
    TransactionID?: string;
  };
};

/** Safaricom callbacks carry our secret in ?token= (Daraja has no signature). */
export function callbackTokenMatches(token: string | null) {
  const expected = process.env.MPESA_CALLBACK_SECRET;
  if (!expected || !token) return false;
  const a = Buffer.from(token); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
