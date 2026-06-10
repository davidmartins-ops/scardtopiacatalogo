import useSEO from "@/hooks/use-seo";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, AlertTriangle, Upload, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAdminOrders } from "@/hooks/use-orders";
import {
  useReconciliation,
  useCashClosures,
  type ReconciliationRow,
  type ReconciliationStatus,
} from "@/hooks/use-reconciliation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const todayIso = () => new Date().toISOString().slice(0, 10);

const STATUS_LABEL: Record<ReconciliationStatus, string> = {
  matched: "Conciliado",
  divergent: "Divergente",
  unmatched: "Pendente",
  manual: "Manual",
};

const STATUS_VARIANT: Record<ReconciliationStatus, "default" | "destructive" | "secondary" | "outline"> = {
  matched: "default",
  divergent: "destructive",
  unmatched: "secondary",
  manual: "outline",
};

const parseCsv = (text: string): { amount: number; date: string; reference: string }[] => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].toLowerCase().split(sep).map((h) => h.trim());
  const dateIdx = header.findIndex((h) => /data|date/.test(h));
  const amtIdx = header.findIndex((h) => /valor|amount|credit/.test(h));
  const refIdx = header.findIndex((h) => /ident|ref|descr|hist/.test(h));
  if (amtIdx < 0 || dateIdx < 0) return [];
  return lines.slice(1).map((l) => {
    const cells = l.split(sep);
    const raw = (cells[amtIdx] ?? "").replace(/[^\d,.\-]/g, "").replace(/\./g, "").replace(",", ".");
    return {
      amount: Number(raw) || 0,
      date: cells[dateIdx]?.trim() ?? "",
      reference: refIdx >= 0 ? cells[refIdx]?.trim() ?? "" : "",
    };
  });
};

const AdminReconciliation = () => {
  useSEO({
    title: "Reconciliação financeira",
    canonical: "https://www.spencerscardtopia.com.br/admin/reconciliacao",
    noindex: true,
  });
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { orders, isLoading: ordersLoading } = useAdminOrders();
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(todayIso());
  const { records, upsert } = useReconciliation({
    from: from ? `${from}T00:00:00Z` : undefined,
    to: to ? `${to}T23:59:59Z` : undefined,
  });
  const { list: closuresQuery, closeDay } = useCashClosures();
  const closures = closuresQuery.data ?? [];
  const recs = records.data ?? [];

  const recByOrder = useMemo(() => {
    const m = new Map<string, ReconciliationRow>();
    recs.forEach((r) => m.set(r.order_id, r));
    return m;
  }, [recs]);

  // Only paid/confirmed orders need reconciling
  const eligibleOrders = useMemo(
    () =>
      orders.filter((o) =>
        ["payment_confirmed", "preparing", "shipped", "delivered"].includes(o.status as string),
      ),
    [orders],
  );

  const dayBuckets = useMemo(() => {
    const map = new Map<string, typeof eligibleOrders>();
    eligibleOrders.forEach((o) => {
      const d = o.created_at.slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(o);
    });
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [eligibleOrders]);

  if (authLoading || ordersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) {
    navigate("/admin/login");
    return null;
  }

  const handleMark = async (
    orderId: string,
    expected: number,
    status: ReconciliationStatus,
    extra: Partial<ReconciliationRow> = {},
  ) => {
    try {
      await upsert.mutateAsync({
        order_id: orderId,
        expected_amount: expected,
        received_amount: extra.received_amount ?? expected,
        method: extra.method ?? "pix",
        status,
        notes: extra.notes ?? null,
        bank_reference: extra.bank_reference ?? null,
        received_at: extra.received_at ?? new Date().toISOString(),
      });
      toast.success("Conciliação atualizada");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao atualizar");
    }
  };

  const handleCsv = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      toast.error("CSV sem colunas valor/data reconhecíveis");
      return;
    }
    let matched = 0;
    for (const r of rows) {
      const candidate = eligibleOrders.find(
        (o) =>
          Math.abs(Number(o.total) - r.amount) < 0.05 &&
          !recByOrder.get(o.id),
      );
      if (candidate) {
        await upsert.mutateAsync({
          order_id: candidate.id,
          expected_amount: Number(candidate.total),
          received_amount: r.amount,
          status: "matched",
          method: "pix",
          bank_reference: r.reference,
          received_at: r.date ? new Date(r.date).toISOString() : new Date().toISOString(),
        });
        matched++;
      }
    }
    toast.success(`Importação concluída: ${matched} de ${rows.length} conciliados`);
  };

  const handleCloseDay = async (date: string, list: typeof eligibleOrders) => {
    const expected = list.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const received = list.reduce((s, o) => {
      const r = recByOrder.get(o.id);
      return s + (r ? Number(r.received_amount ?? 0) : 0);
    }, 0);
    try {
      await closeDay.mutateAsync({
        closure_date: date,
        total_orders: list.length,
        total_expected: expected,
        total_received: received,
      });
      toast.success(`Caixa de ${date} fechado`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao fechar caixa");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
          <img src={logo} alt="Logo" className="h-8 w-auto" />
          <h1 className="font-display text-lg sm:text-xl">Reconciliação financeira</h1>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-4">
          <div className="grid sm:grid-cols-4 gap-3 items-end">
            <div>
              <Label>De</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>Até</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-2 justify-end">
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCsv(f);
                    e.target.value = "";
                  }}
                />
                <span>
                  <Button variant="outline" asChild>
                    <span><Upload className="h-4 w-4 mr-1" /> Importar extrato CSV</span>
                  </Button>
                </span>
              </label>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="diario">
          <TabsList>
            <TabsTrigger value="diario">Pedidos por dia</TabsTrigger>
            <TabsTrigger value="fechamentos">Fechamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="diario" className="space-y-4">
            {dayBuckets.length === 0 && (
              <Card className="p-6 text-center text-muted-foreground">
                Nenhum pedido pago no período selecionado.
              </Card>
            )}
            {dayBuckets.map(([date, list]) => {
              const expected = list.reduce((s, o) => s + Number(o.total ?? 0), 0);
              const received = list.reduce((s, o) => {
                const r = recByOrder.get(o.id);
                return s + (r ? Number(r.received_amount ?? 0) : 0);
              }, 0);
              const divergence = +(received - expected).toFixed(2);
              const isClosed = closures.some((c) => c.closure_date === date);
              return (
                <Card key={date} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-base">{new Date(date).toLocaleDateString("pt-BR")}</h2>
                      <p className="text-xs text-muted-foreground">
                        {list.length} pedido(s) • Esperado {fmt(expected)} • Recebido {fmt(received)} •{" "}
                        <span className={divergence === 0 ? "text-emerald-600" : "text-destructive font-medium"}>
                          Divergência {fmt(divergence)}
                        </span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={isClosed ? "secondary" : "default"}
                      disabled={isClosed}
                      onClick={() => handleCloseDay(date, list)}
                    >
                      <Lock className="h-4 w-4 mr-1" />
                      {isClosed ? "Caixa fechado" : "Fechar caixa"}
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Esperado</TableHead>
                          <TableHead>Recebido</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Ref. bancária</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.map((o) => {
                          const r = recByOrder.get(o.id);
                          return (
                            <OrderReconRow
                              key={o.id}
                              orderId={o.id}
                              expected={Number(o.total)}
                              row={r}
                              disabled={isClosed}
                              onMark={handleMark}
                            />
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="fechamentos">
            <Card className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Pedidos</TableHead>
                    <TableHead>Esperado</TableHead>
                    <TableHead>Recebido</TableHead>
                    <TableHead>Divergência</TableHead>
                    <TableHead>Fechado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closures.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum fechamento registrado.
                      </TableCell>
                    </TableRow>
                  )}
                  {closures.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{new Date(c.closure_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{c.total_orders}</TableCell>
                      <TableCell>{fmt(Number(c.total_expected))}</TableCell>
                      <TableCell>{fmt(Number(c.total_received))}</TableCell>
                      <TableCell className={Number(c.divergence) === 0 ? "" : "text-destructive font-medium"}>
                        {fmt(Number(c.divergence))}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(c.closed_at).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

interface RowProps {
  orderId: string;
  expected: number;
  row?: ReconciliationRow;
  disabled: boolean;
  onMark: (
    orderId: string,
    expected: number,
    status: ReconciliationStatus,
    extra?: Partial<ReconciliationRow>,
  ) => void;
}

const OrderReconRow = ({ orderId, expected, row, disabled, onMark }: RowProps) => {
  const [received, setReceived] = useState<string>(row?.received_amount?.toString() ?? expected.toFixed(2));
  const [method, setMethod] = useState<string>(row?.method ?? "pix");
  const [ref, setRef] = useState<string>(row?.bank_reference ?? "");
  const [notes, setNotes] = useState<string>(row?.notes ?? "");
  const status: ReconciliationStatus = row?.status ?? "unmatched";

  const submit = (s: ReconciliationStatus) => {
    onMark(orderId, expected, s, {
      received_amount: Number(received) || 0,
      method: method as any,
      bank_reference: ref || null,
      notes: notes || null,
    });
  };

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">
        <Link to={`/conta/pedidos/${orderId}`} className="hover:underline text-primary">
          {orderId.slice(0, 8)}…
        </Link>
      </TableCell>
      <TableCell>{fmt(expected)}</TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={received}
          onChange={(e) => setReceived(e.target.value)}
          className="w-28 h-8"
          disabled={disabled}
        />
      </TableCell>
      <TableCell>
        <Select value={method} onValueChange={setMethod} disabled={disabled}>
          <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="credit">Crédito</SelectItem>
            <SelectItem value="debit">Débito</SelectItem>
            <SelectItem value="cash">Dinheiro</SelectItem>
            <SelectItem value="other">Outro</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input value={ref} onChange={(e) => setRef(e.target.value)} className="w-36 h-8" disabled={disabled} />
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
      </TableCell>
      <TableCell className="text-right space-x-1 whitespace-nowrap">
        <Button size="sm" variant="default" disabled={disabled} onClick={() => submit("matched")}>
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />OK
        </Button>
        <Button size="sm" variant="destructive" disabled={disabled} onClick={() => submit("divergent")}>
          <AlertTriangle className="h-3.5 w-3.5 mr-1" />Diverg.
        </Button>
      </TableCell>
    </TableRow>
  );
};

export default AdminReconciliation;
