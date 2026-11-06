import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE, asLang, type AppLang } from "@/lib/i18n";

/** The language this person chose (English until they switch). */
export async function getLang(): Promise<AppLang> {
  return asLang((await cookies()).get(LANG_COOKIE)?.value);
}
