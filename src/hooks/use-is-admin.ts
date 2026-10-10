import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Verifica no backend (função SECURITY DEFINER `has_role`) se o usuário
 * autenticado possui a role de administrador.
 * A checagem nunca confia em dados locais: sem sessão válida => false.
 *
 * Desempenho/mobile: o resultado é mantido em memória por usuário durante a
 * sessão da aba, e renovações de token (TOKEN_REFRESHED, retorno à aba) não
 * reiniciam a validação — antes isso derrubava o painel para o spinner.
 * A chamada tem tempo limite com nova tentativa para redes móveis instáveis.
 */
const memo = new Map<string, boolean>();

const withTimeout = <T,>(p: PromiseLike<T>, ms: number) =>
  Promise.race([
    Promise.resolve(p),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);

const checkRole = async (userId: string): Promise<boolean> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
        6000,
      );
      if (!error) return data === true;
    } catch { /* timeout → retry */ }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  return false;
};

export const useIsAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let currentUser: string | null | undefined;

    const resolve = async (userId: string | null) => {
      if (userId === currentUser) return;
      currentUser = userId;
      if (!userId) {
        if (active) { setIsAdmin(false); setLoading(false); }
        return;
      }
      const cached = memo.get(userId);
      if (cached !== undefined) {
        if (active) { setIsAdmin(cached); setLoading(false); }
        return;
      }
      if (active) setLoading(true);
      const ok = await checkRole(userId);
      if (ok) memo.set(userId, true);
      if (active && currentUser === userId) { setIsAdmin(ok); setLoading(false); }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      void resolve(session?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") memo.clear();
      const id = session?.user?.id ?? null;
      setTimeout(() => void resolve(id), 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, loading };
};
