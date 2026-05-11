import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import useSEO from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Share2 } from "lucide-react";
import loginBg from "@/assets/login-bg-new.jpg";
import logo from "@/assets/logo.png";
import { useActiveBanners } from "@/hooks/use-banners";

// Allowlist of internal redirect targets (prevents open redirect / phishing).
const REDIRECT_ALLOWLIST = [
  "/catalogo",
  "/conta",
  "/tendencias",
  "/sobre",
  "/faq",
  "/colecao",
  "/privacidade",
  "/termos",
];

const sanitizeRedirect = (raw: string | null): string => {
  if (!raw) return "/catalogo";
  // Must be a relative internal path
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/catalogo";
  // Prevent protocol-relative or backslash tricks
  if (raw.includes("\\") || raw.includes("@")) return "/catalogo";
  // Strip query/hash before matching
  const path = raw.split(/[?#]/)[0];
  const ok = REDIRECT_ALLOWLIST.some((p) => path === p || path.startsWith(`${p}/`));
  return ok ? raw : "/catalogo";
};

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = useMemo(() => sanitizeRedirect(searchParams.get("redirect")), [searchParams]);

  const {
    session: customerSession,
    signInWithEmail,
    signUpWithEmail,
    requestPasswordReset,
    resendConfirmationEmail,
    loading: authLoading,
  } = useCustomerAuth();

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(0);
  const { data: banners = [] } = useActiveBanners("login");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [keepLogged, setKeepLogged] = useState(true);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [signupSuccessEmail, setSignupSuccessEmail] = useState<string | null>(null);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  const [resendOpen, setResendOpen] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  useSEO({
    title: "Entre na sua conta",
    description:
      "Acompanhe pedidos, favoritos e novidades da Spencer's Cardtopia — sua loja de Secret Lair, drops e singles de Magic.",
    canonical: `${window.location.origin}/login`,
  });

  // Customer auto-redirect
  useEffect(() => {
    if (!authLoading && customerSession) {
      navigate(redirectTo, { replace: true });
    }
  }, [authLoading, customerSession, navigate, redirectTo]);

  // Banner rotation
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signInWithEmail(loginEmail, loginPassword, { persist: keepLogged });
    setLoading(false);
    if (error) {
      const msg = error.message || "";
      const notConfirmed = /confirm/i.test(msg) || /not.*confirmed/i.test(msg);
      if (notConfirmed) {
        toast.error("E-mail ainda não confirmado. Reenvie o e-mail de confirmação.");
        setResendEmail(loginEmail);
        setResendOpen(true);
      } else {
        toast.error(
          msg === "Invalid login credentials"
            ? "Não foi possível entrar com os dados informados. Verifique e-mail e senha e tente novamente."
            : msg,
        );
      }
    } else {
      toast.success("Bem-vindo de volta!");
      navigate(redirectTo);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (regPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    const { error } = await signUpWithEmail(regEmail, regPassword, regName);
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Conta criada! Verifique seu email para confirmar o cadastro.");
      setSignupSuccessEmail(regEmail);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResendLoading(true);
    const { error } = await resendConfirmationEmail(resendEmail);
    setResendLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Se houver um cadastro pendente, o e-mail de confirmação foi reenviado.");
    setResendOpen(false);
  };

  const handleGoogle = async () => {
    if (googleLoading) return;
    try {
      setGoogleLoading(true);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}${redirectTo}`,
      });
      if (result?.error) toast.error("Erro ao fazer login com Google.");
    } catch {
      toast.error("Erro ao fazer login com Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    const { error } = await requestPasswordReset(forgotEmail);
    setForgotLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Se o e-mail existir, enviaremos as instruções de recuperação.");
    setForgotOpen(false);
    setForgotEmail("");
  };

  const prevBanner = () => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length);
  const nextBanner = () => setCurrentBanner((prev) => (prev + 1) % banners.length);

  const shareBanner = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!banners.length) return;
    const banner = banners[currentBanner];
    const text = `${banner.label} ${banner.title}\n${banner.subtitle}\n\nConfira em Spencer's Cardtopia!`;
    const url = window.location.origin + "/login";
    try {
      const response = await fetch(banner.image_url);
      const blob = await response.blob();
      const file = new File([blob], `${banner.title.replace(/\s+/g, "-")}.jpg`, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: banner.title, text, url, files: [file] });
        return;
      }
    } catch {}
    if (navigator.share) {
      try {
        await navigator.share({ title: banner.title, text, url });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast.success("Link copiado para a area de transferencia!");
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img src={loginBg} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background/95" />
      </div>

      {/* Header */}
      <header className="relative z-50 flex items-center justify-between p-4 sm:p-6">
        <Link to="/catalogo" aria-label="Ir ao catálogo">
          <img
            src={logo}
            alt="Spencer's Cardtopia"
            className="w-24 sm:w-32 md:w-36 drop-shadow-2xl animate-float"
          />
        </Link>
        {/* Admin link only on desktop in header (mobile is below the card) */}
        <Link
          to="/admin/login"
          className="hidden sm:inline-flex items-center text-xs sm:text-sm text-foreground/70 hover:text-primary transition-colors px-3 py-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          Acesso administrativo
        </Link>
      </header>

      {/* Main */}
      <main
        id="main-content"
        className="relative z-10 flex flex-col items-center px-4 sm:px-6 pb-12 -mt-4 sm:-mt-8"
      >
        {/* Hero */}
        <div className="w-full max-w-md text-center mb-6 animate-fade-in">
          <p className="text-xs sm:text-sm font-bold tracking-wider text-primary mb-3 uppercase font-body drop-shadow">
            ✨ Seu universo Secret Lair começa aqui! ✨
          </p>
          <h1
            className="text-2xl sm:text-3xl font-bold text-foreground"
            style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: "0.05em" }}
          >
            <span className="text-gradient">Entre na sua conta</span>
          </h1>
          <p className="text-sm sm:text-base text-foreground/85 mt-2 font-body drop-shadow">
            Suas cartas favoritas, tendências, decks e novidades, tudo em um só lugar!
          </p>
        </div>

        {/* Customer login card */}
        <div className="w-full max-w-md glass-card p-6 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <Tabs defaultValue="login">
            <TabsList className="w-full mb-4 bg-muted/50">
              <TabsTrigger value="login" className="flex-1 font-display">
                Entrar
              </TabsTrigger>
              <TabsTrigger value="register" className="flex-1 font-display">
                Criar Conta
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="login-pw">Senha</Label>
                  <Input
                    id="login-pw"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs sm:text-sm text-foreground/85 cursor-pointer select-none">
                    <Checkbox
                      checked={keepLogged}
                      onCheckedChange={(v) => setKeepLogged(v === true)}
                      aria-label="Manter conectado neste dispositivo"
                    />
                    Manter conectado neste dispositivo
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(loginEmail);
                      setForgotOpen(true);
                    }}
                    className="text-xs sm:text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <Button type="submit" size="lg" className="w-full font-bold" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar como cliente"}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setResendEmail(loginEmail);
                      setResendOpen(true);
                    }}
                    className="text-xs sm:text-sm text-foreground/80 hover:text-primary hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
                  >
                    Não recebeu o e-mail? Reenviar confirmação
                  </button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="reg-name">Nome</Label>
                  <Input
                    id="reg-name"
                    autoComplete="name"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="reg-email">E-mail</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="reg-pw">Senha</Label>
                  <Input
                    id="reg-pw"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    aria-describedby="reg-pw-help"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                  <p id="reg-pw-help" className="text-xs text-foreground/70 mt-1">
                    Mínimo 6 caracteres.
                  </p>
                </div>
                <div>
                  <Label htmlFor="reg-confirm">Confirmar Senha</Label>
                  <Input
                    id="reg-confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    aria-invalid={regConfirm.length > 0 && regConfirm !== regPassword}
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                  />
                  {regConfirm.length > 0 && regConfirm !== regPassword && (
                    <p role="alert" className="text-xs text-destructive mt-1">
                      As senhas não coincidem.
                    </p>
                  )}
                </div>
                <Button type="submit" size="lg" className="w-full font-bold" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
                </Button>

                {signupSuccessEmail && (
                  <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-xs sm:text-sm text-foreground/90 space-y-2">
                    <p>
                      Enviamos um e-mail de confirmação para <strong>{signupSuccessEmail}</strong>. Confira sua
                      caixa de entrada e a pasta de spam.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setResendEmail(signupSuccessEmail);
                        setResendOpen(true);
                      }}
                      className="text-primary hover:underline font-medium"
                    >
                      Reenviar e-mail de confirmação
                    </button>
                  </div>
                )}
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-foreground/70">ou</span>
            </div>
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={handleGoogle} disabled={googleLoading}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {googleLoading ? "Entrando..." : "Continuar com Google"}
          </Button>

          <div className="mt-4 text-center">
            <Link to="/catalogo" className="text-sm text-foreground/80 hover:text-primary transition-colors">
              Continuar como visitante e ver o catálogo
            </Link>
          </div>
        </div>

        {/* Discreet admin link — mobile placement, right below the card */}
        <div className="sm:hidden w-full max-w-md mt-4 flex justify-center">
          <Link
            to="/admin/login"
            className="text-xs text-foreground/75 hover:text-primary transition-colors px-4 py-3 rounded-md min-h-[44px] inline-flex items-center"
          >
            Acesso administrativo
          </Link>
        </div>

        {/* Banner carousel (secondary) */}
        {banners.length > 0 && (
          <div className="w-full max-w-md mt-8 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <div className="relative rounded-2xl overflow-hidden border border-border/30 shadow-2xl shadow-primary/10 transition-all duration-500 hover:shadow-primary/30 group">
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: "3 / 4" }}>
                <div
                  className="flex h-full transition-transform duration-700 ease-in-out"
                  style={{ transform: `translateX(-${currentBanner * 100}%)` }}
                >
                  {banners.map((banner, idx) => (
                    <img
                      key={idx}
                      src={banner.image_url}
                      alt={banner.alt}
                      className="w-full h-full object-cover flex-shrink-0"
                      style={{ minWidth: "100%" }}
                    />
                  ))}
                </div>
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent pointer-events-none" />

              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 pointer-events-none">
                <span className="inline-block px-3 py-1 rounded-full bg-primary/90 text-primary-foreground text-xs font-bold font-body uppercase tracking-wider mb-2">
                  {banners[currentBanner]?.label}
                </span>
                <h2 className="text-lg sm:text-xl font-display font-bold text-foreground drop-shadow-lg">
                  {banners[currentBanner]?.title}
                </h2>
                <p className="text-sm text-foreground/80 font-body mt-1">{banners[currentBanner]?.subtitle}</p>
              </div>

              {banners.length > 1 && (
                <>
                  <button
                    onClick={prevBanner}
                    aria-label="Banner anterior"
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center text-foreground/80 hover:bg-background/80 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextBanner}
                    aria-label="Próximo banner"
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center text-foreground/80 hover:bg-background/80 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={shareBanner}
                className="absolute bottom-14 right-4 h-11 w-11 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-foreground/90 hover:bg-background transition-all z-30 shadow-lg border border-border/50"
                title="Compartilhar banner"
                aria-label="Compartilhar banner"
              >
                <Share2 className="h-5 w-5" />
              </button>

              {banners.length > 1 && (
                <div className="absolute bottom-3 right-4 flex gap-2 z-10">
                  {banners.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentBanner(idx);
                      }}
                      aria-label={`Ir para banner ${idx + 1}`}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        idx === currentBanner ? "w-6 bg-primary" : "w-2 bg-foreground/30 hover:bg-foreground/50"
                      }`}
                    />
                  ))}
                </div>
              )}

              <div className="absolute inset-0 foil-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            </div>
          </div>
        )}
      </main>

      {/* Forgot password dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Recuperar senha</DialogTitle>
            <DialogDescription>
              Informe seu e-mail e enviaremos um link para criar uma nova senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgot} className="space-y-3">
            <div>
              <Label htmlFor="forgot-email">E-mail</Label>
              <Input
                id="forgot-email"
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setForgotOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={forgotLoading}>
                {forgotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={resendOpen} onOpenChange={setResendOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Reenviar e-mail de confirmação</DialogTitle>
            <DialogDescription>
              Informe o e-mail usado no cadastro para receber um novo link de confirmação.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResend} className="space-y-3">
            <div>
              <Label htmlFor="resend-email">E-mail</Label>
              <Input
                id="resend-email"
                type="email"
                required
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setResendOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={resendLoading}>
                {resendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reenviar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
