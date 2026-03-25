import { Link } from "react-router-dom";
import { useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import loginBg from "@/assets/login-bg.png";
import logo from "@/assets/logo.png";

const Login = () => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (loading) return;

    try {
      setLoading(true);
      console.log("Iniciando login com Google...");

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/`,
      });

      console.log("Resposta do OAuth:", result);

      if (result?.error) {
        console.error("Erro no login:", result.error);
        toast.error("Erro ao fazer login. Tente novamente.");
      }
    } catch (err) {
      console.error("Exceção no login:", err);
      toast.error("Erro ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
<div className="min-h-screen relative overflow-hidden">

  {/* 🔻 BACKGROUND (NUNCA INTERATIVO) */}
  <div className="absolute inset-0 z-0 pointer-events-none">
    <img
      src={loginBg}
      alt=""
      className="w-full h-full object-cover scale-105"
    />
    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-background/90" />
    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
  </div>

  {/* 🔻 TOPO (BOTÃO) — CAMADA ISOLADA */}
  <div className="relative z-50 flex justify-end p-4 sm:p-6">
    <Button
      type="button"
      onClick={handleGoogleLogin}
      variant="outline"
      className="gap-2 font-body glass-card px-5 py-2 text-foreground hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300"
    >
      Login
    </Button>
  </div>

  {/* 🔻 CONTEÚDO CENTRAL */}
  <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">

    <img
      src={logo}
      alt="Spencer's Cardtopia"
      className="w-60 sm:w-80 md:w-[420px] lg:w-[500px] mb-6 drop-shadow-2xl"
    />

    <p className="text-foreground/60 text-center text-sm sm:text-base mb-8">
      Sua loja de Secret Lair!
    </p>

    <Link to="/catalogo">
      <Button size="lg">
        🔥 Ver Catálogo de Drops
      </Button>
    </Link>

  </div>

</div>
};

export default Login;
