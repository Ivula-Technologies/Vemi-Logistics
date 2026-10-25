/** Accepts 07XXXXXXXX, 01XXXXXXXX, +2547..., 2541... and returns 2547XXXXXXXX / 2541XXXXXXXX, or null. */
export function normalizeKenyanPhone(input: string | null | undefined) {
  const digits = (input ?? "").replace(/[\s()+.-]/g, "");
  let local: string | null = null;
  if (/^0[17]\d{8}$/.test(digits)) local = digits.slice(1);
  else if (/^254[17]\d{8}$/.test(digits)) local = digits.slice(3);
  else if (/^[17]\d{8}$/.test(digits)) local = digits;
  return local ? `254${local}` : null;
}

/** 254712345678 → 0712 345 678 */
export function displayPhone(phone: string | null | undefined) {
  if (!phone) return "";
  const local = phone.startsWith("254") ? `0${phone.slice(3)}` : phone;
  return local.length === 10 ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : local;
}

export function whatsappLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}
