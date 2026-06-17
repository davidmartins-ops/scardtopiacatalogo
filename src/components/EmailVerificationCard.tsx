import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MailCheck, MailWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props { user: User | null }

const EmailVerificationCard = ({ user }: Props) => {
  const [sending, setSending] = useState(false);
  if (!user?.email) return null;
  const confirmed = !!user.email_confirmed_at;

  const resend = async () => {
    setSending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: user.email! });
      if (error) throw error;
      toast.success("E-mail de verificação reenviado. Confira sua caixa de entrada.");
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível reenviar agora.");
    } finally { setSending(false); }
  };

  return (
    <Card className="p-4 mb-4 flex flex-wrap items-center gap-3">
      {confirmed ? (
        <>
          <MailCheck className="h-5 w-5 text-green-600" />
          <div className="flex-1">
            <div className="font-display text-sm">E-mail verificado</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
          <Badge variant="secondary">Confirmado</Badge>
        </>
      ) : (
        <>
          <MailWarning className="h-5 w-5 text-amber-600" />
          <div className="flex-1 min-w-[200px]">
            <div className="font-display text-sm">Confirme seu e-mail</div>
            <div className="text-xs text-muted-foreground">
              Enviamos um link para <strong>{user.email}</strong>. Confirme para garantir o recebimento das notificações.
            </div>
          </div>
          <Button size="sm" onClick={resend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reenviar verificação"}
          </Button>
        </>
      )}
    </Card>
  );
};

export default EmailVerificationCard;
