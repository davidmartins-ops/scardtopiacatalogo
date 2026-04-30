import { Link } from "react-router-dom";
import useSEO from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, HandshakeIcon, Smile } from "lucide-react";

const Sobre = () => {
  useSEO({
    title: "Sobre | Spencer's Cardtopia",
    description:
      "Conheça a Spencer's Cardtopia: paixão por Magic: The Gathering e TCGs, com transparência, acessibilidade e diversão.",
    canonical: `${window.location.origin}/sobre`,
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="flex-1 mx-auto max-w-3xl w-full px-4 sm:px-6 py-10 font-body">
        <Link to="/catalogo">
          <Button variant="ghost" size="sm" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>

        <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2">
          Sobre a Spencer's Cardtopia
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Nossa história, nossos pilares e o que nos move.
        </p>

        <article className="space-y-6 leading-relaxed text-base">
          <p>
            A Spencer's Cardtopia nasceu oficialmente em <strong>1º de abril de 2025</strong>, mas
            sua história no universo dos card games começou muito antes. Com mais de 2 anos de
            atuação no mercado, já tivemos a oportunidade de atender centenas de clientes,
            construindo uma base sólida pautada na confiança e na paixão pelo jogo.
          </p>

          <p>
            Desde o início, nosso objetivo sempre foi ir além da simples venda de produtos.
            Acreditamos que o universo de <em>Magic: The Gathering</em> e dos TCGs é feito de
            experiências, colecionismo e conexão entre pessoas. Por isso, buscamos oferecer não
            apenas itens exclusivos, como os drops de <strong>Secret Lair</strong>, mas também uma
            experiência diferenciada para cada cliente.
          </p>

          <section aria-labelledby="pilares" className="pt-2">
            <h2 id="pilares" className="text-xl font-display font-semibold mb-4">
              Nossos pilares
            </h2>
            <ul className="grid sm:grid-cols-3 gap-4">
              <li className="rounded-lg border border-border bg-card/50 p-4">
                <HandshakeIcon className="h-5 w-5 mb-2 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
                <h3 className="font-semibold mb-1">Transparência</h3>
                <p className="text-sm text-muted-foreground">
                  Relações claras, comunicação direta e confiança em cada negociação.
                </p>
              </li>
              <li className="rounded-lg border border-border bg-card/50 p-4">
                <Sparkles className="h-5 w-5 mb-2 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
                <h3 className="font-semibold mb-1">Acessibilidade</h3>
                <p className="text-sm text-muted-foreground">
                  Tornar produtos exclusivos mais próximos da comunidade.
                </p>
              </li>
              <li className="rounded-lg border border-border bg-card/50 p-4">
                <Smile className="h-5 w-5 mb-2 text-[hsl(var(--brand-gold))]" aria-hidden="true" />
                <h3 className="font-semibold mb-1">Diversão</h3>
                <p className="text-sm text-muted-foreground">
                  Porque jogar, colecionar e viver esse universo deve ser sempre prazeroso.
                </p>
              </li>
            </ul>
          </section>

          <p className="pt-4 text-lg font-display">
            A Spencer's Cardtopia é mais do que uma loja: é um espaço para quem vive o card game
            de verdade.
          </p>
        </article>
      </main>
    </div>
  );
};

export default Sobre;
