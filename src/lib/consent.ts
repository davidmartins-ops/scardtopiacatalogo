import { supabase } from "@/integrations/supabase/client";

export type CookiePrefs = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
};

const STORAGE_KEY = "scardtopia.cookie_consent.v1";
const SESSION_KEY = "scardtopia.session_id";
export const POLICY_VERSION = "v1";

export function getSessionId(): string {
  let sid = localStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export function getStoredConsent(): CookiePrefs | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.policy_version !== POLICY_VERSION) return null;
    return {
      essential: true,
      analytics: !!parsed.analytics,
      marketing: !!parsed.marketing,
    };
  } catch {
    return null;
  }
}

export async function saveConsent(prefs: CookiePrefs, source: "banner" | "settings" = "banner") {
  const payload = { ...prefs, policy_version: POLICY_VERSION, saved_at: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  // Notifica o Google Consent Mode (gtag) sobre a mudança
  try {
    window.dispatchEvent(new CustomEvent("scardtopia:consent-updated", { detail: prefs }));
  } catch {}

  // Persistir no banco para auditoria LGPD
  try {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("cookie_consents").insert({
      user_id: userData?.user?.id ?? null,
      session_id: getSessionId(),
      essential: true,
      analytics: prefs.analytics,
      marketing: prefs.marketing,
      policy_version: POLICY_VERSION,
      user_agent: navigator.userAgent.slice(0, 500),
      source,
    });
  } catch (err) {
    console.warn("[consent] failed to persist consent:", err);
  }
}

export function hasAnalyticsConsent(): boolean {
  return getStoredConsent()?.analytics === true;
}
