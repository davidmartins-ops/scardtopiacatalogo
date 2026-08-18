import { supabase } from "@/integrations/supabase/client";

/**
 * Registra tentativas de acesso à área de gerenciamento (/admin).
 * Usa a função SECURITY DEFINER `log_admin_access_attempt`, de modo que
 * usuários sem permissão também tenham a tentativa auditada.
 */
export const logAdminAccessAttempt = async (
  path: string,
  granted: boolean,
  metadata: Record<string, unknown> = {},
) => {
  try {
    await supabase.rpc("log_admin_access_attempt", {
      _path: path,
      _granted: granted,
      _metadata: { ...metadata, user_agent: navigator.userAgent } as never,
    });
  } catch {
    // auditoria nunca deve quebrar a navegação
  }
};

/**
 * Registra ações executadas por administradores no painel.
 * Somente admins conseguem inserir (RLS), então falhas são ignoradas.
 */
export const logAdminAction = async (
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("admin_audit_log").insert({
      actor_id: session?.user?.id ?? null,
      actor_email: session?.user?.email ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: metadata as never,
    });
  } catch {
    // auditoria nunca deve quebrar a ação do admin
  }
};
