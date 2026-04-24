import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAdminOrders, type OrderStatus } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileSpreadsheet, Save, Trash2, Loader2, Filter } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const STATUS_OPTIONS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "pending_payment", label: "Aguardando pagamento" },
  { value: "payment_confirmed", label: "Pagamento confirmado" },
  { value: "preparing", label: "Em preparação" },
  { value: "shipped", label: "Despachado" },
  { value: "delivered", label: "Entregue" },
  { value: "cancelled", label: "Cancelado" },
];

const PAYMENT_OPTIONS = [
  { value: "all", label: "Todos os métodos" },
  { value: "pix", label: "PIX" },
  { value: "credit", label: "Crédito" },
  { value: "debit", label: "Débito" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "other", label: "Outro" },
];

interface SavedFilter {
  id: string;
  name: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  paymentMethod: string;
}

const STORAGE_KEY = "admin_report_saved_filters_v1";

const csvEscape = (val: unknown): string => {
  const s = String(val ?? "");
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s.label])) as Record<string, string>;
const PAYMENT_LABEL = Object.fromEntries(PAYMENT_OPTIONS.map((p) => [p.value, p.label])) as Record<string, string>;

const AdminReports = () => {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { orders, isLoading } = useAdminOrders();
  const user = session?.user ?? null;

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [paymentMethod, setPaymentMethod] = useState<string>("all");
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [filterName, setFilterName] = useState("");

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  // Load saved filters
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedFilters(JSON.parse(raw));
    } catch {/* noop */}
  }, []);

  const persistFilters = useCallback((next: SavedFilter[]) => {
    setSavedFilters(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      const pm = (o as any).payment_method ?? "whatsapp";
      if (paymentMethod !== "all" && pm !== paymentMethod) return false;
      const ts = new Date(o.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    });
  }, [orders, status, paymentMethod, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const valid = filtered.filter((o) => o.status !== "cancelled");
    const revenue = valid.reduce((s, o) => s + Number(o.total ?? 0), 0);
    return { count: filtered.length, revenue };
  }, [filtered]);

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum pedido para exportar.");
      return;
    }
    const header = [
      "ID", "Data", "Status", "Método de pagamento", "Total (R$)",
      "Cliente (nome)", "CPF", "Telefone", "Email/UserID",
      "Código rastreio", "Itens", "Comprovante",
    ];
    const rows = filtered.map((o) => {
      const ci = ((o as any).customer_info ?? {}) as { name?: string; cpf?: string; phone?: string; email?: string };
      const pm = (o as any).payment_method ?? "whatsapp";
      return [
        o.id,
        new Date(o.created_at).toLocaleString("pt-BR"),
        STATUS_LABEL[o.status] ?? o.status,
        PAYMENT_LABEL[pm] ?? pm,
        Number(o.total).toFixed(2).replace(".", ","),
        ci.name ?? "",
        ci.cpf ?? "",
        ci.phone ?? "",
        ci.email ?? o.user_id ?? "visitante",
        o.tracking_code ?? "",
        (o.items as any[]).map((it) => `${it.quantity}× ${it.name}`).join(" | "),
        o.receipt_url ?? "",
      ];
    });
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    link.download = `relatorio-pedidos-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} pedido(s) exportado(s).`);
  };

  const saveCurrentFilter = () => {
    if (!filterName.trim()) {
      toast.error("Dê um nome ao filtro.");
      return;
    }
    const newFilter: SavedFilter = {
      id: crypto.randomUUID(),
      name: filterName.trim(),
      dateFrom, dateTo, status, paymentMethod,
    };
    persistFilters([...savedFilters, newFilter]);
    setFilterName("");
    toast.success("Filtro salvo.");
  };

  const applyFilter = (f: SavedFilter) => {
    setDateFrom(f.dateFrom);
    setDateTo(f.dateTo);
    setStatus(f.status);
    setPaymentMethod(f.paymentMethod);
  };

  const removeFilter = (id: string) => {
    persistFilters(savedFilters.filter((f) => f.id !== id));
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body">
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Voltar ao painel">
              <img src={logo} alt="Spencer's Cardtopia" className="h-10" />
            </Link>
            <div>
              <h1 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" /> Relatórios CSV
              </h1>
              <p className="text-[11px] text-muted-foreground">Exporte pedidos com filtros salvos</p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/"><ArrowLeft className="h-3.5 w-3.5" /> Painel</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Filters */}
        <Card className="glass-card p-4 space-y-3">
          <h2 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" /> Filtros
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="from" className="text-[11px] text-muted-foreground">De</Label>
              <Input id="from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <Label htmlFor="to" className="text-[11px] text-muted-foreground">Até</Label>
              <Input id="to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-xs" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Método de pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border/40 flex-wrap">
            <Input
              placeholder="Nome do filtro (ex: Vendas PIX semana atual)"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="h-9 text-xs flex-1 min-w-[200px]"
            />
            <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={saveCurrentFilter}>
              <Save className="h-3.5 w-3.5" /> Salvar filtro
            </Button>
            <Button size="sm" className="h-9 gap-1.5" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" /> Exportar CSV ({filtered.length})
            </Button>
          </div>
        </Card>

        {/* Saved filters */}
        {savedFilters.length > 0 && (
          <Card className="glass-card p-4 space-y-2">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Filtros salvos</h3>
            <div className="flex flex-wrap gap-2">
              {savedFilters.map((f) => (
                <div key={f.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/20 pl-3 pr-1 py-0.5">
                  <button
                    onClick={() => applyFilter(f)}
                    className="text-xs text-foreground hover:text-primary"
                  >
                    {f.name}
                  </button>
                  <button
                    onClick={() => removeFilter(f.id)}
                    aria-label={`Remover filtro ${f.name}`}
                    className="h-5 w-5 inline-flex items-center justify-center text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="glass-card p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pedidos no filtro</p>
            <p className="text-2xl font-display font-bold text-foreground mt-1">{stats.count}</p>
          </Card>
          <Card className="glass-card p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Receita (excl. cancelados)</p>
            <p className="text-2xl font-display font-bold text-primary mt-1">
              R$ {stats.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </Card>
        </div>

        {/* Preview */}
        <Card className="glass-card p-4">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Pré-visualização (primeiros 20)</h3>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum pedido com os filtros atuais.</p>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {filtered.slice(0, 20).map((o) => {
                const pm = (o as any).payment_method ?? "whatsapp";
                const ci = ((o as any).customer_info ?? {}) as { name?: string };
                return (
                  <div key={o.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded border border-border/40 bg-muted/10">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">#{o.id.slice(0, 8)}</span>
                        <Badge variant="outline" className="text-[9px] py-0 px-1.5">{STATUS_LABEL[o.status] ?? o.status}</Badge>
                        <Badge variant="outline" className="text-[9px] py-0 px-1.5">{PAYMENT_LABEL[pm] ?? pm}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {new Date(o.created_at).toLocaleString("pt-BR")} · {ci.name ?? "—"}
                      </p>
                    </div>
                    <span className="font-semibold text-primary tabular-nums shrink-0">
                      R$ {Number(o.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default AdminReports;
