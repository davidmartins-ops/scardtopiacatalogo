import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Activity, Cpu, MemoryStick, Plug, Clock, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface Status {
  checked_at: string; db_ok: boolean; db_latency_ms: number;
  cpu_percent?: number | null; memory_percent?: number | null;
  connections?: number | null; max_connections?: number | null;
  restarted_at?: string | null; metrics_error?: string;
}

const TIMEOUT = 20000;

const since = (iso?: string | null) => {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}min` : `${m}min`;
};

const level = (v: number | null | undefined, warn: number, crit: number) =>
  v == null ? "text-muted-foreground" : v >= crit ? "text-destructive" : v >= warn ? "text-accent-foreground" : "text-primary";

const Card = ({ icon: Icon, title, value, sub, cls }: { icon: typeof Cpu; title: string; value: string; sub?: string; cls?: string }) => (
  <div className="rounded-lg border bg-card p-4 space-y-1">
    <p className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="h-4 w-4" /> {title}</p>
    <p className={`text-2xl font-semibold ${cls ?? ""}`}>{value}</p>
    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
  </div>
);

const AdminServerStatus = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const timer = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT));
    try {
      const { data, error } = await Promise.race([supabase.functions.invoke("server-status"), timer]);
      if (error) throw error;
      setStatus(data as Status);
    } catch (e) {
      setError((e as Error).message === "timeout"
        ? "O servidor não respondeu em 20 segundos. Ele pode estar travado — se continuar assim, é hora de reiniciar."
        : "Não foi possível obter o status do servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const s = status;
  const connPct = s?.connections != null && s?.max_connections ? (s.connections / s.max_connections) * 100 : null;
  const slow = s && (s.db_latency_ms > 3000 || !s.db_ok);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-6 space-y-6">
        <Button variant="ghost" size="sm" asChild className="gap-1"><Link to="/admin"><ArrowLeft className="h-4 w-4" /> Voltar</Link></Button>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="font-display text-2xl flex items-center gap-2"><Activity className="h-6 w-6 text-primary" /> Status do servidor</h1>
            <p className="text-sm text-muted-foreground">Atualiza sozinho a cada 30 segundos.</p>
          </div>
          <Button size="sm" onClick={load} disabled={loading} className="gap-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar
          </Button>
        </div>

        {(error || slow) && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm flex gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <span>{error ?? `O banco está respondendo devagar (${s!.db_latency_ms} ms). Pode estar sobrecarregado.`}</span>
          </div>
        )}

        {s && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card icon={Cpu} title="CPU" value={s.cpu_percent != null ? `${s.cpu_percent.toFixed(0)}%` : "—"} cls={level(s.cpu_percent, 70, 90)} />
              <Card icon={MemoryStick} title="Memória" value={s.memory_percent != null ? `${s.memory_percent.toFixed(0)}%` : "—"} cls={level(s.memory_percent, 75, 90)} />
              <Card icon={Plug} title="Conexões" value={s.connections != null ? `${s.connections}${s.max_connections ? `/${s.max_connections}` : ""}` : "—"} cls={level(connPct, 70, 90)} />
              <Card icon={Clock} title="Desde o último reinício" value={since(s.restarted_at)} sub={s.restarted_at ? new Date(s.restarted_at).toLocaleString("pt-BR") : undefined} />
            </div>
            <p className="text-xs text-muted-foreground">
              Tempo de resposta do banco: <span className={level(s.db_latency_ms, 1000, 3000)}>{s.db_latency_ms} ms</span> · Verificado em {new Date(s.checked_at).toLocaleTimeString("pt-BR")}
            </p>
            {s.metrics_error && <p className="text-xs text-muted-foreground">Algumas métricas não estão disponíveis agora.</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminServerStatus;
