import { useCallback, useEffect, useState } from "react";
import { History, Loader2, Play, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Attempt { id: string; started_at: string; finished_at: string | null; source: string; ok: boolean | null; error: string | null; details: { log?: string[] } | null }

const BackupAttemptsLog = () => {
  const [rows, setRows] = useState<Attempt[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("backup_attempts").select("*").order("started_at", { ascending: false }).limit(30);
    setRows((data ?? []) as unknown as Attempt[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("backup-admin-tools", { body: { action: "run" } });
    setRunning(false);
    if (error || (data as { error?: string })?.error) toast.error("O backup falhou — veja o registro abaixo");
    else toast.success("Backup concluído");
    void load();
  };

  return (
    <section className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Tentativas de backup</h2>
        <Button size="sm" onClick={runNow} disabled={running} className="gap-1">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Rodar agora</Button>
      </div>
      <p className="text-xs text-muted-foreground">Cada tentativa (automática ou manual) fica registrada. Se o servidor estiver lento, o backup tenta de novo sozinho algumas vezes antes de desistir.</p>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma tentativa registrada ainda.</p> : (
        <ul className="divide-y rounded-md border text-sm">
          {rows.map((r) => (
            <li key={r.id} className="p-2">
              <button className="w-full flex items-center gap-2 text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
                {r.ok === null ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : r.ok ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-destructive" />}
                <span>{new Date(r.started_at).toLocaleString("pt-BR")}</span>
                <span className="text-xs text-muted-foreground">{r.source === "manual" ? "manual" : "automático"}</span>
                {r.error && <span className="text-xs text-destructive truncate">{r.error}</span>}
              </button>
              {open === r.id && r.details?.log && (
                <pre className="mt-2 max-h-60 overflow-auto rounded bg-muted/40 p-2 text-xs whitespace-pre-wrap">{r.details.log.join("\n")}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default BackupAttemptsLog;
