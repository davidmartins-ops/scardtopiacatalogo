import { Link } from "react-router-dom";
import useSEO from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  MessageCircle,
  CreditCard,
  Package,
  ScrollText,
  RefreshCcw,
  Mail,
  AlertTriangle,
} from "lucide-react";

const WHATSAPP_URL = "https://wa.me/5511947154555?text=Ol%C3%A1!%20Tenho%20uma%20d%C3%BAvida%20sobre%20a%20Spencer%27s%20Cardtopia.";

type QA = { q: string; a: React.ReactNode; aText: string };

type Section = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: QA[];
};

const sections: Section[] = [
  {
    id: "pagamento",
    title: "Pagamento",
    icon: CreditCard,
    items: [
      {
        q: "Quais formas de pagamento são aceitas?",
        a: <p>Aceitamos cartão de crédito, PIX e boleto.</p>,
      },
      {
        q: "Posso parcelar minha compra?",
        a: (
          <div className="space-y-2">
            <p>Sim!</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>1 drop: até 3x sem juros</li>
              <li>4 drops: até 6x sem juros</li>
              <li>7+ drops: até 10x sem juros</li>
            </ul>
            <p className="text-sm">
              <strong>Observação:</strong> valores com desconto não é possível parcelamento.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: "pedidos-envio",
    title: "Pedidos e Envio",
    icon: Package,
    items: [
      {
        q: "Qual o prazo de envio?",
        a: (
          <div className="space-y-2">
            <p>
              Os pedidos seguem o prazo informado na página do produto (pré-venda ou pronta
              entrega).
            </p>
            <p>
              <strong>Para produtos em pré-venda:</strong> a estimativa de entrega é de até{" "}
              <strong>90 dias</strong> após o recebimento do produto em nossas instalações nos EUA.
            </p>
          </div>
        ),
      },
      {
        q: "Vocês enviam para todo o Brasil?",
        a: <p>Sim, realizamos envios para todo o país.</p>,
      },
      {
        q: "Como acompanho meu pedido?",
        a: <p>Você receberá um código de rastreio por e-mail após o envio.</p>,
      },
    ],
  },
  {
    id: "produtos",
    title: "Produtos",
    icon: ScrollText,
    items: [
      {
        q: "Os produtos são originais?",
        a: <p>Sim, todos os produtos são originais e lacrados.</p>,
      },
      {
        q: "Os drops são limitados?",
        a: <p>Sim. Secret Lair é edição limitada — pode esgotar rapidamente.</p>,
      },
      {
        q: "Qual a diferença entre os acabamentos?",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Non-Foil:</strong> acabamento padrão, sem brilho.</li>
            <li><strong>Foil:</strong> acabamento brilhante tradicional.</li>
            <li><strong>Rainbow Foil:</strong> efeito holográfico com variação de cores conforme a luz.</li>
            <li>
              <strong>Confetti Foil:</strong> acabamento premium com partículas brilhantes estilo
              "confete", mais raro e altamente colecionável.
            </li>
          </ul>
        ),
      },
    ],
  },
  {
    id: "trocas-devolucoes",
    title: "Trocas e Devoluções",
    icon: RefreshCcw,
    items: [
      {
        q: "Posso trocar meu produto?",
        a: <p>Sim, em caso de defeito ou avaria.</p>,
      },
      {
        q: "Aceitam devolução?",
        a: (
          <p>
            Sim, conforme o Código de Defesa do Consumidor (até 7 dias após o recebimento).
          </p>
        ),
      },
    ],
  },
  {
    id: "atendimento",
    title: "Atendimento",
    icon: Mail,
    items: [
      {
        q: "Como entro em contato?",
        a: (
          <div className="space-y-2">
            <p>Você pode falar com a gente via:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 text-primary hover:opacity-80"
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/spencerscardtopia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 text-primary hover:opacity-80"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="mailto:contato@spencerscardtopia.com.br"
                  className="underline underline-offset-2 text-primary hover:opacity-80"
                >
                  E-mail
                </a>
              </li>
            </ul>
          </div>
        ),
      },
      {
        q: "Não encontrei minha dúvida, e agora?",
        a: <p>Entre em contato conosco — teremos prazer em ajudar!</p>,
      },
    ],
  },
];

const FAQ = () => {
  useSEO({
    title: "FAQ | Spencer's Cardtopia",
    description:
      "Dúvidas frequentes sobre pagamento, envio, produtos, trocas e atendimento na Spencer's Cardtopia.",
    canonical: `${window.location.origin}/faq`,
  });

  // JSON-LD FAQPage for SEO
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: sections.flatMap((s) =>
      s.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: typeof item.a === "string" ? item.a : item.q,
        },
      })),
    ),
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main
        id="main-content"
        className="flex-1 mx-auto max-w-3xl w-full px-4 sm:px-6 py-10 font-body"
      >
        <Link to="/catalogo">
          <Button variant="ghost" size="sm" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2">
            FAQ — Dúvidas Frequentes
          </h1>
          <p className="text-sm text-muted-foreground">
            Respostas rápidas para as perguntas mais comuns.
          </p>
        </header>

        <div className="space-y-10">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.id} aria-labelledby={`faq-${section.id}`}>
                <h2
                  id={`faq-${section.id}`}
                  className="flex items-center gap-2 text-xl sm:text-2xl font-display font-semibold mb-3"
                >
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  {section.title}
                </h2>
                <Accordion type="single" collapsible className="w-full">
                  {section.items.map((item, idx) => (
                    <AccordionItem
                      key={`${section.id}-${idx}`}
                      value={`${section.id}-${idx}`}
                    >
                      <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            );
          })}
        </div>

        {/* CTA WhatsApp */}
        <aside
          aria-label="Fale conosco no WhatsApp"
          className="mt-12 rounded-lg border border-border bg-card p-6 text-center shadow-sm"
        >
          <h2 className="text-lg sm:text-xl font-display font-semibold mb-2">
            Ainda com dúvidas?
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Fale com a gente no WhatsApp — resposta rápida e direta.
          </p>
          <Button
            asChild
            size="lg"
            className="gap-2 bg-[#25D366] text-white hover:bg-[#25D366]/90"
          >
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              Falar no WhatsApp
            </a>
          </Button>
        </aside>

        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      </main>
    </div>
  );
};

export default FAQ;
