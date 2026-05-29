import { Link } from "react-router-dom";
import useSEO from "@/hooks/use-seo";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
  useSEO({
    title: "Termos de Uso",
    description: "Regras de uso do site Spencer's Cardtopia: compras, pagamentos, envios, devoluções e responsabilidades.",
    canonical: `${window.location.origin}/termos`,
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="flex-1 mx-auto max-w-3xl w-full px-4 sm:px-6 py-10 font-body">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>

        <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <div className="space-y-6 leading-relaxed">
          <section>
            <h2 className="text-xl font-display font-semibold">1. Aceitação</h2>
            <p>Ao usar o site Spencer's Cardtopia você concorda com estes Termos e com nossa Política de Privacidade.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">2. Cadastro e conta</h2>
            <p>
              Você é responsável pelas informações fornecidas no cadastro e por manter a confidencialidade do seu
              acesso. É proibido criar contas com dados falsos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">3. Pedidos e pagamento</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Os pedidos são confirmados via WhatsApp após envio do carrinho.</li>
              <li>Pagamento por <strong>cartão</strong> ou <strong>PIX</strong> (com possibilidade de desconto).</li>
              <li>Para PIX, o comprovante deve ser enviado para liberação do pedido.</li>
              <li>Drops podem ser parcelados em até 3x sem juros, conforme política da loja.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">4. Estoque e preços</h2>
            <p>
              Itens são disponibilizados conforme estoque. Preços e descontos podem ser alterados sem aviso prévio,
              mas pedidos já confirmados respeitam o valor acordado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">5. Envio e retirada</h2>
            <p>
              Oferecemos envio (PAC, SEDEX ou transportadora) e retirada local. O frete é pago no momento da postagem.
              Prazos dependem da modalidade escolhida e da disponibilidade do produto.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">6. Trocas e devoluções (CDC)</h2>
            <p>
              Conforme o Código de Defesa do Consumidor, você tem até 7 dias após o recebimento para desistir da
              compra realizada online. Para defeitos, entre em contato em até 30 dias (não duráveis) ou 90 dias
              (duráveis). O estado da carta deve ser preservado conforme entregue.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">7. Conduta do usuário</h2>
            <p>
              É proibido usar o site para fins ilícitos, automatizar requisições em massa, copiar conteúdo sem
              autorização ou tentar burlar mecanismos de segurança.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">8. Limitação de responsabilidade</h2>
            <p>
              Não nos responsabilizamos por indisponibilidades pontuais, atrasos de transportadoras ou perdas
              decorrentes de uso indevido da conta pelo titular.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">9. Foro</h2>
            <p>Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro do consumidor para dirimir conflitos.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">10. Contato</h2>
            <p>
              Dúvidas?{" "}
              <a href="mailto:spencerscardtopia@gmail.com" className="text-primary underline underline-offset-2">
                spencerscardtopia@gmail.com
              </a>
            </p>
          </section>
        </div>
      </main>
      
    </div>
  );
};

export default Terms;
