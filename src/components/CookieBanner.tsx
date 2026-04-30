import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Cookie, X } from "lucide-react";
import { CookiePrefs, getStoredConsent, saveConsent } from "@/lib/consent";

const CookieBanner = () => {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  // Allow other components (e.g. footer) to reopen the cookie settings
  useEffect(() => {
    const handler = () => {
      setShowSettings(true);
      setOpen(true);
      // Telemetria discreta: confirma que o banner abriu via solicitação externa
      // e que o consentimento atual foi preservado entre rotas.
      try {
        const stored = getStoredConsent();
        // eslint-disable-next-line no-console
        console.info("[telemetry] cookie_banner_opened", {
          via: "footer",
          route: window.location.pathname,
          consentPreserved: !!stored,
          analytics: stored?.analytics ?? null,
          marketing: stored?.marketing ?? null,
          ts: Date.now(),
        });
      } catch {
        /* no-op */
      }
    };
    window.addEventListener("open-cookie-settings", handler);
    return () => window.removeEventListener("open-cookie-settings", handler);
  }, []);

  const persist = async (prefs: CookiePrefs) => {
    await saveConsent(prefs, showSettings ? "settings" : "banner");
    setOpen(false);
  };

  const acceptAll = () => persist({ essential: true, analytics: true, marketing: true });
  const rejectAll = () => persist({ essential: true, analytics: false, marketing: false });
  const saveCustom = () => persist({ essential: true, analytics, marketing });

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
      className="fixed bottom-0 inset-x-0 z-[100] p-3 sm:p-4 animate-fade-in-up"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-background/95 backdrop-blur-md shadow-2xl shadow-primary/10 p-5 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="hidden sm:flex h-10 w-10 shrink-0 rounded-full bg-primary/10 items-center justify-center">
            <Cookie className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="cookie-banner-title" className="text-base sm:text-lg font-display font-bold text-foreground">
              Sua privacidade importa
            </h2>
            <p id="cookie-banner-desc" className="mt-1 text-sm text-muted-foreground font-body">
              Usamos cookies essenciais para o funcionamento do site e, com seu consentimento, cookies de
              análise para melhorar sua experiência. Você pode aceitar, recusar ou personalizar.
              Saiba mais na nossa{" "}
              <Link to="/privacidade" className="text-primary underline underline-offset-2 hover:text-primary/80">
                Política de Privacidade
              </Link>
              .
            </p>

            {showSettings && (
              <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Essenciais</p>
                    <p className="text-xs text-muted-foreground">Necessários para login e carrinho. Sempre ativos.</p>
                  </div>
                  <Switch checked disabled aria-label="Cookies essenciais (sempre ativos)" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Análise</p>
                    <p className="text-xs text-muted-foreground">Métricas anônimas de uso para melhorar o catálogo.</p>
                  </div>
                  <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label="Cookies de análise" />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Marketing</p>
                    <p className="text-xs text-muted-foreground">Comunicações personalizadas e ofertas.</p>
                  </div>
                  <Switch checked={marketing} onCheckedChange={setMarketing} aria-label="Cookies de marketing" />
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {!showSettings ? (
                <>
                  <Button onClick={acceptAll} className="font-body">Aceitar todos</Button>
                  <Button onClick={rejectAll} variant="outline" className="font-body">Recusar opcionais</Button>
                  <Button onClick={() => setShowSettings(true)} variant="ghost" className="font-body">
                    Personalizar
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={saveCustom} className="font-body">Salvar preferências</Button>
                  <Button onClick={() => setShowSettings(false)} variant="ghost" className="font-body">
                    Voltar
                  </Button>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={rejectAll}
            aria-label="Fechar banner e recusar cookies opcionais"
            className="shrink-0 inline-flex items-center justify-center h-11 w-11 min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
