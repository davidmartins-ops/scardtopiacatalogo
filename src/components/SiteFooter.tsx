import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Clock, Instagram, MessageCircle, ShieldCheck } from "lucide-react";

const CONTACT_EMAIL = "contato@spencerscardtopia.com.br";
const CONTACT_PHONE_DISPLAY = "(11) 94715-4555";
const CONTACT_PHONE_TEL = "+5511947154555";
const WHATSAPP_URL = `https://wa.me/${CONTACT_PHONE_TEL.replace("+", "")}`;
const INSTAGRAM_URL = "https://instagram.com/spencerscardtopia";
const LOCATION = "Salesópolis/SP";
const HOURS = "Todos os dias, 08h às 22h";

const ORG_JSONLD_ID = "site-footer-org-jsonld";

const SiteFooter = () => {
  const year = new Date().getFullYear();

  const openCookieSettings = () => {
    // Telemetria discreta: confirma intenção e estado atual de consentimento preservado
    try {
      const stored = localStorage.getItem("scardtopia.cookie_consent.v1");
      // eslint-disable-next-line no-console
      console.info("[telemetry] cookie_settings_open", {
        route: typeof window !== "undefined" ? window.location.pathname : "",
        hasStoredConsent: !!stored,
        ts: Date.now(),
      });
    } catch {
      /* no-op */
    }
    window.dispatchEvent(new CustomEvent("open-cookie-settings"));
  };

  // Hide floating social buttons when footer is mounted
  useEffect(() => {
    document.body.dataset.footerVisible = "true";
    return () => {
      delete document.body.dataset.footerVisible;
    };
  }, []);

  // JSON-LD Organization for SEO — single instance, validated on mount and route changes
  useEffect(() => {
    const ensureSingleOrgJsonLd = () => {
      const all = document.querySelectorAll(`script[type="application/ld+json"]`);
      const orgScripts: HTMLScriptElement[] = [];
      all.forEach((el) => {
        const txt = el.textContent || "";
        if (txt.includes('"@type":"Organization"') || txt.includes('"@type": "Organization"')) {
          orgScripts.push(el as HTMLScriptElement);
        }
      });
      // Remove duplicates, keep none, then re-inject canonical one
      orgScripts.forEach((s) => s.remove());

      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Spencer's Cardtopia",
        url:
          typeof window !== "undefined" ? window.location.origin : "https://spencerscardtopia.com.br",
        email: CONTACT_EMAIL,
        telephone: CONTACT_PHONE_TEL,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Salesópolis",
          addressRegion: "SP",
          addressCountry: "BR",
        },
        openingHours: "Mo-Su 08:00-22:00",
        sameAs: [INSTAGRAM_URL, WHATSAPP_URL],
      };

      const script = document.createElement("script");
      script.id = ORG_JSONLD_ID;
      script.type = "application/ld+json";
      script.setAttribute("data-org-jsonld", "true");
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);

      // Dev-time validation
      if (import.meta.env?.DEV) {
        const after = document.querySelectorAll('script[data-org-jsonld="true"]');
        if (after.length !== 1) {
          // eslint-disable-next-line no-console
          console.warn("[seo] Organization JSON-LD não está único", {
            count: after.length,
            route: window.location.pathname,
          });
        }
      }
    };

    ensureSingleOrgJsonLd();

    // Re-validate on history navigation (SPA route changes)
    const onPop = () => ensureSingleOrgJsonLd();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const linkClass =
    "inline-flex items-center min-h-[44px] min-w-[44px] py-2 px-1 -mx-1 text-sm text-[hsl(var(--brand-header-foreground))]/85 hover:text-[hsl(var(--brand-gold))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-gold))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--brand-header))] rounded";

  return (
    <footer
      role="contentinfo"
      data-testid="site-footer"
      aria-label="Rodapé do site"
      className="relative z-10 mt-16 border-t border-[hsl(var(--brand-header-border))] bg-[hsl(var(--brand-header))] text-[hsl(var(--brand-header-foreground))]"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 font-body">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Coluna 1 — Contato */}
          <section aria-labelledby="footer-contato">
            <h2
              id="footer-contato"
              className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--brand-gold))] mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Contato
            </h2>
            <address className="not-italic space-y-2 text-[hsl(var(--brand-header-foreground))]/85">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className={linkClass}
                aria-label={`Enviar e-mail para ${CONTACT_EMAIL}`}
              >
                <Mail className="h-4 w-4 mr-2 shrink-0 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
                <span className="break-all">{CONTACT_EMAIL}</span>
              </a>
              <a
                href={`tel:${CONTACT_PHONE_TEL}`}
                className={linkClass}
                aria-label={`Ligar para ${CONTACT_PHONE_DISPLAY}`}
              >
                <Phone className="h-4 w-4 mr-2 shrink-0 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
                <span>{CONTACT_PHONE_DISPLAY}</span>
              </a>
              <p className="flex items-center min-h-[44px] py-2 text-sm">
                <MapPin className="h-4 w-4 mr-2 shrink-0 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
                <span aria-label={`Localização: ${LOCATION}`}>{LOCATION}</span>
              </p>
              <p className="flex items-center min-h-[44px] py-2 text-sm">
                <Clock className="h-4 w-4 mr-2 shrink-0 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
                <span aria-label={`Horário de atendimento: ${HOURS}`}>{HOURS}</span>
              </p>
            </address>
          </section>

          {/* Coluna 2 — Institucional */}
          <nav aria-labelledby="footer-institucional" aria-label="Links institucionais">
            <h2
              id="footer-institucional"
              className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--brand-gold))] mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Institucional
            </h2>
            <ul className="space-y-1">
              <li>
                <Link to="/sobre" className={linkClass} aria-label="Sobre a Spencer's Cardtopia">
                  Sobre
                </Link>
              </li>
              <li>
                <Link
                  to="/termos"
                  data-testid="footer-link-termos"
                  className={linkClass}
                  aria-label="Ler Termos de Uso"
                >
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link
                  to="/privacidade"
                  data-testid="footer-link-privacidade"
                  className={linkClass}
                  aria-label="Ler Política de Privacidade"
                >
                  Política de Privacidade
                </Link>
              </li>
            </ul>
          </nav>

          {/* Coluna 3 — Atendimento */}
          <nav aria-labelledby="footer-atendimento" aria-label="Atendimento e suporte">
            <h2
              id="footer-atendimento"
              className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--brand-gold))] mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Atendimento
            </h2>
            <ul className="space-y-1">
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                  aria-label="Suporte via WhatsApp (abre em nova aba)"
                >
                  Suporte via WhatsApp
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Dúvida%20-%20FAQ`}
                  className={linkClass}
                  aria-label="Enviar dúvida por e-mail"
                >
                  FAQ / Dúvidas
                </a>
              </li>
              <li>
                <Link to="/conta" className={linkClass} aria-label="Acessar minha conta">
                  Minha Conta
                </Link>
              </li>
            </ul>
          </nav>

          {/* Coluna 4 — Redes sociais */}
          <section aria-labelledby="footer-social">
            <h2
              id="footer-social"
              className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--brand-gold))] mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Redes Sociais
            </h2>
            <ul className="space-y-1">
              <li>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                  aria-label="Instagram da Spencer's Cardtopia (abre em nova aba)"
                >
                  <Instagram className="h-4 w-4 mr-2 shrink-0 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                  aria-label="Conversar no WhatsApp (abre em nova aba)"
                >
                  <MessageCircle className="h-4 w-4 mr-2 shrink-0 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
                  WhatsApp
                </a>
              </li>
            </ul>

            <p className="mt-6 inline-flex items-center gap-2 text-xs text-[hsl(var(--brand-header-foreground))]/75">
              <ShieldCheck className="h-4 w-4 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
              Compra protegida e dados em conformidade com a LGPD.
            </p>
          </section>
        </div>

        {/* Bloco LGPD — consentimento de dados */}
        <div className="mt-10 pt-6 border-t border-[hsl(var(--brand-header-border))] space-y-4">
          <p className="text-xs text-[hsl(var(--brand-header-foreground))]/80 leading-relaxed max-w-3xl">
            Ao navegar neste site você concorda com a coleta e o tratamento dos seus dados pessoais
            conforme nossa{" "}
            <Link
              to="/privacidade"
              className="underline underline-offset-2 text-[hsl(var(--brand-gold))] hover:text-[hsl(var(--brand-gold))]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-gold))] rounded"
              aria-label="Ler Política de Privacidade"
            >
              Política de Privacidade
            </Link>{" "}
            e os{" "}
            <Link
              to="/termos"
              className="underline underline-offset-2 text-[hsl(var(--brand-gold))] hover:text-[hsl(var(--brand-gold))]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-gold))] rounded"
              aria-label="Ler Termos de Uso"
            >
              Termos de Uso
            </Link>
            , em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
            Você pode revisar suas preferências de cookies a qualquer momento.
          </p>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-[hsl(var(--brand-header-foreground))]/75">
            <p>© {year} Spencer's Cardtopia. Todos os direitos reservados. · {LOCATION}</p>
            <button
              type="button"
              onClick={openCookieSettings}
              data-testid="footer-manage-cookies"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] py-2 px-3 text-xs underline underline-offset-2 text-[hsl(var(--brand-gold))] hover:text-[hsl(var(--brand-gold))]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-gold))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--brand-header))] rounded"
              aria-label="Abrir preferências de cookies"
            >
              Gerenciar cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
