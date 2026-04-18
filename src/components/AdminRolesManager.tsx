import { useEffect, useState } from "react";
import { Loader2, Shield, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminRow {
  id: string;
  user_id: string;
  email: string | null;
  created_at: string;
}

const AdminRolesManager = () => {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-admin-role", {
      body: { action: "list" },
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar admins.");
      return;
    }
    setAdmins((data as any)?.admins ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const grant = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("manage-admin-role", {
      body: { action: "grant", email: email.trim() },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? "Erro ao promover.");
      return;
    }
    toast.success(`${email} promovido a admin!`);
    setEmail("");
    load();
  };

  const revoke = async (targetEmail: string | null) => {
    if (!targetEmail) return;
    if (!confirm(`Revogar admin de ${targetEmail}?`)) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("manage-admin-role", {
      body: { action: "revoke", email: targetEmail },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? "Erro ao revogar.");
      return;
    }
    toast.success("Admin revogado!");
    load();
  };

  return (
    <div className="glass-card p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Gerenciar Administradores</h2>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Promover usuário (email cadastrado)</label>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="usuario@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-muted/30"
            onKeyDown={(e) => e.key === "Enter" && grant()}
          />
          <Button onClick={grant} disabled={busy || !email.trim()} className="gap-1.5 shrink-0">
            <UserPlus className="h-4 w-4" /> Promover
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          O usuário precisa ter feito login ao menos uma vez para ser encontrado.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Administradores ativos ({admins.length})</h3>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : admins.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum admin cadastrado.</p>
        ) : (
          <div className="space-y-1.5">
            {admins.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-muted/20 border border-border/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {a.email ?? <span className="italic text-muted-foreground">sem email</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Desde {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => revoke(a.email)}
                  disabled={busy || !a.email}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRolesManager;
