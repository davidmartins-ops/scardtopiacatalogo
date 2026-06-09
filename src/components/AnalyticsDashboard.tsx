import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Eye, ShoppingCart, Package, MousePointer } from "lucide-react";

const COLORS = ["hsl(45, 80%, 55%)", "hsl(200, 70%, 50%)", "hsl(140, 60%, 45%)", "hsl(0, 60%, 50%)", "hsl(280, 60%, 55%)", "hsl(30, 80%, 55%)"];

const AnalyticsDashboard = () => {
  const { data: events = [] } = useQuery({
    queryKey: ["analytics-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const { data: eventCounts } = useQuery({
    queryKey: ["analytics-event-counts"],
    queryFn: async () => {
      const types = ["view", "add_to_cart", "share"] as const;
      const results = await Promise.all(
        types.map(async (t) => {
          const { count } = await supabase
            .from("analytics_events")
            .select("*", { count: "exact", head: true })
            .eq("event_type", t);
          return [t, count ?? 0] as const;
        })
      );
      return Object.fromEntries(results) as Record<(typeof types)[number], number>;
    },
    refetchInterval: 30000,
  });

  const { data: orderStats } = useQuery({
    queryKey: ["analytics-order-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("status");
      if (error) throw error;
      const rows = data ?? [];
      const total = rows.length;
      const cancelled = rows.filter((o: any) => o.status === "cancelled").length;
      const delivered = rows.filter((o: any) => o.status === "delivered").length;
      const open = total - cancelled - delivered;
      return { total, open, delivered, cancelled };
    },
    refetchInterval: 30000,
  });

  const stats = useMemo(() => ({
    views: eventCounts?.view ?? 0,
    cartAdds: eventCounts?.add_to_cart ?? 0,
    shares: eventCounts?.share ?? 0,
    orders: orderStats?.total ?? 0,
    ordersOpen: orderStats?.open ?? 0,
    ordersDelivered: orderStats?.delivered ?? 0,
    ordersCancelled: orderStats?.cancelled ?? 0,
  }), [eventCounts, orderStats]);


  const topProducts = useMemo(() => {
    const counts: Record<string, { name: string; views: number; carts: number }> = {};
    events.forEach((e) => {
      if (!e.item_name) return;
      if (!counts[e.item_name]) counts[e.item_name] = { name: e.item_name, views: 0, carts: 0 };
      if (e.event_type === "view") counts[e.item_name].views++;
      if (e.event_type === "add_to_cart") counts[e.item_name].carts++;
    });
    return Object.values(counts)
      .sort((a, b) => (b.views + b.carts) - (a.views + a.carts))
      .slice(0, 10);
  }, [events]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => {
      if (e.category && (e.event_type === "view" || e.event_type === "add_to_cart")) {
        counts[e.category] = (counts[e.category] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [events]);

  const dailyData = useMemo(() => {
    const days: Record<string, { date: string; views: number; carts: number; orders: number }> = {};
    events.forEach((e) => {
      const date = new Date(e.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (!days[date]) days[date] = { date, views: 0, carts: 0, orders: 0 };
      if (e.event_type === "view") days[date].views++;
      if (e.event_type === "add_to_cart") days[date].carts++;
      if (e.event_type === "order") days[date].orders++;
    });
    return Object.values(days).reverse().slice(-14);
  }, [events]);

  const tooltipStyle = {
    background: "hsl(40, 30%, 96%)",
    border: "1px solid hsl(45, 40%, 80%)",
    borderRadius: "12px",
    fontSize: 12,
    color: "hsl(20, 15%, 30%)",
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Visualizacoes", value: stats.views, icon: Eye, color: "text-primary" },
          { label: "Adicionados ao Carrinho", value: stats.cartAdds, icon: ShoppingCart, color: "text-accent" },
          { label: "Compartilhamentos", value: stats.shares, icon: MousePointer, color: "text-foil" },
          { label: "Pedidos totais", value: stats.orders, icon: Package, color: "text-rainbow" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{s.label}</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground font-display">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Order Breakdown */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pedidos em aberto", value: stats.ordersOpen, color: "text-accent" },
          { label: "Pedidos efetivados", value: stats.ordersDelivered, color: "text-primary" },
          { label: "Pedidos cancelados", value: stats.ordersCancelled, color: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className={`h-4 w-4 ${s.color}`} />
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{s.label}</span>
            </div>
            <p className={`text-xl sm:text-2xl font-bold font-display ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>


      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Activity */}
        {dailyData.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-sm font-display font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-gradient">Atividade Diaria</span>
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(20, 15%, 40%)" }} axisLine={{ stroke: "hsl(45, 20%, 80%)" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(20, 15%, 50%)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="views" name="Visualizacoes" stroke="hsl(45, 80%, 55%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="carts" name="Carrinho" stroke="hsl(200, 70%, 50%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="orders" name="Pedidos" stroke="hsl(140, 60%, 45%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Categories */}
        {categoryData.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-sm font-display font-semibold text-foreground mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-gradient">Categorias Mais Procuradas</span>
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical">
                 <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(20, 15%, 50%)" }} axisLine={false} tickLine={false} />
                   <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(20, 15%, 40%)" }} width={80} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Interacoes" radius={[0, 4, 4, 0]}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Top Products Table */}
      {topProducts.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-display font-semibold text-foreground mb-3 flex items-center gap-2">
            <MousePointer className="h-4 w-4 text-primary" />
            <span className="text-gradient">Produtos Mais Procurados</span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">#</th>
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground font-medium">Produto</th>
                  <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Visualizacoes</th>
                  <th className="text-center py-2 px-2 text-xs text-muted-foreground font-medium">Carrinhos</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr key={p.name} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2 px-2 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="py-2 px-2 text-xs text-foreground font-medium truncate max-w-[200px]">{p.name}</td>
                    <td className="py-2 px-2 text-center text-xs">{p.views}</td>
                    <td className="py-2 px-2 text-center text-xs">{p.carts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {events.length === 0 && (
        <div className="glass-card p-8 text-center">
          <MousePointer className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum dado de analytics ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Os dados aparecerao conforme os clientes interagirem com o catalogo.</p>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
