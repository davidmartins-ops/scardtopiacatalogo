import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const STORE_CNPJ = "66981664000197";
const MODEL = "google/gemini-3-flash-preview";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_BYTES = 6 * 1024 * 1024;

interface Extracted {
  is_pix_receipt: boolean; amount: number | null; paid_at: string | null; recipient_document: string | null;
  recipient_name: string | null; payer_name: string | null; transaction_id: string | null; confidence: number;
}

async function extract(dataUrl: string): Promise<Extracted> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("IA não configurada");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "Você lê comprovantes de PIX brasileiros. Extraia apenas o que está visível; use null quando não houver. Nunca invente valores." },
        { role: "user", content: [
          { type: "text", text: "Extraia os dados deste comprovante de PIX." },
          { type: "image_url", image_url: { url: dataUrl } },
        ] },
      ],
      tools: [{ type: "function", function: {
        name: "pix_receipt", description: "Dados do comprovante",
        parameters: { type: "object", additionalProperties: false, required: ["is_pix_receipt", "amount", "paid_at", "recipient_document", "recipient_name", "payer_name", "transaction_id", "confidence"], properties: {
          is_pix_receipt: { type: "boolean", description: "true se for um comprovante de PIX concluído" },
          amount: { type: ["number", "null"], description: "Valor pago em reais, ex. 9.5" },
          paid_at: { type: ["string", "null"], description: "Data/hora ISO 8601 do pagamento" },
          recipient_document: { type: ["string", "null"], description: "CPF/CNPJ do recebedor como aparece (pode estar mascarado)" },
          recipient_name: { type: ["string", "null"] },
          payer_name: { type: ["string", "null"] },
          transaction_id: { type: ["string", "null"], description: "ID da transação / E2E (começa com E) ou autenticação" },
          confidence: { type: "number", description: "0 a 1, confiança na leitura" },
        } },
      } }],
      tool_choice: { type: "function", function: { name: "pix_receipt" } },
    }),
  });
  if (res.status === 402) throw new Error("Créditos de IA esgotados.");
  if (res.status === 429) throw new Error("Muitas solicitações, tente em instantes.");
  if (!res.ok) throw new Error(`Falha na leitura por IA (${res.status})`);
  const out = await res.json();
  const args = out?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("A IA não conseguiu ler o comprovante.");
  return JSON.parse(args);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (isAdmin !== true) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => null);
    const b64 = typeof body?.image_base64 === "string" ? body.image_base64 : "";
    const mime = typeof body?.mime === "string" && /^image\/(jpeg|png|webp)$/.test(body.mime) ? body.mime : null;
    const orderId = typeof body?.order_id === "string" && /^[0-9a-f-]{36}$/i.test(body.order_id) ? body.order_id : null;
    if (!b64 || !mime) return json({ error: "Envie uma foto (JPG, PNG ou WEBP)." }, 400);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (bytes.length > MAX_BYTES) return json({ error: "Foto acima de 6 MB." }, 400);

    const ex = await extract(`data:${mime};base64,${b64}`);
    const reasons: string[] = [];
    if (!ex.is_pix_receipt) reasons.push("A imagem não parece um comprovante de PIX concluído.");
    if (ex.confidence < 0.7) reasons.push("Leitura com baixa confiança.");
    const doc = (ex.recipient_document ?? "").replace(/[^0-9*]/g, "");
    const docOk = doc.replace(/\D/g, "") === STORE_CNPJ || (doc.length === 14 && [...doc].every((ch, i) => ch === "*" || ch === STORE_CNPJ[i]) && doc.replace(/\D/g, "").length >= 6);
    if (!docOk) reasons.push("O recebedor não é o CNPJ da loja (66.981.664/0001-97).");
    if (ex.amount == null || ex.amount <= 0) reasons.push("Valor não identificado.");
    const txId = ex.transaction_id?.trim() || null;
    if (!txId) reasons.push("ID da transação não identificado.");
    if (ex.paid_at && Date.now() - new Date(ex.paid_at).getTime() > 30 * 864e5) reasons.push("Pagamento com mais de 30 dias.");

    if (txId) {
      const { data: dup } = await admin.from("payment_events").select("order_id").eq("transaction_nsu", txId).maybeSingle();
      if (dup) reasons.push(`Este comprovante já foi usado${dup.order_id ? ` no pedido #${dup.order_id.slice(0, 8).toUpperCase()}` : ""}.`);
    }

    // Find matching order
    let order: { id: string; total: number; status: string; receipt_url: string | null } | null = null;
    if (ex.amount != null) {
      let q = admin.from("orders").select("id, total, status, receipt_url").eq("status", "pending_payment").eq("payment_method", "pix")
        .gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString());
      if (orderId) q = q.eq("id", orderId);
      const { data: cands } = await q;
      const match = (cands ?? []).filter((o) => Math.abs(Number(o.total) - Number(ex.amount)) < 0.01);
      if (match.length === 1) order = match[0];
      else if (match.length > 1) reasons.push(`${match.length} pedidos pendentes têm esse mesmo valor — escolha o pedido.`);
      else reasons.push(orderId ? "O valor do comprovante não bate com o total do pedido escolhido." : "Nenhum pedido PIX pendente com esse valor.");
    }

    // Keep the photo either way
    const path = `admin-receipts/${order?.id ?? "sem-pedido"}/${Date.now()}.${mime.split("/")[1]}`;
    await admin.storage.from("receipts").upload(path, bytes, { contentType: mime });

    if (reasons.length || !order) {
      await admin.from("admin_audit_log").insert({ actor_id: u.user.id, actor_email: u.user.email, action: "pix_receipt_review", entity_type: "order", entity_id: order?.id ?? "none", metadata: { extracted: ex, reasons, path } });
      return json({ status: "review", reasons, extracted: ex, order_id: order?.id ?? null });
    }

    const { error: upErr } = await admin.from("orders").update({
      status: "payment_confirmed", paid_at: ex.paid_at ?? new Date().toISOString(), paid_amount: ex.amount,
      payment_transaction_id: txId, payment_capture_method: "pix_manual", receipt_url: order.receipt_url ?? path,
    }).eq("id", order.id).eq("status", "pending_payment");
    if (upErr) return json({ error: "Falha ao atualizar o pedido" }, 500);
    await admin.from("payment_events").insert({ order_id: order.id, transaction_nsu: txId!, provider: "pix_manual", status: "paid", amount: ex.amount, paid_amount: ex.amount, capture_method: "pix", raw_response: { extracted: ex, receipt_path: path, by: u.user.email } });
    await admin.from("admin_audit_log").insert({ actor_id: u.user.id, actor_email: u.user.email, action: "pix_receipt_auto_confirmed", entity_type: "order", entity_id: order.id, metadata: { extracted: ex, path } });
    try {
      await fetch(`${url}/functions/v1/notify-order-status`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${service}` }, body: JSON.stringify({ orderId: order.id, status: "payment_confirmed" }) });
    } catch { /* best effort */ }
    return json({ status: "confirmed", order_id: order.id, extracted: ex });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
