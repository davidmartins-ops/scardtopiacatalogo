import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";
import logo from "@/assets/logo.png";

type Status = "validating" | "ready" | "already" | "invalid" | "submitting" | "done" | "error";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("validating");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setErrorMsg("Link inválido — token ausente.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const body = await res.json();
        if (!res.ok) {
          setStatus("invalid");
          setErrorMsg(body.error ?? "Token inválido ou expirado.");
          return;
        }
        if (body.valid === false && body.reason === "already_unsubscribed") {
          setStatus("already");
          return;
        }
        setStatus("ready");
      } catch {
        setStatus("invalid");
        setErrorMsg("Não foi possível validar o link.");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setStatus("submitting");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();
      if (res.ok && (body.success || body.reason === "already_unsubscribed")) {
        setStatus("done");
      } else {
        setStatus("error");
        setErrorMsg(body.error ?? "Erro ao processar.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Erro de rede.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 font-body">
      <div className="glass-card p-8 max-w-md w-full text-center space-y-5">
        <Link to="/catalogo"><img src={logo} alt="Spencer's Cardtopia" className="h-14 mx-auto" /></Link>
        <h1 className="font-display text-2xl font-bold">
          <span className="text-gradient">Cancelar inscrição</span>
        </h1>

        {status === "validating" && (
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Validando link…</p>
          </div>
        )}

        {status === "ready" && (
          <>
            <Mail className="h-10 w-10 text-primary mx-auto" />
            <p className="text-sm text-foreground">
              Confirme abaixo para parar de receber emails da Spencer's Cardtopia neste endereço.
            </p>
            <Button onClick={confirm} className="w-full">Confirmar cancelamento</Button>
            <Link to="/catalogo">
              <Button variant="ghost" className="w-full">Manter inscrição</Button>
            </Link>
          </>
        )}

        {status === "submitting" && (
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processando…</p>
          </div>
        )}

        {status === "done" && (
          <>
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <p className="text-sm">Inscrição cancelada com sucesso. Você não receberá mais emails.</p>
            <Link to="/catalogo"><Button variant="outline" className="w-full">Voltar ao catálogo</Button></Link>
          </>
        )}

        {status === "already" && (
          <>
            <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Este email já estava cancelado.</p>
            <Link to="/catalogo"><Button variant="outline" className="w-full">Voltar ao catálogo</Button></Link>
          </>
        )}

        {(status === "invalid" || status === "error") && (
          <>
            <XCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{errorMsg || "Link inválido."}</p>
            <Link to="/catalogo"><Button variant="outline" className="w-full">Voltar ao catálogo</Button></Link>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
