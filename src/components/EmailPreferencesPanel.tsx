import { useEffect, useState } from "react";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

type Prefs = {
  order_received: boolean;
  order_updates: boolean;
  pix_receipt: boolean;
};

const DEFAULT_PREFS: Prefs = {
  order_received: true,
  order_updates: true,
  pix_receipt: true,
};

const ITEMS: Array<{ key: keyof Prefs; title: string; desc: string }> = [
  {
    key: "order_received",
    title: "Confirmação de pedido recebido",
    desc: "Enviado assim que registramos um novo pedido seu, com o resumo dos itens.",
  },
  {
    key: "order_updates",
    title: "Atualizações de status do pedido",
    desc: "Pagamento confirmado, em preparação, despachado, entregue e cancelamentos — inclui código de rastreio.",
  },
  {
    key: "pix_receipt",
    title: "Comprovante PIX recebido",
    desc: "Confirmação de que recebemos seu comprovante e orientações dos próximos passos.",
  },
];

const EmailPreferencesPanel = () => {
  const { user, profile, fetchProfile } = useCustomerAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState<keyof Prefs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const stored = (profile as unknown as { email_preferences?: Partial<Prefs> })
      .email_preferences;
    setPrefs({ ...DEFAULT_PREFS, ...(stored ?? {}) });
    setLoading(false);
  }, [profile]);

  const toggle = async (key: keyof Prefs, value: boolean) => {
    if (!user) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(key);
    const { error } = await supabase
      .from("customer_profiles")
      .update({ email_preferences: next as never } as never)
      .eq("id", user.id);
    setSaving(null);
    if (error) {
      toast.error("Não foi possível salvar sua preferência.");
      setPrefs(prefs);
      return;
    }
    toast.success("Preferência atualizada.");
    fetchProfile(user.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="glass-card p-5 space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            Preferências de comunicação
          </h3>
          <p className="text-sm text-muted-foreground">
            Escolha quais e-mails transacionais você quer receber sobre os seus pedidos.
          </p>
        </div>
      </div>

      <div className="divide-y divide-border">
        {ITEMS.map((it) => (
          <div key={it.key} className="flex items-start justify-between gap-4 py-4">
            <div className="flex-1 min-w-0">
              <Label htmlFor={`pref-${it.key}`} className="text-sm font-semibold text-foreground">
                {it.title}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">{it.desc}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {saving === it.key && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <Switch
                id={`pref-${it.key}`}
                checked={prefs[it.key]}
                onCheckedChange={(v) => toggle(it.key, v)}
                disabled={saving === it.key}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-3">
        E-mails essenciais de autenticação (confirmação de e-mail, recuperação de senha) são
        sempre enviados, independente das preferências acima.
      </p>
    </Card>
  );
};

export default EmailPreferencesPanel;
