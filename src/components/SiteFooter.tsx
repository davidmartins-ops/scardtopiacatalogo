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

const SiteFooter = () => {
  const year = new Date().getFullYear();

  const openCookieSettings = () => {
    window.dispatchEvent(new CustomEvent("open-cookie-settings"));
  };

  // Hide floating social buttons when footer is mounted (memory: floating buttons hidden on footer)
  useEffect(() => {
    document.body.dataset.footerVisible = "true";
    return () => {
      delete document.body.dataset.footerVisible;
    };
  }, []);

  // JSON-LD Organization for SEO — injected once, deduped across navigations
  useEffect(() => {
    const id = "site-footer-org-jsonld";
    if (document.getElementById(id)) return;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Spencer's Cardtopia",
      url: typeof window !== "undefined" ? window.location.origin : "https://spencerscardtopia.com.br",
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
    script.id = id;
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }, []);

  const linkClass =
    "inline-flex items-center min-h-[44px] py-2 text-sm text-[hsl(var(--brand-header-foreground))]/85 hover:text-[hsl(var(--brand-gold))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-gold))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--brand-header))] rounded";

  return (
    <footer
      role="contentinfo"
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
              <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass} aria-label={`Enviar e-mail para ${CONTACT_EMAIL}`}>
                <Mail className="h-4 w-4 mr-2 shrink-0 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
                <span className="break-all">{CONTACT_EMAIL}</span>
              </a>
              <a href={`tel:${CONTACT_PHONE_TEL}`} className={linkClass} aria-label={`Ligar para ${CONTACT_PHONE_DISPLAY}`}>
                <Phone className="h-4 w-4 mr-2 shrink-0 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
                <span>{CONTACT_PHONE_DISPLAY}</span>
              </a>
              <p className="flex items-center min-h-[44px] py-2 text-sm">
                <MapPin className="h-4 w-4 mr-2 shrink-0 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
                {LOCATION}
              </p>
              <p className="flex items-center min-h-[44px] py-2 text-sm">
                <Clock className="h-4 w-4 mr-2 shrink-0 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
                {HOURS}
              </p>
            </address>
          </section>

          {/* Coluna 2 — Institucional */}
          <nav aria-labelledby="footer-institucional">
            <h2
              id="footer-institucional"
              className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--brand-gold))] mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Institucional
            </h2>
            <ul className="space-y-1">
              <li>
                <Link to="/catalogo" className={linkClass}>
                  Sobre
                </Link>
              </li>
              <li>
                <Link to="/termos" className={linkClass}>
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link to="/privacidade" className={linkClass}>
                  Política de Privacidade
                </Link>
              </li>
            </ul>
          </nav>

          {/* Coluna 3 — Atendimento */}
          <nav aria-labelledby="footer-atendimento">
            <h2
              id="footer-atendimento"
              className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--brand-gold))] mb-4"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Atendimento
            </h2>
            <ul className="space-y-1">
              <li>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  Suporte via WhatsApp
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACT_EMAIL}?subject=Dúvida%20-%20FAQ`} className={linkClass}>
                  FAQ / Dúvidas
                </a>
              </li>
              <li>
                <Link to="/conta" className={linkClass}>
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
                  aria-label="Instagram da Spencer's Cardtopia"
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
                  aria-label="Conversar no WhatsApp"
                >
                  <MessageCircle className="h-4 w-4 mr-2 shrink-0 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
                  WhatsApp
                </a>
              </li>
            </ul>

            <p className="mt-6 inline-flex items-center gap-2 text-xs text-[hsl(var(--brand-header-foreground))]/70">
              <ShieldCheck className="h-4 w-4 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
              Compra protegida e dados em conformidade com a LGPD.
            </p>
          </section>
        </div>

        {/* Linha inferior */}
        <div className="mt-10 pt-6 border-t border-[hsl(var(--brand-header-border))] flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[hsl(var(--brand-header-foreground))]/70">
          <p>© {year} Spencer's Cardtopia. Todos os direitos reservados.</p>
          <p>
            CNPJ informado mediante solicitação · {LOCATION}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
