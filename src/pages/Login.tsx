import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import loginBg from "@/assets/login-bg.png";
import logo from "@/assets/logo.png";
import bannerDeadpool from "@/assets/banner-deadpool.jpg";
import bannerDandan from "@/assets/banner-dandan.jpg";

const banners = [
  { src: bannerDeadpool, alt: "Secret Lair x Deadpool", label: "🔥 Novidade", title: "Secret Lair x Deadpool" },
  { src: bannerDandan, alt: "Secret Lair x Dandân Deck", label: "✨ Kit Exclusivo", title: "Secret Lair x Dandân Deck" },
];

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleGoogleLogin = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/`,
      });
      if (result?.error) {
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
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Fundo */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img src={loginBg} alt="" className="w-full h-full object-cover scale-105" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-background/90" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      {/* Topo */}
      <header className="relative z-50 flex justify-end p-4 sm:p-6">
        <Button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          variant="outline"
          className="gap-2 font-body glass-card px-5 py-2 text-foreground hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 disabled:opacity-60"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span className="text-sm font-medium">{loading ? "Entrando..." : "Login"}</span>
        </Button>
      </header>

      {/* Conteúdo central */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <img
          src={logo}
          alt="Spencer's Cardtopia"
          className="w-60 sm:w-80 md:w-[420px] lg:w-[500px] mb-6 drop-shadow-2xl animate-float"
        />

        <div className="premium-divider max-w-[200px] mb-4 opacity-60" />

        <p
          className="text-foreground/60 text-sm sm:text-base font-body mb-8 max-w-md tracking-wider uppercase animate-fade-in"
          style={{ animationDelay: "0.2s" }}
        >
          Sua loja de Secret Lair!
        </p>

        <Link to="/catalogo" className="animate-fade-in-up" style={{ animationDelay: "0.4s", opacity: 0 }}>
          <Button
            size="lg"
            className="relative text-lg px-12 py-7 font-bold font-body rounded-xl shadow-2xl shadow-primary/20 animate-glow-pulse transition-all duration-300 hover:scale-105 hover:shadow-primary/40 group overflow-hidden"
          >
            <span className="absolute inset-0 foil-shimmer pointer-events-none" />
            <span className="relative flex items-center gap-2">🔥 Ver Catálogo de Drops</span>
          </Button>
        </Link>

        {/* Banner carousel */}
        <div
          className="mt-12 w-full max-w-sm sm:max-w-md animate-fade-in-up"
          style={{ animationDelay: "0.6s", opacity: 0 }}
        >
          <Link to="/catalogo" className="block group">
            <div className="relative rounded-2xl overflow-hidden border border-border/30 shadow-2xl shadow-primary/10 transition-all duration-500 group-hover:shadow-primary/30 group-hover:scale-[1.02]">
              {banners.map((banner, idx) => (
                <img
                  key={idx}
                  src={banner.src}
                  alt={banner.alt}
                  className={`w-full h-auto object-cover transition-opacity duration-1000 ${idx === currentBanner ? "opacity-100" : "opacity-0 absolute inset-0"}`}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                <span className="inline-block px-3 py-1 rounded-full bg-primary/90 text-primary-foreground text-xs font-bold font-body uppercase tracking-wider mb-2">
                  {banners[currentBanner].label}
                </span>
                <p className="text-sm font-body font-medium text-foreground drop-shadow-lg">
                  {banners[currentBanner].title}
                </p>
              </div>
              {/* Dots */}
              <div className="absolute bottom-2 right-3 flex gap-1.5">
                {banners.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => { e.preventDefault(); setCurrentBanner(idx); }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentBanner ? "w-4 bg-primary" : "w-1.5 bg-foreground/30"}`}
                  />
                ))}
              </div>
              <div className="absolute inset-0 foil-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            </div>
          </Link>
        </div>
      </main>

      {/* Fade inferior */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-[5]" />
    </div>
  );
};

export default Login;
