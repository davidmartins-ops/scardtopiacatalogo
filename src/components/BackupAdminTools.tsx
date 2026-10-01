import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface HealthResult {
  ok: boolean;
  steps: { step: string; ok: boolean; detail?: string }[];
  last_backup_at: string | null;
  checked_at: string;
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

async function invokeError(error: unknown, data: unknown) {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try { return (await ctx.json())?.error ?? "Falha"; } catch { /* ignore */ }
  }
  return (data as { error?: string })?.error ?? (error as Error)?.message ?? "Falha";
}

const BackupAdminTools = () => {
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [logs, setLogs] = useState("");
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const loadLatest = useCallback(async () => {
    const { data } = await supabase
      .from("admin_audit_log")
      .select("metadata")
      .eq("action", "backup_health_check")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.metadata) setHealth(data.metadata as unknown as HealthResult);
  }, []);

  useEffect(() => { void loadLatest(); }, [loadLatest]);

  const runCheck = async () => {
    setChecking(true);
    const { data, error } = await supabase.functions.invoke("backup-admin-tools", { body: { action: "health" } });
    setChecking(false);
    if (error || (data as { error?: string })?.error) { toast.error("Falha na verificação", { description: await invokeError(error, data) }); return; }
    setHealth(data as HealthResult);
  };

  const analyze = async () => {
    setAnalyzing(true);
    setDiagnosis(null);
    const { data, error } = await supabase.functions.invoke("backup-admin-tools", { body: { action: "diagnose", logs } });
    setAnalyzing(false);
    if (error || (data as { error?: string })?.error) { toast.error("Não foi possível analisar", { description: await invokeError(error, data) }); return; }
    setDiagnosis((data as { diagnosis: string }).diagnosis);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Saúde do cofre</h2>
          <Button size="sm" onClick={runCheck} disabled={checking}>{checking && <Loader2 className="h-4 w-4 animate-spin" />} Verificar agora</Button>
        </div>
        {!health ? (
          <p className="text-sm text-muted-foreground">Nenhuma verificação ainda.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p className={health.ok ? "text-primary font-medium" : "text-destructive font-medium"}>
              {health.ok ? "Tudo funcionando: backups podem ser gravados e lidos." : "Há problemas no cofre."}
            </p>
            <ul className="space-y-1">
              {health.steps.map((s) => (
                <li key={s.step} className="flex items-start gap-2">
                  {s.ok ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                  <span>{s.step}{s.detail && <span className="text-muted-foreground"> — {s.detail}</span>}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Verificado em {fmt(health.checked_at)} · Último backup: {fmt(health.last_backup_at)}</p>
          </div>
        )}
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Diagnóstico de falhas com IA</h2>
        <p className="text-xs text-muted-foreground">Cole os registros (logs) de um backup que falhou. A IA indica a causa provável e os passos para recuperar.</p>
        <Textarea value={logs} onChange={(e) => setLogs(e.target.value)} rows={6} maxLength={30000} placeholder="Cole aqui os logs do backup…" className="font-mono text-xs" />
        <Button size="sm" onClick={analyze} disabled={analyzing || logs.trim().length < 10}>{analyzing && <Loader2 className="h-4 w-4 animate-spin" />} Analisar logs</Button>
        {diagnosis && <div className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap">{diagnosis}</div>}
      </section>
    </div>
  );
};

export default BackupAdminTools;
