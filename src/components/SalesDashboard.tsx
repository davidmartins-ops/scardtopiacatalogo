import { useMemo, useState } from "react";
import { useAdminOrders } from "@/hooks/use-orders";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, ShoppingBag, DollarSign, Package, Loader2, Trophy } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, BarChart, Bar } from "recharts";
import PaymentMethodChart from "./PaymentMethodChart";
import { ORDER_STATUS_LABELS } from "./OrderStatusBadge";
import type { OrderStatus } from "@/hooks/use-orders";

type Range = "7d" | "30d" | "90d" | "all";

const RANGE_DAYS: Record<Range, number | null> = { "7d": 7, "30d": 30, "90d": 90, "all": null };

const fmtBRL = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SalesDashboard = () => {
  const { orders, isLoading } = useAdminOrders();
  const [range, setRange] = useState<Range>("30d");

  const filtered = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!days) return orders;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return orders.filter((o) => new Date(o.created_at).getTime() >= cutoff);
  }, [orders, range]);

  const kpis = useMemo(() => {
    const valid = filtered.filter((o) => o.status !== "cancelled");
    const revenue = valid.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const count = valid.length;
    const avg = count > 0 ? revenue / count : 0;
    const itemsSold = valid.reduce((s, o) => s + (o.items as any[]).reduce((ss, it) => ss + Number(it.quantity ?? 0), 0), 0);
    const cancelled = filtered.filter((o) => o.status === "cancelled").length;
    const pending = filtered.filter((o) => o.status === "pending_payment").length;
    return { revenue, count, avg, itemsSold, cancelled, pending };
  }, [filtered]);

  const dailySeries = useMemo(() => {
    const days = RANGE_DAYS[range] ?? 90;
    const buckets = new Map<string, { date: string; revenue: number; orders: number }>();
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { date: key, revenue: 0, orders: 0 });
    }
    filtered.filter((o) => o.status !== "cancelled").forEach((o) => {
      const key = new Date(o.created_at).toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (b) {
        b.revenue += Number(o.total ?? 0);
        b.orders += 1;
      }
    });
    return Array.from(buckets.values()).map((b) => ({
      ...b,
      label: new Date(b.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    }));
  }, [filtered, range]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    filtered.filter((o) => o.status !== "cancelled").forEach((o) => {
      (o.items as any[]).forEach((it) => {
        const key = it.name ?? "—";
        const cur = map.get(key) ?? { name: key, qty: 0, revenue: 0 };
        cur.qty += Number(it.quantity ?? 0);
        cur.revenue += Number(it.total_price ?? 0);
        map.set(key, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filtered]);

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((o) => map.set(o.status, (map.get(o.status) ?? 0) + 1));
    return Array.from(map.entries()).map(([status, count]) => ({
      status: ORDER_STATUS_LABELS[status as OrderStatus] ?? status,
      count,
    }));
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="glass-card p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Dashboard de Vendas
        </h3>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList className="h-8">
            <TabsTrigger value="7d" className="text-xs h-6 px-3">7 dias</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs h-6 px-3">30 dias</TabsTrigger>
            <TabsTrigger value="90d" className="text-xs h-6 px-3">90 dias</TabsTrigger>
            <TabsTrigger value="all" className="text-xs h-6 px-3">Tudo</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={DollarSign} label="Receita" value={fmtBRL(kpis.revenue)} accent="primary" />
        <Kpi icon={ShoppingBag} label="Pedidos" value={String(kpis.count)} sub={`${kpis.cancelled} cancelado(s)`} />
        <Kpi icon={TrendingUp} label="Ticket médio" value={fmtBRL(kpis.avg)} />
        <Kpi icon={Package} label="Itens vendidos" value={String(kpis.itemsSold)} sub={`${kpis.pending} aguardando pgto`} />
      </div>

      <Card className="glass-card p-4">
        <h4 className="text-sm font-display font-semibold mb-3 text-foreground">Receita diária</h4>
        <ChartContainer
          config={{ revenue: { label: "Receita", color: "hsl(var(--primary))" } }}
          className="h-[220px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailySeries} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v}`} />
              <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmtBRL(Number(v))} />} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </Card>

      <PaymentMethodChart orders={filtered} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass-card p-4">
          <h4 className="text-sm font-display font-semibold mb-3 text-foreground flex items-center gap-2">
            <Trophy className="h-4 w-4 text-accent" /> Top 10 produtos
          </h4>
          {topProducts.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sem vendas no período.</p>
          ) : (
            <div className="space-y-1.5">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded hover:bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-mono text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                    <span className="truncate text-foreground">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground">{p.qty}×</span>
                    <span className="font-semibold text-primary tabular-nums">{fmtBRL(p.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="glass-card p-4">
          <h4 className="text-sm font-display font-semibold mb-3 text-foreground">Status dos pedidos</h4>
          {statusBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sem pedidos no período.</p>
          ) : (
            <ChartContainer
              config={{ count: { label: "Pedidos", color: "hsl(var(--accent))" } }}
              className="h-[220px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusBreakdown} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="status" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </Card>
      </div>
    </div>
  );
};

const Kpi = ({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: { icon: typeof DollarSign; label: string; value: string; sub?: string; accent?: "primary" }) => (
  <Card className="glass-card p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-lg font-display font-bold mt-1 ${accent === "primary" ? "text-primary" : "text-foreground"}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <div className={`p-1.5 rounded-md ${accent === "primary" ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"} shrink-0`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  </Card>
);

export default SalesDashboard;
