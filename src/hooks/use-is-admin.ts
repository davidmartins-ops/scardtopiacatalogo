import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Verifica no backend (função SECURITY DEFINER `has_role`) se o usuário
 * autenticado possui a role de administrador.
 * A checagem nunca confia em dados locais: sem sessão válida => false.
 */
export const useIsAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        if (active) { setIsAdmin(false); setLoading(false); }
        return;
      }
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      if (active) {
        setIsAdmin(!error && data === true);
        setLoading(false);
      }
    };

    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      setTimeout(check, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, loading };
};
