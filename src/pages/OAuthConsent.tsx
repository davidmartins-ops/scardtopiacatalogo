import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";
import logo from "@/assets/logo.png";

// Beta namespace not yet typed in @supabase/supabase-js — narrow local wrapper.
type OAuthAuthDetails = {
  client?: { name?: string; redirect_uris?: string[]; client_uri?: string };
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { redirect_url?: string; redirect_to?: string };
const oauth = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (
      id: string,
    ) => Promise<{ data: OAuthAuthDetails | null; error: { message: string } | null }>;
    approveAuthorization: (
      id: string,
    ) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
    denyAuthorization: (
      id: string,
    ) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  };
}).oauth;

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthAuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Solicitação de autorização inválida (authorization_id ausente).");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/conta/login?redirect=" + encodeURIComponent(next);
        return;
      }
      setUserEmail(sess.session.user.email ?? null);
      try {
        const { data, error: err } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (err) {
          setError(err.message);
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(approve ? "approve" : "deny");
    try {
      const { data, error: err } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (err) {
        setError(err.message);
        setBusy(null);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setError("O servidor de autorização não retornou uma URL de redirecionamento.");
        setBusy(null);
        return;
      }
      window.location.href = target;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const clientName = details?.client?.name ?? "um aplicativo";
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <main id="main-content" className="w-full max-w-md space-y-6">
        <div className="text-center">
          <img src={logo} alt="Spencer's Cardtopia" className="h-20 mx-auto mb-4 drop-shadow-xl" />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/60 text-muted-foreground text-xs font-body uppercase tracking-wider mb-3">
            <ShieldCheck className="h-3.5 w-3.5" /> Autorização de acesso
          </div>
        </div>

        <div className="glass-card p-6 space-y-4">
          {error ? (
            <>
              <h1 className="text-lg font-bold text-foreground">Não foi possível carregar esta autorização</h1>
              <p className="text-sm text-destructive break-words">{error}</p>
            </>
          ) : !details ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <>
              <h1
                className="text-xl font-bold text-foreground"
                style={{ fontFamily: "'Cinzel Decorative', 'Cinzel', serif", letterSpacing: "0.03em" }}
              >
                Conectar <span className="text-gradient">{clientName}</span> à sua conta
              </h1>
              <p className="text-sm text-muted-foreground">
                Isso permite que <strong>{clientName}</strong> use a Spencer's Cardtopia como você,
                acessando os tools disponíveis enquanto você estiver conectado.
              </p>
              {userEmail && (
                <p className="text-xs text-muted-foreground">
                  Conta conectada: <strong>{userEmail}</strong>
                </p>
              )}
              {scopes.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Permissões solicitadas: {scopes.join(", ")}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Isto não substitui as políticas de acesso do app — cada ação continua sujeita às regras de segurança do backend.
              </p>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={() => decide(true)}
                  disabled={busy !== null}
                >
                  {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprovar"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => decide(false)}
                  disabled={busy !== null}
                >
                  {busy === "deny" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancelar conexão"}
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default OAuthConsent;
