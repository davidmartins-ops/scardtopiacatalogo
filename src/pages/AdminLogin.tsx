import { Link } from "react-router-dom";
import { useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import useSEO from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import logo from "@/assets/logo.png";

const AdminLogin = () => {
  const [loading, setLoading] = useState(false);
  useSEO({
    title: "Acesso administrativo",
    description: "Área restrita de administração da Spencer's Cardtopia.",
    canonical: `${window.location.origin}/admin/login`,
  });

  const handleGoogleLogin = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/admin`,
      });
      if (result?.error) toast.error("Erro ao fazer login. Tente novamente.");
    } catch (err) {
      console.error("Exceção no login admin:", err);
      toast.error("Erro ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <main id="main-content" className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/login" aria-label="Voltar ao login">
            <img src={logo} alt="Spencer's Cardtopia" className="h-20 mx-auto mb-4 drop-shadow-xl" />
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/60 text-muted-foreground text-xs font-body uppercase tracking-wider mb-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            Área restrita
          </div>
          <h1
            className="text-xl font-bold text-foreground"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: "0.05em" }}
          >
            <span className="text-gradient">Acesso Administrativo</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Apenas contas autorizadas têm permissão de acesso.
          </p>
        </div>

        <div className="glass-card p-6 space-y-4">
          <Button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            variant="outline"
            className="w-full gap-2"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span className="text-sm font-medium">{loading ? "Entrando..." : "Entrar com Google (Admin)"}</span>
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Tentativas de acesso são monitoradas. Contas sem permissão serão desconectadas automaticamente.
          </p>
        </div>

        <div className="text-center">
          <Link
            to="/login"
            className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar ao login de cliente
          </Link>
        </div>
      </main>
    </div>
  );
};

export default AdminLogin;
