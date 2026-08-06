import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Coins, Loader2, Search, Plus, Minus, History } from "lucide-react";
import { toast } from "sonner";
import useSEO from "@/hooks/use-seo";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface CreditRow {
  user_id: string;
  balance: number;
  updated_at: string;
  email: string | null;
  display_name: string | null;
}

interface CreditTx {
  id: string;
  amount: number;
  kind: "admin_add" | "admin_remove" | "order_debit" | "order_refund";
  order_id: string | null;
  note: string | null;
  created_at: string;
}

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const kindLabel: Record<CreditTx["kind"], string> = {
  admin_add: "Adição (admin)",
  admin_remove: "Remoção (admin)",
  order_debit: "Débito em pedido",
  order_refund: "Reembolso de pedido",
};

const AdminStoreCredits = () => {
  useSEO({ title: "Créditos do site", canonical: "https://www.spencerscardtopia.com.br/admin/creditos", noindex: true });

  const [list, setList] = useState<CreditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState<CreditRow | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<CreditTx[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadList = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-store-credit", {
      body: { action: "list" },
    });
    setLoading(false);
    if (error) return toast.error("Erro ao carregar saldos.");
    setList(((data as any)?.credits ?? []) as CreditRow[]);
  };

  useEffect(() => {
    loadList();
  }, []);

  const lookup = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    const { data, error } = await supabase.functions.invoke("admin-store-credit", {
      body: { action: "lookup", email: searchEmail.trim() },
    });
    setSearching(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? "Erro ao buscar.");
      return;
    }
    setTarget(data as CreditRow);
    setAmount("");
    setNote("");
  };

  const pickRow = (r: CreditRow) => {
    setTarget(r);
    setAmount("");
    setNote("");
  };

  const applyAdjust = async (signed: number) => {
    if (!target || !Number.isFinite(signed) || signed === 0) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-store-credit", {
      body: {
        action: "adjust",
        user_id: target.user_id,
        amount: signed,
        note: note.trim() || null,
      },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? "Erro ao ajustar saldo.");
      return;
    }
    const newBal = Number((data as any)?.balance ?? 0);
    setTarget({ ...target, balance: newBal, updated_at: new Date().toISOString() });
    setAmount("");
    setNote("");
    toast.success(`Novo saldo: ${fmt(newBal)}`);
    loadList();
  };

  const openHistory = async () => {
    if (!target) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-store-credit", {
      body: { action: "history", user_id: target.user_id },
    });
    setHistoryLoading(false);
    if (error) return toast.error("Erro ao carregar histórico.");
    setHistory(((data as any)?.transactions ?? []) as CreditTx[]);
  };

  const parsedAmount = Number(amount.replace(",", "."));

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Painel</Link>
            </Button>
            <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
              <Coins className="h-6 w-6 text-primary" /> Créditos do site
            </h1>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-6 space-y-4">
          <Label className="text-sm">Buscar cliente por e-mail</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="cliente@email.com"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
            />
            <Button onClick={lookup} disabled={searching || !searchEmail.trim()} className="gap-1.5 shrink-0">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </Button>
          </div>

          {target && (
            <div className="mt-4 p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{target.display_name || target.email || "Cliente"}</p>
                  <p className="text-xs text-muted-foreground">{target.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted-foreground">Saldo</p>
                  <p className="text-xl font-bold text-primary">{fmt(target.balance)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="50,00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Motivo (opcional)</Label>
                  <Input
                    placeholder="Ex.: bônus, ajuste, cashback"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => applyAdjust(Math.abs(parsedAmount))}
                  disabled={saving || !Number.isFinite(parsedAmount) || parsedAmount <= 0}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Adicionar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => applyAdjust(-Math.abs(parsedAmount))}
                  disabled={saving || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || target.balance <= 0}
                  className="gap-1.5"
                >
                  <Minus className="h-4 w-4" /> Remover
                </Button>
              </div>

              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={openHistory} className="gap-1.5">
                  <History className="h-4 w-4" /> Ver histórico
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg font-semibold">Clientes com saldo</h2>
            <p className="text-xs text-muted-foreground">{list.length} conta(s)</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum cliente com saldo. Busque por e-mail acima para adicionar créditos.
            </p>
          ) : (
            <div className="space-y-1.5">
              {list.map((r) => (
                <button
                  key={r.user_id}
                  onClick={() => pickRow(r)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-muted/20 border border-border/40 hover:border-primary/40 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {r.display_name || r.email || <span className="italic text-muted-foreground">sem nome</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.email}</p>
                  </div>
                  <p className="text-sm font-bold text-primary shrink-0">{fmt(r.balance)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Histórico — {target?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-1.5">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem movimentações.</p>
            ) : (
              history.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-start justify-between gap-3 px-3 py-2 rounded-lg bg-muted/20 border border-border/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{kindLabel[tx.kind]}</p>
                    {tx.note && <p className="text-[11px] text-muted-foreground truncate">{tx.note}</p>}
                    {tx.order_id && (
                      <Link
                        to={`/admin/pedidos/${tx.order_id}`}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Pedido {tx.order_id.slice(0, 8)}
                      </Link>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-bold shrink-0 ${
                      tx.amount >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {tx.amount >= 0 ? "+" : ""}
                    {fmt(tx.amount)}
                  </p>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminStoreCredits;
