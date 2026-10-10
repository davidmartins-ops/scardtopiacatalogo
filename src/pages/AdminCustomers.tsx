import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";

interface Profile { id: string; display_name: string | null; cpf: string | null; phone: string | null; created_at: string }
interface Order { id: string; user_id: string; total: number; status: string; created_at: string; coupon_code: string | null; coupon_discount: number; payment_method: string; customer_info: { name?: string; email?: string } | null }
interface Redemption { id: string; user_id: string | null; code: string; discount_amount: number; created_at: string; order_id: string | null; special_order_id: string | null }

const brl = (v: number) => `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const AdminCustomers = () => {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [credits, setCredits] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      supabase.from("customer_profiles").select("id, display_name, cpf, phone, created_at"),
      supabase.from("orders").select("id, user_id, total, status, created_at, coupon_code, coupon_discount, payment_method, customer_info").order("created_at", { ascending: false }).limit(2000),
      supabase.from("coupon_redemptions").select("id, user_id, code, discount_amount, created_at, order_id, special_order_id"),
      supabase.from("store_credits").select("user_id, balance"),
    ]).then(([p, o, r, c]) => {
      setProfiles((p.data ?? []) as Profile[]);
      setOrders((o.data ?? []) as unknown as Order[]);
      setRedemptions((r.data ?? []) as Redemption[]);
      setCredits(Object.fromEntries((c.data ?? []).map((x) => [x.user_id, Number(x.balance)])));
      setLoading(false);
    });
  }, []);

  const rows = useMemo(() => {
    const byUser = new Map<string, Order[]>();
    orders.forEach((o) => byUser.set(o.user_id, [...(byUser.get(o.user_id) ?? []), o]));
    const ids = new Set([...profiles.map((p) => p.id), ...byUser.keys()]);
    return [...ids].map((id) => {
      const p = profiles.find((x) => x.id === id);
      const os = byUser.get(id) ?? [];
      const valid = os.filter((o) => o.status !== "cancelled");
      return {
        id, name: p?.display_name || os[0]?.customer_info?.name || "Sem nome", email: os[0]?.customer_info?.email ?? "",
        cpf: p?.cpf ?? "", phone: p?.phone ?? "", orders: os, count: valid.length,
        spent: valid.reduce((s, o) => s + Number(o.total), 0), last: os[0]?.created_at ?? null,
        coupons: redemptions.filter((r) => r.user_id === id), credit: credits[id] ?? 0,
      };
    }).filter((r) => !q || `${r.name} ${r.email} ${r.cpf} ${r.phone}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.spent - a.spent);
  }, [profiles, orders, redemptions, credits, q]);

  const cur = rows.find((r) => r.id === sel);

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="font-display text-2xl flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Clientes</h1>
        </div>
        <div className="relative"><Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nome, e-mail, CPF ou telefone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <button key={r.id} onClick={() => setSel(r.id)} className="glass-card p-3 text-left space-y-1 hover:border-primary">
                <p className="font-semibold truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground truncate">{r.email || r.phone || "—"}</p>
                <div className="flex flex-wrap gap-1 text-xs pt-1">
                  <Badge variant="outline">{r.count} pedido(s)</Badge>
                  <Badge variant="outline">{brl(r.spent)}</Badge>
                  {r.coupons.length > 0 && <Badge variant="outline">{r.coupons.length} cupom(ns)</Badge>}
                  {r.credit > 0 && <Badge className="bg-success text-success-foreground">Crédito {brl(r.credit)}</Badge>}
                </div>
              </button>
            ))}
            {rows.length === 0 && <p className="text-muted-foreground">Nenhum cliente encontrado.</p>}
          </div>
        )}
      </div>

      <Dialog open={!!cur} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto bg-card">
          {cur && <>
            <DialogHeader><DialogTitle>{cur.name}</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground">{[cur.email, cur.phone, cur.cpf && `CPF ${cur.cpf}`].filter(Boolean).join(" · ")}</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Pedidos</p><p className="font-semibold">{cur.count}</p></div>
              <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Total gasto</p><p className="font-semibold">{brl(cur.spent)}</p></div>
              <div className="rounded-md border p-2"><p className="text-xs text-muted-foreground">Créditos</p><p className="font-semibold text-primary">{brl(cur.credit)}</p></div>
            </div>
            <h3 className="font-semibold text-sm mt-2">Histórico de compras</h3>
            <ul className="space-y-1.5">
              {cur.orders.map((o) => (
                <li key={o.id} className="rounded-md border p-2 text-sm flex justify-between gap-2">
                  <Link to={`/admin/pedidos/${o.id}`} className="min-w-0 hover:underline">
                    <p className="font-mono text-xs">#{o.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR")} · {o.payment_method}{o.coupon_code ? ` · ${o.coupon_code}` : ""}</p>
                  </Link>
                  <div className="flex flex-col items-end gap-1 shrink-0"><span className="font-medium">{brl(o.total)}</span><OrderStatusBadge status={o.status as never} /></div>
                </li>
              ))}
              {cur.orders.length === 0 && <li className="text-xs text-muted-foreground">Sem pedidos.</li>}
            </ul>
            <h3 className="font-semibold text-sm mt-2">Cupons usados</h3>
            <ul className="space-y-1.5">
              {cur.coupons.map((r) => (
                <li key={r.id} className="rounded-md border p-2 text-xs flex justify-between">
                  <span><b>{r.code}</b> · {new Date(r.created_at).toLocaleDateString("pt-BR")}{r.special_order_id ? " · encomenda" : ""}</span>
                  <span className="font-medium">-{brl(r.discount_amount)}</span>
                </li>
              ))}
              {cur.coupons.length === 0 && <li className="text-xs text-muted-foreground">Nenhum cupom usado.</li>}
            </ul>
            <Button variant="outline" size="sm" asChild><Link to="/admin/creditos">Gerenciar créditos</Link></Button>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCustomers;
