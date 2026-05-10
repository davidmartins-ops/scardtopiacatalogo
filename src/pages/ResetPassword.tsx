import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import useSEO from "@/hooks/use-seo";
import logo from "@/assets/logo.png";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useSEO({
    title: "Redefinir senha",
    description: "Defina uma nova senha para sua conta Spencer's Cardtopia.",
    canonical: `${window.location.origin}/reset-password`,
  });

  useEffect(() => {
    // Supabase posts a recovery hash; once handled, a session is created (PASSWORD_RECOVERY).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres.");
    if (password !== confirm) return toast.error("As senhas não coincidem.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada! Faça login novamente.");
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <main id="main-content" className="w-full max-w-md space-y-6">
        <div className="text-center">
          <img src={logo} alt="Spencer's Cardtopia" className="h-20 mx-auto mb-4 drop-shadow-xl" />
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: "0.05em" }}
          >
            <span className="text-gradient">Redefinir senha</span>
          </h1>
          <p className="text-sm text-foreground/80 mt-2">
            {ready ? "Escolha sua nova senha." : "Validando link de recuperação..."}
          </p>
        </div>

        {ready && (
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
            </div>
            <div>
              <Label htmlFor="confirm-pw">Confirmar senha</Label>
              <Input
                id="confirm-pw"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full font-bold" size="lg" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
};

export default ResetPassword;
