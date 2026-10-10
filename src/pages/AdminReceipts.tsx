import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Upload, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Pending { id: string; total: number; created_at: string; customer_info: { name?: string; email?: string } | null; coupon_code: string | null }
interface Result { file: string; status: "confirmed" | "review" | "error"; order_id?: string | null; reasons?: string[]; error?: string; amount?: number | null }

const brl = (v: number) => `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const toB64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });

const AdminReceipts = () => {
  const [pending, setPending] = useState<Pending[]>([]);
  const [orderId, setOrderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);

  const load = () => supabase.from("orders").select("id, total, created_at, customer_info, coupon_code").eq("status", "pending_payment").eq("payment_method", "pix")
    .order("created_at", { ascending: false }).limit(100).then(({ data }) => setPending((data ?? []) as unknown as Pending[]));
  useEffect(() => { void load(); }, []);

  const send = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setResults((r) => [{ file: f.name, status: "error", error: "Use foto JPG, PNG ou WEBP." }, ...r]); continue; }
      if (f.size > 6 * 1024 * 1024) { setResults((r) => [{ file: f.name, status: "error", error: "Foto acima de 6 MB." }, ...r]); continue; }
      const { data, error } = await supabase.functions.invoke("pix-receipt-auto", { body: { image_base64: await toB64(f), mime: f.type, order_id: orderId || undefined } });
      const res: Result = error || data?.error
        ? { file: f.name, status: "error", error: data?.error ?? error?.message }
        : { file: f.name, status: data.status, order_id: data.order_id, reasons: data.reasons, amount: data.extracted?.amount };
      if (res.status === "confirmed") toast.success(`Pedido #${res.order_id?.slice(0, 8).toUpperCase()} confirmado`);
      setResults((r) => [res, ...r]);
    }
    setBusy(false); setOrderId(""); void load();
  };

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link to="/admin"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="font-display text-2xl flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Comprovantes PIX</h1>
        </div>
        <p className="text-sm text-muted-foreground">Envie fotos dos comprovantes do PIX manual. A leitura automática confere valor, CNPJ da loja e ID da transação; se tudo bater com um único pedido pendente, ele é marcado como pago na hora. Casos duvidosos ficam para você revisar.</p>

        <div className="glass-card p-4 space-y-3">
          <label className="text-sm block">Pedido (opcional — use quando houver vários com o mesmo valor)
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">Encontrar pelo valor</option>
              {pending.map((o) => <option key={o.id} value={o.id}>#{o.id.slice(0, 8).toUpperCase()} · {o.customer_info?.name || o.customer_info?.email || "Cliente"} · {brl(o.total)}</option>)}
            </select>
          </label>
          <label className={`flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-sm cursor-pointer hover:border-primary ${busy ? "opacity-60 pointer-events-none" : ""}`}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />} {busy ? "Lendo comprovantes…" : "Tirar foto ou escolher imagens"}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { void send(e.target.files); e.target.value = ""; }} />
          </label>
        </div>

        {results.length > 0 && (
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={i} className="glass-card p-3 text-sm space-y-1">
                <p className="flex items-center gap-2 font-medium">
                  {r.status === "confirmed" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                  {r.status === "confirmed" ? "Pago e confirmado" : r.status === "review" ? "Precisa de revisão" : "Erro"} · <span className="truncate text-muted-foreground">{r.file}</span>
                </p>
                {r.amount != null && <p className="text-xs">Valor lido: {brl(r.amount)}</p>}
                {r.order_id && <Link className="text-xs text-primary underline" to={`/admin/pedidos/${r.order_id}`}>Abrir pedido #{r.order_id.slice(0, 8).toUpperCase()}</Link>}
                {r.reasons?.map((x) => <p key={x} className="text-xs text-muted-foreground">• {x}</p>)}
                {r.error && <p className="text-xs text-destructive">{r.error}</p>}
              </li>
            ))}
          </ul>
        )}

        <section className="glass-card p-3">
          <h2 className="font-semibold text-sm mb-2">PIX pendentes ({pending.length})</h2>
          <ul className="divide-y divide-border text-sm">
            {pending.map((o) => (
              <li key={o.id} className="py-2 flex justify-between gap-2">
                <Link to={`/admin/pedidos/${o.id}`} className="min-w-0 hover:underline">
                  <p className="font-mono text-xs">#{o.id.slice(0, 8).toUpperCase()} · {o.customer_info?.name || o.customer_info?.email || "Cliente"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR")}{o.coupon_code ? ` · ${o.coupon_code}` : ""}</p>
                </Link>
                <span className="font-medium shrink-0">{brl(o.total)}</span>
              </li>
            ))}
            {pending.length === 0 && <li className="py-3 text-xs text-muted-foreground">Nenhum PIX pendente.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default AdminReceipts;
