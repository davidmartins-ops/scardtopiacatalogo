import { Link } from "react-router-dom";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsAdmin } from "@/hooks/use-is-admin";

/**
 * Botão de acesso ao gerenciamento.
 * - Enquanto a role é validada no backend, exibe apenas um indicador de
 *   carregamento (nunca o botão), evitando exposição indevida.
 * - Só renderiza o link após confirmação da role `admin` via `has_role`.
 */
const AdminPanelButton = () => {
  const { isAdmin, loading } = useIsAdmin();

  if (loading) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 text-xs text-brand-header-foreground/60"
        aria-live="polite"
        data-testid="admin-button-loading"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span className="hidden sm:inline">Validando permissões…</span>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <Link to="/admin" data-testid="admin-panel-button">
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 bg-transparent border-brand-gold/60 text-brand-gold hover:bg-brand-gold hover:text-brand-gold-foreground hover:border-brand-gold transition-colors duration-200"
      >
        <Shield className="h-4 w-4" />
        <span className="hidden sm:inline">Gerenciamento</span>
      </Button>
    </Link>
  );
};

export default AdminPanelButton;
