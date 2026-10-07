import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Loader2, ShieldCheck, Lock, FileJson, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/admin-audit";
import BackupAdminTools from "@/components/BackupAdminTools";
import BackupAttemptsLog from "@/components/BackupAttemptsLog";

type Step = "loading" | "password" | "enroll" | "verify" | "ready";
const BUCKET = "sales-backups";

interface Entry { path: string; size: number; updated: string }

const AdminBackups = () => {
  const [step, setStep] = useState<Step>("loading");
  const [email, setEmail] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [folder, setFolder] = useState<"daily" | "comprovantes">("daily");

  const afterPassword = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = data?.totp?.find((f) => f.status === "verified");
    if (totp) {
      setFactorId(totp.id);
      setStep("verify");
    } else {
      // remove stale unverified factors then enroll
      for (const f of data?.all ?? []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: en, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Backups ${Date.now()}` });
      if (error || !en) { toast.error("Não foi possível iniciar a verificação em duas etapas", { description: error?.message }); return; }
      setFactorId(en.id);
      setQr(en.totp.qr_code);
      setSecret(en.totp.secret);
      setStep("enroll");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email ?? "");
      const pwd = (user?.identities ?? []).some((i) => i.provider === "email");
      setHasPassword(pwd);
      if (pwd) setStep("password");
      else await afterPassword();
    })();
  }, [afterPassword]);

  const submitPassword = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    setPassword("");
    if (error) { toast.error("Senha incorreta"); return; }
    await afterPassword();
  };

  const submitCode = async () => {
    if (!factorId) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    setCode("");
    if (error) { toast.error("Código inválido", { description: "Confira o código no app autenticador." }); return; }
    await logAdminAction("backup_access", "sales_backups", "vault", { hasPassword });
    setStep("ready");
  };

  const load = useCallback(async (f: "daily" | "comprovantes") => {
    const collect: Entry[] = [];
    const walk = async (prefix: string) => {
      const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, sortBy: { column: "name", order: "desc" } });
      if (error) throw error;
      for (const e of data ?? []) {
        const p = `${prefix}/${e.name}`;
        if (e.id === null) await walk(p);
        else collect.push({ path: p, size: (e.metadata as { size?: number })?.size ?? 0, updated: e.updated_at ?? "" });
      }
    };
    try {
      await walk(f);
      setEntries(collect.sort((a, b) => b.path.localeCompare(a.path)));
    } catch (e) {
      toast.error("Falha ao carregar backups", { description: (e as Error).message });
    }
  }, []);

  useEffect(() => { if (step === "ready") void load(folder); }, [step, folder, load]);

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60, { download: true });
    if (error || !data) { toast.error("Falha ao gerar download", { description: error?.message }); return; }
    await logAdminAction("backup_download", "sales_backups", path, {});
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-6 space-y-6">
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link to="/admin"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" /> Cofre de backups</h1>
          <p className="text-sm text-muted-foreground">Cópia diária das vendas, pagamentos, reembolsos e comprovantes PIX. Guardada por 5 anos.</p>
        </div>

        {step === "loading" && <Loader2 className="h-6 w-6 animate-spin text-primary" />}

        {step === "password" && (
          <form className="rounded-lg border p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void submitPassword(); }}>
            <p className="text-sm flex items-center gap-2"><Lock className="h-4 w-4" /> Confirme sua senha para continuar.</p>
            <div className="space-y-1">
              <Label htmlFor="bk-pwd">Senha</Label>
              <Input id="bk-pwd" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={busy || !password}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Continuar</Button>
          </form>
        )}

        {step === "enroll" && (
          <form className="rounded-lg border p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void submitCode(); }}>
            <p className="text-sm">Ative a verificação em duas etapas: escaneie o QR Code no Google Authenticator ou Authy e digite o código de 6 dígitos.</p>
            {qr && <img src={qr} alt="QR Code para o app autenticador" className="h-48 w-48 rounded bg-card p-2" />}
            {secret && <p className="text-xs text-muted-foreground break-all">Ou digite a chave: <span className="font-mono">{secret}</span></p>}
            <div className="space-y-1">
              <Label htmlFor="bk-code">Código</Label>
              <Input id="bk-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
            </div>
            <Button type="submit" disabled={busy || code.length !== 6}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Ativar e entrar</Button>
          </form>
        )}

        {step === "verify" && (
          <form className="rounded-lg border p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void submitCode(); }}>
            <p className="text-sm">Digite o código de 6 dígitos do seu app autenticador.</p>
            <div className="space-y-1">
              <Label htmlFor="bk-code2">Código</Label>
              <Input id="bk-code2" inputMode="numeric" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
            </div>
            <Button type="submit" disabled={busy || code.length !== 6}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Entrar</Button>
          </form>
        )}

        {step === "ready" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant={folder === "daily" ? "default" : "outline"} onClick={() => setFolder("daily")} className="gap-1"><FileJson className="h-4 w-4" /> Vendas diárias</Button>
              <Button size="sm" variant={folder === "comprovantes" ? "default" : "outline"} onClick={() => setFolder("comprovantes")} className="gap-1"><FileText className="h-4 w-4" /> Comprovantes</Button>
            </div>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground border rounded-lg p-6 text-center">Nenhum arquivo ainda. O primeiro backup é gerado na próxima madrugada.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {entries.map((e) => (
                  <li key={e.path} className="flex items-center justify-between gap-2 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs">{e.path.replace(`${folder}/`, "")}</p>
                      <p className="text-xs text-muted-foreground">{(e.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => download(e.path)} className="gap-1 shrink-0"><Download className="h-4 w-4" /> Baixar</Button>
                  </li>
                ))}
              </ul>
            )}
            <BackupAttemptsLog />
            <BackupAdminTools />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBackups;
