import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type State = "loading" | "confirmed" | "unpaid" | "error" | "missing";

const PedidoSucesso = () => {
  const [params] = useSearchParams();
  const [state, setState] = useState<State>("loading");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  const order_nsu = params.get("order_nsu");
  const transaction_nsu = params.get("transaction_nsu");
  const slug = params.get("slug") ?? undefined;
  const receipt_url = params.get("receipt_url") ?? undefined;
  const capture_method = params.get("capture_method") ?? undefined;

  useEffect(() => {
    if (!order_nsu || !transaction_nsu) {
      setState("missing");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("confirm-payment", {
          body: { order_nsu, transaction_nsu, slug, receipt_url, capture_method },
        });
        if (cancelled) return;
        if (error) {
          setState("error");
          setMessage(error.message);
          return;
        }
        if (data?.ok) {
          setOrderId(data.order_id ?? order_nsu);
          setState("confirmed");
        } else if (data?.status === "unpaid") {
          setState("unpaid");
        } else {
          setState("error");
          setMessage(data?.status ?? "Erro desconhecido");
        }
      } catch (e: any) {
        if (cancelled) return;
        setState("error");
        setMessage(e?.message ?? "Erro inesperado");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [order_nsu, transaction_nsu, slug, receipt_url, capture_method]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-card border rounded-2xl shadow-elegant p-8 text-center">
        {state === "loading" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Confirmando seu pagamento...</h1>
            <p className="text-muted-foreground">Isso leva apenas alguns segundos.</p>
          </>
        )}
        {state === "confirmed" && (
          <>
            <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Pagamento confirmado!</h1>
            <p className="text-muted-foreground mb-6">
              Recebemos seu pagamento. Em breve preparamos seu pedido.
            </p>
            <div className="flex flex-col gap-2">
              {orderId && (
                <Button asChild>
                  <Link to={`/conta/pedidos/${orderId}`}>Ver detalhes do pedido</Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link to="/catalogo">Continuar comprando</Link>
              </Button>
            </div>
          </>
        )}
        {state === "unpaid" && (
          <>
            <AlertTriangle className="h-14 w-14 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Pagamento ainda não confirmado</h1>
            <p className="text-muted-foreground mb-6">
              Se você acabou de pagar via PIX, pode levar alguns instantes. Atualize esta página
              em alguns segundos.
            </p>
            <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
          </>
        )}
        {state === "missing" && (
          <>
            <AlertTriangle className="h-14 w-14 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Dados de pagamento ausentes</h1>
            <p className="text-muted-foreground mb-6">
              Não conseguimos identificar o pagamento. Acesse seu pedido pelo painel da sua conta.
            </p>
            <Button asChild>
              <Link to="/conta">Minha conta</Link>
            </Button>
          </>
        )}
        {state === "error" && (
          <>
            <AlertTriangle className="h-14 w-14 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Não foi possível confirmar</h1>
            <p className="text-muted-foreground mb-2">
              {message || "Ocorreu um erro ao validar o pagamento."}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Se o valor já foi debitado, entre em contato pelo WhatsApp informando o número do pedido.
            </p>
            <Button asChild>
              <Link to="/conta">Minha conta</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
};

export default PedidoSucesso;
