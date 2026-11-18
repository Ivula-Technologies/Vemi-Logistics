import Link from "next/link";
import { GoogleButton, LoginForm, PhoneLogin } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { phoneLoginConfigured } from "@/lib/phone-login";
import { t, type AppLang } from "@/lib/i18n";
import { PORTAL, type Portal } from "@/lib/portal";

const link = "font-semibold text-primary underline-offset-4 hover:underline";

/** The other front door, under each form: customers who own trucks go to Partner, and the other way round. */
function OtherPortal({ portal, lang }: { portal: Portal; lang: AppLang }) {
  const partner = portal === "partner";
  return <p className="mt-3 rounded-lg border bg-card px-3 py-2.5 text-center text-sm text-muted-foreground">
    {t(lang, partner ? "auth.needTruck" : "auth.ownTrucks")}{" "}
    <Link href={partner ? PORTAL.customer.home : PORTAL.partner.home} className={link}>{t(lang, partner ? "auth.toCustomer" : "auth.toPartner")}</Link>
  </p>;
}

export function LoginPanel({ portal, lang, next, error }: { portal: Portal; lang: AppLang; next?: string; error?: string }) {
  return <div>
    <h1 className="text-2xl font-bold">{t(lang, "auth.welcomeBack")}</h1>
    <p className="mt-1 text-sm text-muted-foreground">{t(lang, portal === "partner" ? "auth.partnerSignInIntro" : "auth.signInIntro")}</p>
    {error ? <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
    {process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "on" ? <GoogleButton next={next} label={t(lang, "auth.google")} lang={lang} /> : null}
    {phoneLoginConfigured() ? <PhoneLogin next={next} lang={lang} /> : null}
    <LoginForm next={next} lang={lang} />
    <p className="mt-6 text-center text-sm text-muted-foreground">{t(lang, "auth.newHere")} <Link href={PORTAL[portal].signup} className={link}>{t(lang, portal === "partner" ? "auth.partnerJoin" : "auth.createFree")}</Link></p>
    <OtherPortal portal={portal} lang={lang} />
  </div>;
}

export function SignupPanel({ portal, lang, referral, next }: { portal: Portal; lang: AppLang; referral?: string; next?: string }) {
  const partner = portal === "partner";
  return <div>
    <h1 className="text-2xl font-bold">{t(lang, partner ? "auth.partnerJoin" : "auth.join")}</h1>
    <p className="mt-1 text-sm text-muted-foreground">{t(lang, partner ? "auth.partnerJoinIntro" : "auth.customerJoinIntro")}</p>
    {process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "on" ? <GoogleButton next="/welcome" referral={referral} label={t(lang, "auth.googleSignup")} lang={lang} /> : null}
    <SignupForm fixedRole={partner ? "carrier" : "shipper"} referral={referral} next={next?.startsWith("/join/") ? next : undefined} lang={lang} />
    <p className="mt-6 text-center text-sm text-muted-foreground">{t(lang, "auth.already")} <Link href={PORTAL[portal].login} className={link}>{t(lang, "auth.signIn")}</Link></p>
    <OtherPortal portal={portal} lang={lang} />
  </div>;
}

export function cleanReferral(ref?: string) {
  return ref?.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 7) || undefined;
}
