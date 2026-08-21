import { useNavigate } from "react-router-dom";
import { useAdminSpecialOrders, SPECIAL_ORDER_STATUS_LABELS } from "@/hooks/use-special-orders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ChevronRight, Search, Package, FileDown, Printer, Pencil, ListChecks } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const statusBadgeVariant: Record<string, string> = {
  requested: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  quoted: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  approved: "bg-green-500/10 text-green-500 border-green-500/20",
  paid: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  ordered: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  received: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  shipped: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  delivered: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const brl = (v: number) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const skuOf = (description?: string | null) => {
  const m = (description ?? "").match(/SKU:\s*([^\n]+)/i);
  return m ? m[1].trim() : "";
};

const AdminSpecialOrders = () => {
  const navigate = useNavigate();
  const { orders, isLoading, updateStatus, updateItemSpecs } = useAdminSpecialOrders();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [specSearch, setSpecSearch] = useState("");
  const [editItem, setEditItem] = useState<any | null>(null);
  const [specDraft, setSpecDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");

  const filtered = (orders ?? []).filter((o: any) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    const items = o.items ?? [];
    const spec = specSearch.trim().toLowerCase();
    if (spec) {
      const matchesSpec = items.some((it: any) =>
        `${it.description ?? ""}\n${it.admin_notes ?? ""}`.toLowerCase().includes(spec)
      );
      if (!matchesSpec) return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const info = o.customer_info || {};
    return (
      o.id.toLowerCase().includes(q) ||
      (info.email && info.email.toLowerCase().includes(q)) ||
      (info.name && info.name.toLowerCase().includes(q)) ||
      (info.phone && info.phone.toLowerCase().includes(q)) ||
      items.some((it: any) =>
        (it.name ?? "").toLowerCase().includes(q) ||
        (it.description ?? "").toLowerCase().includes(q) ||
        (it.admin_notes ?? "").toLowerCase().includes(q)
      )
    );
  });

  const handleStatus = async (id: string, status: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: status as any });
      toast.success("Status atualizado e cliente notificado por e-mail.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar status.");
    }
  };

  const openSpecEditor = (item: any) => {
    setEditItem(item);
    setSpecDraft(item.description ?? "");
    setNotesDraft(item.admin_notes ?? "");
  };

  const saveSpecs = async () => {
    if (!editItem) return;
    try {
      await updateItemSpecs.mutateAsync({
        item_id: editItem.id,
        description: specDraft.trim() || null,
        admin_notes: notesDraft.trim() || null,
      });
      toast.success("Especificações do item atualizadas.");
      setEditItem(null);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar especificações.");
    }
  };

  const exportCSV = () => {
    const rows: string[][] = [[
      "ID", "Status", "Criada em", "Cliente", "E-mail", "Telefone",
      "Produto", "Variação/SKU", "Qtd", "Preço unit.", "Total item", "Total pedido", "Rastreio",
    ]];
    filtered.forEach((o: any) => {
      const info = o.customer_info || {};
      const items = o.items?.length ? o.items : [null];
      items.forEach((it: any) => {
        const parts = String(it?.name ?? "").split(" — ");
        rows.push([
          o.id,
          SPECIAL_ORDER_STATUS_LABELS[o.status as keyof typeof SPECIAL_ORDER_STATUS_LABELS] ?? o.status,
          new Date(o.created_at).toLocaleString("pt-BR"),
          info.name ?? "",
          info.email ?? "",
          info.phone ?? "",
          parts[0] ?? "",
          [parts.slice(1).join(" — "), skuOf(it?.description)].filter(Boolean).join(" / "),
          String(it?.quantity ?? ""),
          it ? String(Number(it.unit_price ?? 0).toFixed(2)) : "",
          it ? String(Number(it.total_price ?? 0).toFixed(2)) : "",
          String(Number(o.total ?? 0).toFixed(2)),
          o.tracking_code ?? "",
        ]);
      });
    });
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `encomendas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Permita pop-ups para gerar o PDF.");
      return;
    }
    const body = filtered.map((o: any) => {
      const info = o.customer_info || {};
      const items = (o.items ?? []).map((it: any) => {
        const sku = skuOf(it.description);
        return `<li>${it.quantity}× ${it.name}${sku ? ` (SKU: ${sku})` : ""} — ${brl(it.total_price)}</li>`;
      }).join("");
      return `<tr>
        <td>#${o.id.slice(0, 8).toUpperCase()}</td>
        <td>${SPECIAL_ORDER_STATUS_LABELS[o.status as keyof typeof SPECIAL_ORDER_STATUS_LABELS] ?? o.status}</td>
        <td>${new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
        <td>${info.name ?? ""}<br/><small>${info.email ?? ""}</small></td>
        <td><ul>${items}</ul></td>
        <td><strong>${brl(o.total)}</strong></td>
      </tr>`;
    }).join("");
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Encomendas especiais</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#1f1d1a}
        h1{font-size:18px;margin:0 0 4px}p{color:#7a6f5d;font-size:12px;margin:0 0 16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #e8dcc4;padding:6px 8px;text-align:left;vertical-align:top}
        th{background:#f8f4ec}ul{margin:0;padding-left:16px}
      </style></head><body>
      <h1>Encomendas especiais</h1>
      <p>${filtered.length} solicitação(ões) — gerado em ${new Date().toLocaleString("pt-BR")}</p>
      <table><thead><tr><th>ID</th><th>Status</th><th>Data</th><th>Cliente</th><th>Itens</th><th>Total</th></tr></thead>
      <tbody>${body}</tbody></table>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
    win.document.close();
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="border-b border-brand-header-border bg-brand-header backdrop-blur-xl sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-display text-lg font-bold text-gradient cursor-pointer" onClick={() => navigate("/admin")}>
            Spencer's Cardtopia
          </h1>
          <img src={logo} alt="Spencer's Cardtopia" className="h-10 cursor-pointer" onClick={() => navigate("/admin")} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-foreground font-display">Encomendas Especiais</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Cliente, e-mail, produto, SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(SPECIAL_ORDER_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-1 flex-1" onClick={exportCSV} disabled={!filtered.length}>
                <FileDown className="h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" className="gap-1 flex-1" onClick={exportPDF} disabled={!filtered.length}>
                <Printer className="h-4 w-4" /> PDF
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
            Nenhuma encomenda encontrada.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order: any) => {
              const info = order.customer_info || {};
              const items = order.items ?? [];
              return (
                <div key={order.id} className="glass-card p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap cursor-pointer" onClick={() => navigate(`/admin/encomendas/${order.id}`)}>
                      <Badge variant="outline" className={statusBadgeVariant[order.status] || ""}>
                        {SPECIAL_ORDER_STATUS_LABELS[order.status as keyof typeof SPECIAL_ORDER_STATUS_LABELS]}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className="text-sm text-foreground">{info.name || info.email || "Cliente"}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={order.status} onValueChange={(v) => handleStatus(order.id, v)}>
                        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(SPECIAL_ORDER_STATUS_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm font-bold text-primary font-display">{brl(order.total)}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground cursor-pointer" onClick={() => navigate(`/admin/encomendas/${order.id}`)} />
                    </div>
                  </div>
                  {items.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {items.map((it: any) => {
                        const sku = skuOf(it.description);
                        return (
                          <li key={it.id} className="text-xs text-muted-foreground">
                            {it.quantity}× {it.name}
                            {sku && <span className="font-mono"> · SKU {sku}</span>}
                            {" — "}{it.item_type === "quotation" && !Number(it.total_price) ? "sob cotação" : brl(it.total_price)}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSpecialOrders;
