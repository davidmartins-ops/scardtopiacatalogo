import { Link } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const PedidoFalha = () => {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-card border rounded-2xl shadow-elegant p-8 text-center">
        <XCircle className="h-14 w-14 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Pagamento não concluído</h1>
        <p className="text-muted-foreground mb-6">
          Seu pagamento foi cancelado ou não pôde ser processado. Você pode tentar novamente
          pelo seu carrinho ou escolher outro método.
        </p>
        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link to="/catalogo">Voltar ao catálogo</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/conta">Meus pedidos</Link>
          </Button>
        </div>
      </div>
    </main>
  );
};

export default PedidoFalha;
