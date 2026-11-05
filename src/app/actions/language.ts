"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LANG_COOKIE, asLang } from "@/lib/i18n";
import { safeNextPath } from "@/lib/utils";

/** Switches the app language for this person and goes back to the page they were on. */
export async function setLanguage(formData: FormData) {
  const lang = asLang(String(formData.get("lang") ?? ""));
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  revalidatePath("/", "layout");
  redirect(safeNextPath(formData.get("next")));
}
