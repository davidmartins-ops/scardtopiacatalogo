import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { logAdminAccessAttempt } from "@/lib/admin-audit";

/**
 * Guarda de rota do painel administrativo.
 * - Aguarda a validação da role no backend antes de decidir.
 * - Usuário sem sessão → /admin/login.
 * - Usuário autenticado sem role admin → redireciona para a página inicial
 *   e registra a tentativa em admin_audit_log.
 */
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading: authLoading } = useCustomerAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const location = useLocation();
  const logged = useRef(false);

  const loading = authLoading || roleLoading;
  const denied = !loading && (!session || !isAdmin);

  useEffect(() => {
    if (loading || logged.current) return;
    logged.current = true;
    if (denied) {
      if (session) toast.error("Acesso restrito ao gerenciamento.");
      void logAdminAccessAttempt(location.pathname, false, {
        authenticated: Boolean(session),
      });
    } else {
      void logAdminAccessAttempt(location.pathname, true, {});
    }
  }, [loading, denied, session, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Validando permissões de administrador…</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default AdminRoute;
