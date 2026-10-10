import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Radio, ShoppingBag, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";

interface Order { id: string; created_at: string; status: string; total: number; payment_method: string; paid_at: string | null; coupon_code: string | null; coupon_discount: number | null; customer_info: { name?: string } | null }
interface Payment { id: string; created_at: string; status: string; amount: number | null; paid_amount: number | null; order_id: string | null; provider: string }

const brl = (v: number | null | undefined) => `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const AdminLiveSales = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [live, setLive] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    void supabase.from("orders").select("id, created_at, status, total, payment_method, paid_at, coupon_code, coupon_discount, customer_info").gte("created_at", since).order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setOrders((data ?? []) as unknown as Order[]));
    void supabase.from("payment_events").select("id, created_at, status, amount, paid_amount, order_id, provider").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setPayments((data ?? []) as Payment[]));

    const ch = supabase.channel("live-sales")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (p) => {
        const row = p.new as Order;
        if (p.eventType === "DELETE") { setOrders((o) => o.filter((x) => x.id !== (p.old as Order).id)); return; }
        setOrders((o) => [row, ...o.filter((x) => x.id !== row.id)].sort((a, b) => b.created_at.localeCompare(a.created_at)));
        setFlash(row.id);
        setTimeout(() => setFlash(null), 3000);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_events" }, (p) => {
        const row = p.new as Payment;
        if (!row?.id) return;
        setPayments((o) => [row, ...o.filter((x) => x.id !== row.id)].slice(0, 50));
      })
      .subscribe((s) => setLive(s === "SUBSCRIBED"));
    const byCoupon = useMemo(() => {
    const m = new Map<string, { count: number; charged: number; discount: number }>();
    orders.filter((o) => o.coupon_code && o.status !== "cancelled").forEach((o) => {
      const c = m.get(o.coupon_code!) ?? { count: 0, charged: 0, discount: 0 };
      c.count++; c.charged += Number(o.total); c.discount += Number(o.coupon_discount ?? 0);
      m.set(o.coupon_code!, c);
    });
    return [...m.entries()].sort((a, b) => b[1].charged - a[1].charged);
  }, [orders]);

  return () => { void supabase.removeChannel(ch); };
  }, []);

  const today = useMemo(() => {
    const d = new Date().toDateString();
    const t = orders.filter((o) => new Date(o.created_at).toDateString() === d && o.status !== "cancelled");
    return { count: t.length, total: t.reduce((s, o) => s + Number(o.total), 0), paid: t.filter((o) => o.paid_at).reduce((s, o) => s + Number(o.total), 0) };
  }, [orders]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-6 space-y-6">
        <Button variant="ghost" size="sm" asChild className="gap-1"><Link to="/admin"><ArrowLeft className="h-4 w-4" /> Voltar</Link></Button>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-2xl">Vendas ao vivo</h1>
          <span className={`text-xs flex items-center gap-1 ${live ? "text-primary" : "text-muted-foreground"}`}><Radio className={`h-4 w-4 ${live ? "animate-pulse" : ""}`} /> {live ? "Atualizando em tempo real" : "Conectando…"}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Pedidos hoje</p><p className="text-2xl font-semibold">{today.count}</p></div>
          <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Vendido hoje</p><p className="text-2xl font-semibold">{brl(today.total)}</p></div>
          <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Já pago hoje</p><p className="text-2xl font-semibold text-primary">{brl(today.paid)}</p></div>
        </div>
        <section className="rounded-lg border">
          <h2 className="p-3 font-semibold border-b">Impacto dos cupons (últimos 7 dias)</h2>
          {byCoupon.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhum pedido com cupom.</p> : (
            <div className="grid gap-2 p-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {byCoupon.map(([code, c]) => (
                <div key={code} className="rounded-md border bg-card p-3 text-sm">
                  <p className="font-bold tracking-wide">{code}</p>
                  <p className="text-xs text-muted-foreground">{c.count} pedido(s)</p>
                  <p>Cobrado: <b>{brl(c.charged)}</b></p>
                  <p className="text-xs text-destructive">Desconto: -{brl(c.discount)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        <div className="grid lg:grid-cols-3 gap-4">
          <section className="lg:col-span-2 rounded-lg border">
            <h2 className="p-3 font-semibold flex items-center gap-2 border-b"><ShoppingBag className="h-4 w-4" /> Pedidos (últimos 7 dias)</h2>
            <ul className="divide-y max-h-[70vh] overflow-auto">
              {orders.map((o) => (
                <li key={o.id} className={`p-3 flex items-center justify-between gap-2 text-sm transition-colors ${flash === o.id ? "bg-primary/10" : ""}`}>
                  <Link to={`/admin/pedidos/${o.id}`} className="min-w-0 hover:underline">
                    <p className="font-mono text-xs">#{o.id.slice(0, 8).toUpperCase()} · {o.customer_info?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR")} · {o.payment_method}</p>
                    {o.coupon_code && <p className="text-xs text-primary">Cupom {o.coupon_code} · -{brl(o.coupon_discount)}</p>}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0"><span className="font-medium">{brl(o.total)}</span><OrderStatusBadge status={o.status as never} /></div>
                </li>
              ))}
              {orders.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nenhum pedido nos últimos 7 dias.</li>}
            </ul>
          </section>
          <section className="rounded-lg border">
            <h2 className="p-3 font-semibold flex items-center gap-2 border-b"><CreditCard className="h-4 w-4" /> Pagamentos</h2>
            <ul className="divide-y max-h-[70vh] overflow-auto text-sm">
              {payments.map((p) => (
                <li key={p.id} className="p-3">
                  <p className="flex justify-between"><span>{brl(p.paid_amount ?? p.amount)}</span><span className={p.status === "paid" || p.status === "approved" ? "text-primary" : "text-muted-foreground"}>{p.status}</span></p>
                  <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")} · {p.provider}{p.order_id ? ` · #${p.order_id.slice(0, 8).toUpperCase()}` : ""}</p>
                </li>
              ))}
              {payments.length === 0 && <li className="p-6 text-center text-muted-foreground">Sem pagamentos.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminLiveSales;
