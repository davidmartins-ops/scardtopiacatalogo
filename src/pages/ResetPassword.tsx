import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import useSEO from "@/hooks/use-seo";
import logo from "@/assets/logo.png";

type Status = "validating" | "ready" | "invalid" | "expired";

// Map common Supabase error codes to friendly Portuguese messages.
const friendlyError = (code: string | null, description: string | null): string => {
  if (!code && !description) return "Não foi possível validar o link de recuperação.";
  const desc = (description ?? "").toLowerCase();
  if (code === "otp_expired" || desc.includes("expired")) {
    return "O link de recuperação expirou. Solicite um novo e-mail para redefinir sua senha.";
  }
  if (desc.includes("invalid")) {
    return "Link inválido. Solicite um novo e-mail para redefinir sua senha.";
  }
  return description || "Não foi possível validar o link de recuperação.";
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("validating");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const validationTimeout = useRef<number | null>(null);

  useSEO({
    title: "Redefinir senha",
    description: "Defina uma nova senha para sua conta Spencer's Cardtopia.",
    canonical: `${window.location.origin}/reset-password`,
  });

  useEffect(() => {
    // 1. Detect Supabase auth errors carried in the URL hash (expired/invalid links).
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const errorCode = params.get("error_code") ?? params.get("error");
    const errorDescription = params.get("error_description");
    if (errorCode || errorDescription) {
      const isExpired =
        errorCode === "otp_expired" ||
        (errorDescription ?? "").toLowerCase().includes("expired");
      setStatus(isExpired ? "expired" : "invalid");
      setErrorMsg(friendlyError(errorCode, errorDescription));
      // Clean the hash so the message doesn't reappear on reload.
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    // 2. Listen for the recovery session created by Supabase from the magic link.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        if (validationTimeout.current) window.clearTimeout(validationTimeout.current);
        setStatus("ready");
      }
    });

    // 3. If we already have a session (page reload after recovery), allow the form.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (validationTimeout.current) window.clearTimeout(validationTimeout.current);
        setStatus("ready");
      }
    });

    // 4. Failsafe: if no recovery session arrives within 6s, treat as invalid link.
    validationTimeout.current = window.setTimeout(() => {
      setStatus((prev) => {
        if (prev === "validating") {
          setErrorMsg(
            "Não encontramos um link de recuperação válido. Solicite um novo e-mail de recuperação para continuar.",
          );
          return "invalid";
        }
        return prev;
      });
    }, 6000);

    return () => {
      subscription.unsubscribe();
      if (validationTimeout.current) window.clearTimeout(validationTimeout.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      const desc = error.message?.toLowerCase() ?? "";
      // If the recovery session expired between page load and submit, surface a clear UX.
      if (desc.includes("expired") || desc.includes("session") || desc.includes("auth")) {
        setStatus("expired");
        setErrorMsg(
          "Sua sessão de recuperação expirou. Solicite um novo e-mail para redefinir sua senha.",
        );
        return;
      }
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada com sucesso! Faça login com a nova senha.");
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const renderInvalidState = () => (
    <div className="glass-card p-6 space-y-4 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <p className="text-sm text-foreground/85">{errorMsg}</p>
      <div className="flex flex-col gap-2">
        <Button asChild className="w-full font-bold" size="lg">
          <Link to="/login">Solicitar novo link</Link>
        </Button>
        <Button asChild variant="outline" className="w-full" size="sm">
          <Link to="/login" className="inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao login
          </Link>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <main id="main-content" className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/login" aria-label="Voltar ao login">
            <img src={logo} alt="Spencer's Cardtopia" className="h-20 mx-auto mb-4 drop-shadow-xl" />
          </Link>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: "0.05em" }}
          >
            <span className="text-gradient">
              {status === "expired"
                ? "Link expirado"
                : status === "invalid"
                  ? "Link inválido"
                  : "Redefinir senha"}
            </span>
          </h1>
          <p className="text-sm text-foreground/80 mt-2">
            {status === "validating" && "Validando link de recuperação..."}
            {status === "ready" && "Escolha sua nova senha."}
            {(status === "invalid" || status === "expired") &&
              "Volte ao login para solicitar um novo e-mail de recuperação."}
          </p>
        </div>

        {status === "validating" && (
          <div className="glass-card p-6 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {(status === "invalid" || status === "expired") && renderInvalidState()}

        {status === "ready" && (
          <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
            <div>
              <Label htmlFor="new-pw">Nova senha</Label>
              <Input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-foreground/70 mt-1">Mínimo 6 caracteres.</p>
            </div>
            <div>
              <Label htmlFor="confirm-pw">Confirmar senha</Label>
              <Input
                id="confirm-pw"
                type="password"
                autoComplete="new-password"
                required
                aria-invalid={confirm.length > 0 && confirm !== password}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {confirm.length > 0 && confirm !== password && (
                <p role="alert" className="text-xs text-destructive mt-1">
                  As senhas não coincidem.
                </p>
              )}
            </div>
            <Button type="submit" className="w-full font-bold" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
            </Button>
            <Link
              to="/login"
              className="block text-center text-sm text-foreground/75 hover:text-primary transition-colors"
            >
              Cancelar e voltar ao login
            </Link>
          </form>
        )}
      </main>
    </div>
  );
};

export default ResetPassword;
