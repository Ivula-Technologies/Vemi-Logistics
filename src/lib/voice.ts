import "server-only";

/**
 * Masked calls through an Africa's Talking voice number: Vemi rings the caller, and when they answer,
 * connects them to the other person. Each side sees only the Vemi number.
 */

export function voiceConfigured() {
  return Boolean(process.env.AT_USERNAME && process.env.AT_API_KEY && process.env.AT_VOICE_NUMBER && process.env.AT_VOICE_CALLBACK_SECRET);
}

export async function startMaskedCall(callerPhone: string, callId: string) {
  const username = process.env.AT_USERNAME!;
  const host = username === "sandbox" ? "https://voice.sandbox.africastalking.com" : "https://voice.africastalking.com";
  const body = new URLSearchParams({ username, from: process.env.AT_VOICE_NUMBER!, to: `+${callerPhone.replace(/^\+/, "")}`, clientRequestId: callId });
  const response = await fetch(`${host}/call`, {
    method: "POST",
    headers: { apiKey: process.env.AT_API_KEY!, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json().catch(() => null)) as { entries?: { status?: string; sessionId?: string }[]; errorMessage?: string } | null;
  const entry = data?.entries?.[0];
  if (!response.ok || !entry || entry.status !== "Queued") throw new Error(data?.errorMessage ?? "The call could not be started.");
  return entry.sessionId ?? null;
}

function xmlEscape(value: string) {
  return value.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

/** What Africa's Talking plays when the caller picks up. */
export function dialXml(callee: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Connecting your Vemi call.</Say><Dial phoneNumbers="${xmlEscape(`+${callee.replace(/^\+/, "")}`)}" record="false" sequential="true"/></Response>`;
}

export function hangupXml(message: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${xmlEscape(message)}</Say><Reject/></Response>`;
}
