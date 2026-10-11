import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2, Tag, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { z } from "zod";
import { formatCouponValue } from "@/hooks/use-coupon";

interface Coupon {
  id: string; code: string; description: string | null; discount_type: "percent" | "fixed"; discount_value: number;
  starts_at: string | null; expires_at: string | null; max_uses: number | null; uses_count: number; per_cpf_limit: number;
  min_purchase: number; allowed_categories: string[]; blocked_categories: string[]; blocked_cpfs: string[]; blocked_emails: string[];
  applies_to_catalog: boolean; applies_to_special_orders: boolean; show_in_catalog: boolean; is_active: boolean; created_at: string;
}
interface Redemption { id: string; code: string; user_email: string | null; cpf: string | null; order_id: string | null; special_order_id: string | null; discount_amount: number; created_at: string }

const empty = {
  code: "", description: "", discount_type: "percent" as "percent" | "fixed", discount_value: "10", starts_at: "", expires_at: "",
  max_uses: "", per_cpf_limit: "1", min_purchase: "0", allowed_categories: "", blocked_categories: "", blocked_cpfs: "", blocked_emails: "",
  applies_to_catalog: true, applies_to_special_orders: true, show_in_catalog: false, is_active: true,
};
type Form = typeof empty;

const schema = z.object({
  code: z.string().trim().min(3, "Código com pelo menos 3 caracteres").max(40).regex(/^[A-Za-z0-9_-]+$/, "Use apenas letras, números, - e _"),
  discount_value: z.number().positive("Valor deve ser maior que zero"),
});

const list = (s: string) => s.split(/[,\n;]/).map((x) => x.trim()).filter(Boolean);
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const brl = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Coupon | null>(null);
  const [historyFor, setHistoryFor] = useState<Coupon | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  // No celular, a renovação do login pode travar a requisição; limita o tempo
  // de espera e tenta de novo em vez de deixar o botão girando para sempre.
  const withTimeout = <T,>(p: PromiseLike<T>, ms: number) =>
    Promise.race([
      Promise.resolve(p),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
    ]);

  const runWithRetry = async <T,>(fn: () => PromiseLike<T>): Promise<T> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await withTimeout(fn(), 10000);
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    throw lastErr;
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await runWithRetry(() =>
        supabase.from("coupons" as never).select("*").order("created_at", { ascending: false }));
      if (error) toast.error("Falha ao carregar cupons");
      setCoupons((data ?? []) as unknown as Coupon[]);
    } catch {
      toast.error("Conexão lenta — toque para tentar de novo");
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!historyFor) return;
    void supabase.from("coupon_redemptions" as never).select("*").eq("coupon_id", historyFor.id).order("created_at", { ascending: false })
      .then(({ data }) => setRedemptions((data ?? []) as unknown as Redemption[]));
  }, [historyFor]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      code: c.code, description: c.description ?? "", discount_type: c.discount_type, discount_value: String(c.discount_value),
      starts_at: toLocal(c.starts_at), expires_at: toLocal(c.expires_at), max_uses: c.max_uses == null ? "" : String(c.max_uses),
      per_cpf_limit: String(c.per_cpf_limit), min_purchase: String(c.min_purchase),
      allowed_categories: c.allowed_categories.join(", "), blocked_categories: c.blocked_categories.join(", "),
      blocked_cpfs: c.blocked_cpfs.join(", "), blocked_emails: c.blocked_emails.join(", "),
      applies_to_catalog: c.applies_to_catalog, applies_to_special_orders: c.applies_to_special_orders, show_in_catalog: c.show_in_catalog, is_active: c.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    const value = Number(form.discount_value.replace(",", "."));
    const parsed = schema.safeParse({ code: form.code, discount_value: value });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (form.discount_type === "percent" && value > 100) { toast.error("Percentual máximo é 100%"); return; }
    if (form.starts_at && form.expires_at && new Date(form.expires_at) <= new Date(form.starts_at)) { toast.error("A validade deve terminar depois do início"); return; }
    const payload = {
      code: form.code.trim().toUpperCase(), description: form.description.trim() || null, discount_type: form.discount_type, discount_value: value,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null, expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      max_uses: form.max_uses ? Math.max(1, parseInt(form.max_uses)) : null, per_cpf_limit: Math.max(1, parseInt(form.per_cpf_limit) || 1),
      min_purchase: Number(form.min_purchase.replace(",", ".")) || 0,
      allowed_categories: list(form.allowed_categories), blocked_categories: list(form.blocked_categories),
      blocked_cpfs: list(form.blocked_cpfs), blocked_emails: list(form.blocked_emails),
      applies_to_catalog: form.applies_to_catalog, applies_to_special_orders: form.applies_to_special_orders, show_in_catalog: form.show_in_catalog, is_active: form.is_active,
    };
    setSaving(true);
    const q = editing
      ? supabase.from("coupons" as never).update(payload as never).eq("id", editing.id)
      : supabase.from("coupons" as never).insert(payload as never);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message.includes("duplicate") ? "Já existe um cupom com esse código" : error.message); return; }
    toast.success(editing ? "Cupom atualizado" : "Cupom criado");
    setOpen(false); void load();
  };

  const remove = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("coupons" as never).delete().eq("id", toDelete.id);
    if (error) toast.error(error.message); else { toast.success("Cupom excluído"); void load(); }
    setToDelete(null);
  };

  const status = (c: Coupon) => {
    const now = Date.now();
    if (!c.is_active) return <Badge variant="secondary">Inativo</Badge>;
    if (c.expires_at && new Date(c.expires_at).getTime() < now) return <Badge variant="destructive">Expirado</Badge>;
    if (c.starts_at && new Date(c.starts_at).getTime() > now) return <Badge variant="outline">Agendado</Badge>;
    if (c.max_uses != null && c.uses_count >= c.max_uses) return <Badge variant="destructive">Esgotado</Badge>;
    return <Badge className="bg-success text-success-foreground">Ativo</Badge>;
  };

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
            <h1 className="font-display text-2xl text-foreground flex items-center gap-2"><Tag className="h-5 w-5 text-primary" /> Cupons</h1>
          </div>
          <Button onClick={openNew} className="gap-1"><Plus className="h-4 w-4" /> Novo cupom</Button>
        </div>
        <p className="text-sm text-muted-foreground">Cupons não são acumulativos: o cliente usa um por pedido. Valem para PIX e cartão, na loja e/ou nas encomendas.</p>

        {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : coupons.length === 0 ? (
          <p className="text-muted-foreground">Nenhum cupom cadastrado.</p>
        ) : (
          <div className="grid gap-3">
            {coupons.map((c) => (
              <div key={c.id} className="glass-card p-3 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base sm:text-lg text-foreground tracking-wide break-all">{c.code}</span>
                    <span className="font-semibold text-success">{formatCouponValue(c)}</span>
                    {status(c)}
                    {c.show_in_catalog && <Badge variant="outline">No catálogo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {c.description ? `${c.description} · ` : ""}
                    Usos: {c.uses_count}{c.max_uses != null ? `/${c.max_uses}` : ""} · {c.per_cpf_limit} por CPF
                    {c.starts_at ? ` · de ${new Date(c.starts_at).toLocaleString("pt-BR")}` : ""}
                    {c.expires_at ? ` · até ${new Date(c.expires_at).toLocaleString("pt-BR")}` : ""}
                    {c.min_purchase > 0 ? ` · mínimo ${brl(c.min_purchase)}` : ""}
                    {` · ${[c.applies_to_catalog && "Loja", c.applies_to_special_orders && "Encomendas"].filter(Boolean).join(" + ")}`}
                  </p>
                  {(c.allowed_categories.length > 0 || c.blocked_categories.length > 0 || c.blocked_cpfs.length + c.blocked_emails.length > 0) && (
                    <p className="text-xs text-muted-foreground">
                      {c.allowed_categories.length > 0 && `Só: ${c.allowed_categories.join(", ")}. `}
                      {c.blocked_categories.length > 0 && `Exceto: ${c.blocked_categories.join(", ")}. `}
                      {c.blocked_cpfs.length + c.blocked_emails.length > 0 && `${c.blocked_cpfs.length + c.blocked_emails.length} cliente(s) bloqueado(s).`}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 w-full sm:w-auto justify-end border-t border-border/50 pt-2 sm:border-0 sm:pt-0">
                  <Button size="sm" variant="outline" className="gap-1 mr-auto sm:mr-0" onClick={() => setHistoryFor(c)}><History className="h-3.5 w-3.5" /> Histórico</Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setToDelete(c)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle>{editing ? "Editar cupom" : "Novo cupom"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Código</Label><Input value={form.code} maxLength={40} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="BEMVINDO10" /></div>
              <div><Label>Descrição</Label><Input value={form.description} maxLength={120} onChange={(e) => set("description", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3" value={form.discount_type} onChange={(e) => set("discount_type", e.target.value as "percent" | "fixed")}>
                  <option value="percent">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option>
                </select>
              </div>
              <div><Label>Valor</Label><Input inputMode="decimal" value={form.discount_value} onChange={(e) => set("discount_value", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Válido a partir de</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></div>
              <div><Label>Válido até</Label><Input type="datetime-local" value={form.expires_at} onChange={(e) => set("expires_at", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>Limite total de usos</Label><Input inputMode="numeric" placeholder="Ilimitado" value={form.max_uses} onChange={(e) => set("max_uses", e.target.value.replace(/\D/g, ""))} /></div>
              <div><Label>Usos por CPF</Label><Input inputMode="numeric" value={form.per_cpf_limit} onChange={(e) => set("per_cpf_limit", e.target.value.replace(/\D/g, ""))} /></div>
              <div><Label>Compra mínima (R$)</Label><Input inputMode="decimal" value={form.min_purchase} onChange={(e) => set("min_purchase", e.target.value)} /></div>
            </div>
            <div><Label>Só para estas categorias (vazio = todas)</Label><Input value={form.allowed_categories} onChange={(e) => set("allowed_categories", e.target.value)} placeholder="Ex.: Secret Lair, Commander" /></div>
            <div><Label>Bloquear categorias</Label><Input value={form.blocked_categories} onChange={(e) => set("blocked_categories", e.target.value)} placeholder="Separe por vírgula" /></div>
            <div><Label>Bloquear clientes por CPF</Label><Input value={form.blocked_cpfs} onChange={(e) => set("blocked_cpfs", e.target.value)} placeholder="000.000.000-00, ..." /></div>
            <div><Label>Bloquear clientes por e-mail</Label><Input value={form.blocked_emails} onChange={(e) => set("blocked_emails", e.target.value)} placeholder="cliente@email.com, ..." /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {([["is_active", "Ativo"], ["show_in_catalog", "Mostrar no catálogo"], ["applies_to_catalog", "Vale na loja"], ["applies_to_special_orders", "Vale em encomendas"]] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2"><Switch checked={form[k]} onCheckedChange={(v) => set(k, v)} /> {l}</label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyFor} onOpenChange={(o) => { if (!o) { setHistoryFor(null); setRedemptions([]); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle>Quem usou {historyFor?.code}</DialogTitle></DialogHeader>
          {redemptions.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum uso ainda.</p> : (
            <>
            <ul className="sm:hidden space-y-2">
              {redemptions.map((r) => (
                <li key={r.id} className="rounded-md border border-border p-2 text-xs space-y-0.5">
                  <p className="flex justify-between"><span>{new Date(r.created_at).toLocaleString("pt-BR")}</span><b>-{brl(r.discount_amount)}</b></p>
                  <p className="truncate">{r.user_email ?? "—"} · CPF {r.cpf ? `***.${r.cpf.slice(3, 6)}.${r.cpf.slice(6, 9)}-**` : "—"}</p>
                  {r.order_id ? <Link className="text-primary underline" to={`/admin/pedidos/${r.order_id}`}>Pedido #{r.order_id.slice(0, 8)}</Link>
                    : r.special_order_id ? <Link className="text-primary underline" to={`/admin/encomendas/${r.special_order_id}`}>Encomenda #{r.special_order_id.slice(0, 8)}</Link> : null}
                </li>
              ))}
            </ul>
            <table className="hidden sm:table w-full text-xs">
              <thead><tr className="text-left text-muted-foreground border-b border-border"><th className="py-1.5">Data</th><th>Cliente</th><th>CPF</th><th>Pedido</th><th className="text-right">Desconto</th></tr></thead>
              <tbody>
                {redemptions.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-1.5">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                    <td>{r.user_email ?? "—"}</td>
                    <td>{r.cpf ? `***.${r.cpf.slice(3, 6)}.${r.cpf.slice(6, 9)}-**` : "—"}</td>
                    <td>
                      {r.order_id ? <Link className="text-primary underline" to={`/admin/pedidos/${r.order_id}`}>#{r.order_id.slice(0, 8)}</Link>
                        : r.special_order_id ? <Link className="text-primary underline" to={`/admin/encomendas/${r.special_order_id}`}>Encomenda #{r.special_order_id.slice(0, 8)}</Link> : "—"}
                    </td>
                    <td className="text-right font-medium">{brl(r.discount_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom {toDelete?.code}?</AlertDialogTitle>
            <AlertDialogDescription>O histórico de uso deste cupom também será apagado. Pedidos já feitos mantêm o desconto. Para apenas pausar, desative-o.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={remove}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCoupons;
