import { Link } from "react-router-dom";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import loginBg from "@/assets/login-bg.png";
import logo from "@/assets/logo.png";

const Login = () => {
  const handleGoogleLogin = async () => {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result?.error) {
        console.error("Login error:", result.error);
        const { toast } = await import("sonner");
        toast.error("Erro ao fazer login. Tente novamente.");
      }
    } catch (err) {
      console.error("Login exception:", err);
      const { toast } = await import("sonner");
      toast.error("Erro ao fazer login. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <img src={loginBg} alt="" className="absolute inset-0 w-full h-full object-cover scale-105" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-background/90" />

      {/* Decorative glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      {/* Top bar */}
      <div className="relative z-10 flex justify-end p-4 sm:p-6 animate-fade-in">
        <Button
          onClick={handleGoogleLogin}
          variant="outline"
          className="gap-2 font-body glass-card px-5 py-2 text-foreground hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span className="text-sm font-medium">Login</span>
        </Button>
      </div>

      {/* Center content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 -mt-16">
        <img
          src={logo}
          alt="Spencer's Cardtopia"
          className="w-60 sm:w-80 md:w-[420px] lg:w-[500px] mb-6 drop-shadow-2xl animate-float"
        />

        <div className="premium-divider max-w-[200px] mb-4 opacity-60" />

        <p className="text-foreground/60 text-center text-sm sm:text-base font-body mb-8 max-w-md tracking-wider uppercase animate-fade-in" style={{ animationDelay: '0.2s' }}>
          Sua loja de Secret Lair!
        </p>

        <Link to="/catalogo" className="animate-fade-in-up" style={{ animationDelay: '0.4s', opacity: 0 }}>
          <Button
            size="lg"
            className="relative text-lg px-12 py-7 font-bold font-body rounded-xl shadow-2xl shadow-primary/20 animate-glow-pulse transition-all duration-300 hover:scale-105 hover:shadow-primary/40 group overflow-hidden"
          >
            <span className="absolute inset-0 foil-shimmer pointer-events-none" />
            <span className="relative flex items-center gap-2">
              🔥 Ver Catálogo de Drops
            </span>
          </Button>
        </Link>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-[5]" />
    </div>
  );
};

export default Login;
