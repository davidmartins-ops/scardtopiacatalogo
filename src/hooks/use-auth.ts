import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuthorization = async (userSession: Session | null) => {
    if (!userSession?.user?.email) {
      setSession(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("authorized_emails")
      .select("email")
      .eq("email", userSession.user.email)
      .maybeSingle();

    if (data) {
      setSession(userSession);
    } else {
      await supabase.auth.signOut();
      setSession(null);
      toast.error("Acesso negado. Seu email não está autorizado.");
    }
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          checkAuthorization(session);
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
