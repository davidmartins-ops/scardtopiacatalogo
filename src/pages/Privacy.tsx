import { Link } from "react-router-dom";
import useSEO from "@/hooks/use-seo";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
  useSEO({
    title: "Política de Privacidade",
    description:
      "Como Spencer's Cardtopia coleta, usa e protege seus dados pessoais conforme a LGPD (Lei 13.709/2018).",
    canonical: `${window.location.origin}/privacidade`,
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="flex-1 mx-auto max-w-3xl w-full px-4 sm:px-6 py-10 font-body">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>

        <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <div className="prose prose-sm sm:prose-base max-w-none space-y-6 leading-relaxed">
          <section>
            <h2 className="text-xl font-display font-semibold">1. Quem somos</h2>
            <p>
              Spencer's Cardtopia é uma loja online especializada em cartas Magic: The Gathering. Esta política
              descreve como tratamos seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados
              (LGPD - Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">2. Dados que coletamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Cadastro:</strong> nome, e-mail e foto de perfil (quando você usa Google ou cadastro com e-mail).</li>
              <li><strong>Pedidos:</strong> itens, quantidades, valor total e endereço de entrega informado no checkout.</li>
              <li><strong>Pagamento:</strong> comprovantes de PIX que você optar por enviar (armazenados em bucket privado).</li>
              <li><strong>Uso do site:</strong> visualizações, favoritos e cliques (apenas se você consentir cookies de análise).</li>
              <li><strong>Técnicos:</strong> endereço IP, navegador e cookies essenciais para login e carrinho.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">3. Por que usamos seus dados (bases legais)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Execução de contrato:</strong> processar pedidos, entregas e atendimento.</li>
              <li><strong>Consentimento:</strong> cookies de análise/marketing e comunicações promocionais.</li>
              <li><strong>Obrigação legal:</strong> guarda de registros fiscais e tributários.</li>
              <li><strong>Legítimo interesse:</strong> segurança, prevenção a fraudes e melhorias do serviço.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">4. Compartilhamento</h2>
            <p>
              Não vendemos seus dados. Compartilhamos apenas com fornecedores estritamente necessários: provedores
              de hospedagem e banco de dados (Lovable Cloud / Supabase), gateway de autenticação Google e
              plataformas de envio (quando aplicável). Todos seguem padrões de segurança equivalentes aos nossos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">5. Cookies</h2>
            <p>
              Usamos cookies <strong>essenciais</strong> (sempre ativos) para login e carrinho, e cookies opcionais
              de <strong>análise</strong> e <strong>marketing</strong> que só ativamos com seu consentimento. Você
              pode revogar a qualquer momento limpando o consentimento no rodapé ou nas configurações do navegador.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">6. Retenção</h2>
            <p>
              Mantemos seus dados pelo tempo necessário ao atendimento e cumprimento de obrigações legais (mínimo
              de 5 anos para dados fiscais). Comprovantes PIX podem ser apagados sob solicitação após a confirmação
              do pedido.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">7. Seus direitos (Art. 18 LGPD)</h2>
            <p>Você pode, a qualquer momento, solicitar:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Confirmação e acesso aos seus dados</li>
              <li>Correção de dados incompletos ou desatualizados</li>
              <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Portabilidade dos dados</li>
              <li>Revogação de consentimento</li>
              <li>Eliminação dos dados tratados com consentimento</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">8. Segurança</h2>
            <p>
              Aplicamos HTTPS/TLS, cookies <code>HttpOnly + Secure</code>, RLS no banco de dados, isolamento por
              usuário em buckets de comprovantes e verificação de senhas vazadas (HIBP) no cadastro.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold">9. Contato (Encarregado de Dados)</h2>
            <p>
              Para exercer seus direitos ou tirar dúvidas, fale com nosso encarregado pelo e-mail{" "}
              <a href="mailto:spencerscardtopia@gmail.com" className="text-primary underline underline-offset-2">
                spencerscardtopia@gmail.com
              </a>
              . Responderemos em até 15 dias.
            </p>
          </section>
        </div>
      </main>
      
    </div>
  );
};

export default Privacy;
