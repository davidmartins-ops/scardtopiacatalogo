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

export const useCustomerAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("customer_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data as unknown as CustomerProfile | null);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

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

  return { session, user, profile, loading, signOut, signInWithEmail, signUpWithEmail, requestPasswordReset, fetchProfile };
};
