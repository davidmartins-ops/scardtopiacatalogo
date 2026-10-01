import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, Smartphone, ScanLine, KeyRound } from "lucide-react";
import { toast } from "sonner";

type Step = "intro" | "enroll";

const DISMISS_KEY_PREFIX = "mfa_prompt_dismissed:";
const DISMISS_DAYS = 7;

const dismissedRecently = (userId: string) => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY_PREFIX + userId);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

const dismiss = (userId: string) => {
  try {
    localStorage.setItem(DISMISS_KEY_PREFIX + userId, String(Date.now()));
  } catch {
    /* ignore */
  }
};

/**
 * Após cada login, convida o usuário a ativar a verificação em duas etapas (2FA).
 * Se recusar, o login segue normalmente e o convite volta a aparecer após alguns dias.
 */
const TwoFactorPrompt = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("intro");
  const [userId, setUserId] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const maybePrompt = useCallback(async (uid: string) => {
    if (dismissedRecently(uid)) return;
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return;
    const hasVerified = (data?.totp ?? []).some((f) => f.status === "verified");
    if (hasVerified) return;
    setUserId(uid);
    setStep("intro");
    setOpen(true);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        const uid = session.user.id;
        setTimeout(() => void maybePrompt(uid), 0);
      }
    });
    return () => subscription.unsubscribe();
  }, [maybePrompt]);

  const startEnroll = async () => {
    setBusy(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      for (const f of data?.all ?? []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: en, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Login ${new Date().toLocaleDateString("pt-BR")}`,
      });
      if (error || !en) {
        toast.error("Não foi possível iniciar a verificação em duas etapas", { description: error?.message });
        return;
      }
      setFactorId(en.id);
      setQr(en.totp.qr_code);
      setSecret(en.totp.secret);
      setStep("enroll");
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    if (!factorId) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (error) {
      toast.error("Código inválido", { description: "Confira o código de 6 dígitos no app autenticador." });
      return;
    }
    setOpen(false);
    setCode("");
    toast.success("Verificação em duas etapas ativada!", {
      description: "Sua conta está mais protegida. Nos próximos acessos sensíveis, pediremos o código do app.",
    });
  };

  const skip = () => {
    if (userId) dismiss(userId);
    setOpen(false);
    toast.info("Sem problema!", {
      description: "Você pode ativar a verificação em duas etapas a qualquer momento na sua conta.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) skip(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        {step === "intro" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Proteja sua conta em 2 etapas
              </DialogTitle>
              <DialogDescription>
                A verificação em duas etapas adiciona uma camada extra de segurança além da senha.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
                <p className="font-medium">Por que é importante?</p>
                <p className="text-muted-foreground">
                  Mesmo que alguém descubra sua senha, não conseguirá entrar na sua conta sem o código
                  gerado no seu celular. Isso protege seus pedidos, endereço e dados pessoais.
                </p>
              </div>
              <ol className="space-y-2">
                <li className="flex gap-2">
                  <Smartphone className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span><strong>1.</strong> Instale um app autenticador gratuito, como Google Authenticator ou Authy.</span>
                </li>
                <li className="flex gap-2">
                  <ScanLine className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span><strong>2.</strong> Escaneie o QR Code que vamos mostrar na próxima tela.</span>
                </li>
                <li className="flex gap-2">
                  <KeyRound className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span><strong>3.</strong> Digite o código de 6 dígitos gerado pelo app para confirmar.</span>
                </li>
              </ol>
              <div className="flex flex-col gap-2 pt-1">
                <Button onClick={() => void startEnroll()} disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Ativar agora
                </Button>
                <Button variant="ghost" onClick={skip}>Agora não, continuar assim</Button>
              </div>
            </div>
          </>
        )}

        {step === "enroll" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-primary" /> Escaneie o QR Code
              </DialogTitle>
              <DialogDescription>
                Abra o app autenticador no seu celular e escaneie o código abaixo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {qr && (
                <div className="flex justify-center rounded-lg border bg-white p-3">
                  <img src={qr} alt="QR Code para configurar a verificação em duas etapas" className="h-44 w-44" />
                </div>
              )}
              {secret && (
                <p className="text-xs text-muted-foreground text-center break-all">
                  Não conseguiu escanear? Digite manualmente: <span className="font-mono font-medium">{secret}</span>
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor="mfa-code">Código de 6 dígitos do app</Label>
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => void confirmCode()} disabled={busy || code.length !== 6}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar e ativar
                </Button>
                <Button variant="ghost" onClick={skip}>Deixar para depois</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TwoFactorPrompt;
