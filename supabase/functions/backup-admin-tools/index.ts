import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const BUCKET = "sales-backups";
const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function healthCheck(admin: ReturnType<typeof createClient>) {
  const steps: { step: string; ok: boolean; detail?: string }[] = [];
  const run = async (step: string, fn: () => Promise<string | void>) => {
    try { const d = await fn(); steps.push({ step, ok: true, detail: d || undefined }); return true; }
    catch (e) { steps.push({ step, ok: false, detail: (e as Error).message }); return false; }
  };
  const path = `_healthcheck/probe-${Date.now()}.txt`;
  const exists = await run("Pasta de backups existe e é privada", async () => {
    const { data, error } = await admin.storage.getBucket(BUCKET);
    if (error || !data) throw new Error(error?.message ?? "Pasta não encontrada");
    if (data.public) throw new Error("A pasta está pública — deveria ser privada");
  });
  if (exists) {
    const up = await run("Gravação (backup agendado)", async () => {
      const { error } = await admin.storage.from(BUCKET).upload(path, new Blob(["ok"], { type: "text/plain" }), { upsert: true });
      if (error) throw error;
    });
    await run("Listagem do cofre", async () => {
      const { data, error } = await admin.storage.from(BUCKET).list("daily", { limit: 1 });
      if (error) throw error;
      return `${data?.length ?? 0} item(ns) visível(is) em daily/`;
    });
    if (up) {
      await run("Leitura por link temporário", async () => {
        const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 30);
        if (error || !data) throw new Error(error?.message ?? "Sem link");
        const r = await fetch(data.signedUrl);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        await r.text();
      });
      await admin.storage.from(BUCKET).remove([path]);
    }
  }
  const { data: runner } = await admin.from("backup_runner").select("last_run_at, last_result").eq("id", 1).maybeSingle();
  return { ok: steps.every((s) => s.ok), steps, last_backup_at: runner?.last_run_at ?? null, checked_at: new Date().toISOString() };
}

async function diagnose(req: Request, logs: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "Lovable AI não configurado" }, 500);
  const res = await fetch(GATEWAY, {
    method: "POST",
    signal: req.signal,
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "medium", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      instructions:
        "Você é um engenheiro de confiabilidade que analisa logs do backup diário de vendas de uma loja (função que exporta pedidos/pagamentos em JSON e copia comprovantes PIX para uma pasta privada de armazenamento, agendada por cron). Responda em português do Brasil, em markdown curto, com: 1) Diagnóstico provável, 2) Evidências nos logs, 3) Passos de recuperação numerados, 4) Como evitar. Não invente dados ausentes; se os logs forem insuficientes, diga o que coletar. Máximo ~300 palavras.",
      input: [{ role: "user", content: `Logs do backup:\n\n${logs}` }],
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    let msg = "Falha na análise por IA";
    try { msg = JSON.parse(t)?.error?.message ?? JSON.parse(t)?.message ?? msg; } catch { /* ignore */ }
    if (res.status === 402) msg = "Créditos de IA esgotados. Adicione créditos em Configurações → Planos e créditos.";
    if (res.status === 429) msg = "Muitas solicitações. Tente novamente em alguns instantes.";
    return json({ error: msg }, res.status);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "", text = "", failed: string | null = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const ev = JSON.parse(raw);
        if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
        else if (ev.type === "response.failed" || ev.type === "error")
          failed = ev.response?.error?.message ?? ev.message ?? "Falha na análise";
        else if (ev.type === "response.refusal.delta") failed = "A IA recusou analisar este conteúdo.";
      } catch { /* ignore partial */ }
    }
  }
  if (failed) return json({ error: failed }, 502);
  if (!text.trim()) return json({ error: "A IA não retornou diagnóstico." }, 502);
  return json({ diagnosis: text });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u, error: ue } = await admin.auth.getUser(token);
    if (ue || !u?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (isAdmin !== true) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    if (body?.action === "health") {
      const result = await healthCheck(admin);
      await admin.from("admin_audit_log").insert({
        actor_id: u.user.id, actor_email: u.user.email, action: "backup_health_check",
        entity_type: "sales_backups", entity_id: BUCKET, metadata: result,
      });
      return json(result);
    }
    if (body?.action === "diagnose") {
      const logs = typeof body.logs === "string" ? body.logs.trim() : "";
      if (logs.length < 10) return json({ error: "Cole os logs do backup (mín. 10 caracteres)." }, 400);
      if (logs.length > 30000) return json({ error: "Logs muito longos (máx. 30.000 caracteres)." }, 400);
      return await diagnose(req, logs);
    }
    if (body?.action === "run") {
      const { data: runner } = await admin.from("backup_runner").select("token").eq("id", 1).maybeSingle();
      if (!runner?.token) return json({ error: "Backup não configurado" }, 500);
      const r = await fetch(`${url}/functions/v1/sales-backup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-backup-token": runner.token, "x-backup-source": "manual" },
        body: "{}",
      });
      const out = await r.json().catch(() => ({}));
      return json(out, r.status);
    }
    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499, headers: corsHeaders });
    console.error("backup-admin-tools", e);
    return json({ error: "Erro interno" }, 500);
  }
});
