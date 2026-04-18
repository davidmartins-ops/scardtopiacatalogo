import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuthorization = async (userSession: Session | null) => {
    if (!userSession?.user?.id) {
      setSession(null);
      setLoading(false);
      return;
    }

    const { data: roleRow, error } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userSession.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!error && roleRow) {
      setSession(userSession);
    } else {
      await supabase.auth.signOut();
      setSession(null);
      toast.error("Acesso negado. Sua conta não tem permissão de administrador.");
    }
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          // Defer to avoid deadlocks inside the auth callback
          setTimeout(() => checkAuthorization(session), 0);
        } else {
          setSession(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkAuthorization(session);
      } else {
        setSession(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, loading, signOut };
};
