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

  // Fallback: se o webhook não confirmar, reconsultamos o provedor automaticamente
  const [rechecking, setRechecking] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);

  const recheck = async () => {
    if (!order_nsu) return;
    setRechecking(true);
    try {
      const { data } = await supabase.functions.invoke("check-payment-status", {
        body: { order_id: order_nsu },
      });
      if (data?.paid || data?.status === "payment_confirmed") {
        setOrderId(order_nsu);
        setState("confirmed");
      }
    } catch {
      /* segue tentando */
    } finally {
      setRechecking(false);
    }
  };

  useEffect(() => {
    if (state !== "unpaid" || !order_nsu) return;
    let ticks = 0;
    const interval = setInterval(async () => {
      ticks += 1;
      await recheck();
      if (ticks >= 10) {
        setGaveUp(true);
        clearInterval(interval);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [state, order_nsu]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-card border rounded-2xl shadow-elegant p-8 text-center">
        {state === "loading" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Confirmando seu pagamento...</h1>
            <p className="text-muted-foreground">A confirmação é automática e leva apenas alguns segundos.</p>
          </>
        )}
        {state === "confirmed" && (
          <>
            <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Pagamento confirmado!</h1>
            <p className="text-muted-foreground mb-2">
              Seu PIX foi confirmado automaticamente — não é necessário enviar comprovante.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Próximo passo: separamos os itens e emitimos a etiqueta de envio. O código de rastreio
              aparece no seu pedido e você recebe um e-mail em cada atualização.
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
            <p className="text-muted-foreground mb-2">
              Estamos reconsultando o pagamento automaticamente a cada poucos segundos. Se você acabou
              de pagar via PIX, esta tela muda sozinha.
            </p>
            {gaveUp && (
              <p className="text-sm text-muted-foreground mb-2">
                Ainda sem confirmação. Você pode reconsultar manualmente ou enviar o comprovante pelo
                carrinho para conferência da nossa equipe.
              </p>
            )}
            <div className="flex flex-col gap-2 mt-4">
              <Button onClick={recheck} disabled={rechecking}>
                {rechecking ? "Reconsultando..." : "Reconsultar agora"}
              </Button>
              <Button asChild variant="outline">
                <Link to="/conta">Meus pedidos</Link>
              </Button>
            </div>
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
