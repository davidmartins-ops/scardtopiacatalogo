import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface CustomerProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  cpf?: string | null;
  phone?: string | null;
  address?: Record<string, unknown> | null;
}

// Shared across every component using this hook: one profile lookup per user
// per minute instead of one per component mount / token refresh.
const PROFILE_TTL = 60_000;
const profileCache = new Map<string, { at: number; p: Promise<CustomerProfile | null> }>();
const loadProfile = (userId: string, force = false) => {
  const hit = profileCache.get(userId);
  if (!force && hit && Date.now() - hit.at < PROFILE_TTL) return hit.p;
  const p = (async () => {
    const { data, error } = await supabase.from("customer_profiles").select("*").eq("id", userId).maybeSingle();
    if (error) { profileCache.delete(userId); return null; }
    return data as unknown as CustomerProfile | null;
  })();
  profileCache.set(userId, { at: Date.now(), p });
  return p;
};

export const useCustomerAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Exported: callers use it after editing the profile, so it always refetches.
  const fetchProfile = useCallback(async (userId: string) => {
    setProfile(await loadProfile(userId, true));
  }, []);

  useEffect(() => {
    let alive = true;
    const apply = (userId: string) => { void loadProfile(userId).then((p) => { if (alive) setProfile(p); }); };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const id = session.user.id;
          setTimeout(() => apply(id), 0);
        } else {
          profileCache.clear();
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) apply(session.user.id);
      setLoading(false);
    });

    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string, options?: { persist?: boolean }) => {
      const result = await supabase.auth.signInWithPassword({ email, password });
      // "Manter conectado": when persist=false, move token to sessionStorage so it
      // is cleared once the browser/tab is closed.
      if (!result.error && options?.persist === false) {
        try {
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          const key = `sb-${projectId}-auth-token`;
          const v = localStorage.getItem(key);
          if (v) {
            sessionStorage.setItem(key, v);
            localStorage.removeItem(key);
          }
        } catch {
          /* ignore */
        }
      }
      return result;
    },
    [],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  }, []);

  const resendConfirmationEmail = useCallback(async (email: string) => {
    return supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin },
    });
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, name: string) => {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin,
      },
    });
  }, []);

  return { session, user, profile, loading, signOut, signInWithEmail, signUpWithEmail, requestPasswordReset, resendConfirmationEmail, fetchProfile };
};
