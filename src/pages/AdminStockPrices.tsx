import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, History, Loader2, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInventory } from "@/hooks/use-inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

const LOW = 2;
const brl = (v: number | null | undefined) => (v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);

interface Hist { id: string; inventory_id: string; item_name: string; old_price: number | null; new_price: number | null; old_price_pix: number | null; new_price_pix: number | null; old_discount: number | null; new_discount: number | null; changed_at: string }

const AdminStockPrices = () => {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useInventory();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "estoque";
  const [q, setQ] = useState("");
  const [edits, setEdits] = useState<Record<string, { quantity?: number; price?: number; price_pix?: number; discount?: number }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [history, setHistory] = useState<Hist[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  // Atualização ao vivo: estoque e histórico de preços
  useEffect(() => {
    void supabase.from("inventory_price_history").select("*").order("changed_at", { ascending: false }).limit(200)
      .then(({ data }) => setHistory((data ?? []) as Hist[]));
    const ch = supabase.channel("stock-prices")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => qc.invalidateQueries({ queryKey: ["inventory"] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "inventory_price_history" }, (p) => setHistory((h) => [p.new as Hist, ...h]))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter((i) => !t || i.name.toLowerCase().includes(t) || i.id.toLowerCase().includes(t));
  }, [items, q]);
  const low = useMemo(() => filtered.filter((i) => i.quantity <= LOW).sort((a, b) => a.quantity - b.quantity), [filtered]);

  const save = async (id: string) => {
    const e = edits[id];
    if (!e) return;
    for (const v of Object.values(e)) if (v == null || Number.isNaN(v) || v < 0) { toast.error("Valores inválidos"); return; }
    if (e.discount != null && e.discount > 100) { toast.error("Desconto máximo é 100%"); return; }
    setSaving(id);
    const { error } = await supabase.from("inventory").update(e).eq("id", id);
    setSaving(null);
    if (error) { toast.error("Não foi possível salvar", { description: error.message }); return; }
    setEdits((x) => { const n = { ...x }; delete n[id]; return n; });
    toast.success("Salvo — o catálogo já mostra o novo valor");
    void qc.invalidateQueries({ queryKey: ["inventory"] });
  };

  const set = (id: string, k: "quantity" | "price" | "price_pix" | "discount", v: string) =>
    setEdits((x) => ({ ...x, [id]: { ...x[id], [k]: v === "" ? NaN : Number(v) } }));
  const val = (id: string, k: "quantity" | "price" | "price_pix" | "discount", cur: number) => {
    const v = edits[id]?.[k];
    return v === undefined ? String(cur) : Number.isNaN(v) ? "" : String(v);
  };

  const shownHistory = selected ? history.filter((h) => h.inventory_id === selected) : history;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-6 space-y-4">
        <Button variant="ghost" size="sm" asChild className="gap-1"><Link to="/admin"><ArrowLeft className="h-4 w-4" /> Voltar</Link></Button>
        <h1 className="font-display text-2xl">Estoque e preços</h1>
        <Input placeholder="Buscar por nome ou código…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : (
          <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
            <TabsList>
              <TabsTrigger value="estoque" className="gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Estoque baixo ({low.length})</TabsTrigger>
              <TabsTrigger value="precos" className="gap-1"><History className="h-3.5 w-3.5" /> Preços</TabsTrigger>
            </TabsList>

            <TabsContent value="estoque">
              <p className="text-xs text-muted-foreground mb-2">Itens com {LOW} unidades ou menos. Itens zerados aparecem primeiro.</p>
              <ul className="divide-y rounded-lg border">
                {low.map((i) => (
                  <li key={i.id} className="p-3 flex items-center gap-3 text-sm">
                    <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold ${i.quantity === 0 ? "bg-destructive text-destructive-foreground" : "bg-accent text-accent-foreground"}`}>{i.quantity}</span>
                    <div className="min-w-0 flex-1"><p className="truncate">{i.name}</p><p className="font-mono text-xs text-muted-foreground">{i.id}</p></div>
                    <Input type="number" min={0} className="w-20" aria-label="Quantidade" value={val(i.id, "quantity", i.quantity)} onChange={(e) => set(i.id, "quantity", e.target.value)} />
                    <Button size="sm" onClick={() => save(i.id)} disabled={!edits[i.id] || saving === i.id}>{saving === i.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}</Button>
                  </li>
                ))}
                {low.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nenhum item com estoque baixo.</li>}
              </ul>
            </TabsContent>

            <TabsContent value="precos" className="grid lg:grid-cols-3 gap-4">
              <ul className="lg:col-span-2 divide-y rounded-lg border max-h-[70vh] overflow-auto">
                {filtered.map((i) => (
                  <li key={i.id} className={`p-3 flex flex-wrap items-center gap-2 text-sm ${selected === i.id ? "bg-muted/40" : ""}`}>
                    <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(selected === i.id ? null : i.id)}>
                      <p className="truncate">{i.name}</p><p className="font-mono text-xs text-muted-foreground">{i.id}</p>
                    </button>
                    <label className="text-xs">Crédito<Input type="number" step="0.01" min={0} className="w-24" value={val(i.id, "price", i.price)} onChange={(e) => set(i.id, "price", e.target.value)} /></label>
                    <label className="text-xs">PIX<Input type="number" step="0.01" min={0} className="w-24" value={val(i.id, "price_pix", i.price_pix)} onChange={(e) => set(i.id, "price_pix", e.target.value)} /></label>
                    <label className="text-xs">Desc. %<Input type="number" min={0} max={100} className="w-16" value={val(i.id, "discount", i.discount)} onChange={(e) => set(i.id, "discount", e.target.value)} /></label>
                    <Button size="sm" className="self-end" onClick={() => save(i.id)} disabled={!edits[i.id] || saving === i.id}>{saving === i.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}</Button>
                  </li>
                ))}
              </ul>
              <section className="rounded-lg border">
                <h2 className="p-3 font-semibold border-b text-sm">{selected ? "Histórico do item" : "Últimas alterações"}</h2>
                <ul className="divide-y max-h-[65vh] overflow-auto text-xs">
                  {shownHistory.map((h) => (
                    <li key={h.id} className="p-3 space-y-0.5">
                      <p className="font-medium text-sm truncate">{h.item_name}</p>
                      <p className="text-muted-foreground">{new Date(h.changed_at).toLocaleString("pt-BR")}</p>
                      {h.old_price !== h.new_price && <p>Crédito: {brl(h.old_price)} → <b>{brl(h.new_price)}</b></p>}
                      {h.old_price_pix !== h.new_price_pix && <p>PIX: {brl(h.old_price_pix)} → <b>{brl(h.new_price_pix)}</b></p>}
                      {h.old_discount !== h.new_discount && <p>Desconto: {h.old_discount ?? 0}% → <b>{h.new_discount ?? 0}%</b></p>}
                    </li>
                  ))}
                  {shownHistory.length === 0 && <li className="p-6 text-center text-muted-foreground">Sem alterações registradas ainda.</li>}
                </ul>
              </section>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default AdminStockPrices;
