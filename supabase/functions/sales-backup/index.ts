import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "sales-backups";
const RETENTION_YEARS = 5;

const TABLES = [
  "orders",
  "order_status_history",
  "payment_events",
  "payment_reconciliation",
  "cash_closures",
  "order_refunds",
  "order_disputes",
  "store_credit_transactions",
  "special_orders",
  "special_order_items",
  "special_order_quotes",
  "special_order_status_history",
  "special_order_attachments",
  "shipping_label_events",
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Repete uma operação com espera crescente — útil quando o banco está lento/travado. */
async function retry<T>(label: string, fn: () => Promise<T>, log: string[], tries = 4): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      log.push(`${new Date().toISOString()} ${label}: tentativa ${i}/${tries} falhou — ${(e as Error).message}`);
      if (i < tries) await sleep(2000 * 2 ** (i - 1));
    }
  }
  throw last;
}

async function fetchAll(admin: ReturnType<typeof createClient>, table: string) {
  const rows: unknown[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await admin.from(table).select("*").range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return rows;
}

async function listAll(admin: ReturnType<typeof createClient>, bucket: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    for (const e of data ?? []) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null) out.push(...(await listAll(admin, bucket, path)));
      else out.push(path);
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = req.headers.get("x-backup-token") ?? "";
  const source = req.headers.get("x-backup-source") ?? "cron";
  const { data: runner } = await admin.from("backup_runner").select("token").eq("id", 1).maybeSingle();
  if (!token || !runner?.token || token !== runner.token) return json({ error: "forbidden" }, 403);

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const log: string[] = [`${now.toISOString()} início (${source})`];

  // Registro da tentativa (não bloqueia se o banco estiver travado).
  let attemptId: string | null = null;
  try {
    const { data } = await admin.from("backup_attempts").insert({ source, started_at: now.toISOString() }).select("id").single();
    attemptId = data?.id ?? null;
  } catch { log.push("não foi possível registrar a tentativa no banco"); }

  const finish = async (ok: boolean, details: Record<string, unknown>, error?: string) => {
    log.push(`${new Date().toISOString()} fim: ${ok ? "sucesso" : "falha"}${error ? ` — ${error}` : ""}`);
    const record = { ok, source, started_at: now.toISOString(), finished_at: new Date().toISOString(), error: error ?? null, details, log };
    // Cópia do log no armazenamento: fica disponível mesmo se o banco não responder.
    await admin.storage.from(BUCKET)
      .upload(`logs/${day}/${now.getTime()}-${ok ? "ok" : "falha"}.json`, new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }), { upsert: true })
      .catch(() => {});
    try {
      if (attemptId) await admin.from("backup_attempts").update({ ok, finished_at: record.finished_at, error: record.error, details: { ...details, log } }).eq("id", attemptId);
      else await admin.from("backup_attempts").insert({ ok, source, started_at: record.started_at, finished_at: record.finished_at, error: record.error, details: { ...details, log } });
    } catch { /* log já salvo no armazenamento */ }
  };

  try {
    const summary: Record<string, number> = {};
    const data: Record<string, unknown[]> = {};
    for (const t of TABLES) {
      data[t] = await retry(`ler ${t}`, () => fetchAll(admin, t), log);
      summary[t] = data[t].length;
    }

    const payload = JSON.stringify({ generated_at: now.toISOString(), retention_years: RETENTION_YEARS, summary, data });
    await retry("gravar backup", async () => {
      const { error } = await admin.storage
        .from(BUCKET)
        .upload(`daily/${day}/vendas-${day}.json`, new Blob([payload], { type: "application/json" }), { upsert: true, contentType: "application/json" });
      if (error) throw new Error(error.message);
    }, log);

    const receipts = await retry("listar comprovantes", () => listAll(admin, "receipts"), log);
    const already = new Set(await retry("listar cofre", () => listAll(admin, BUCKET, "comprovantes"), log));
    let copied = 0;
    for (const path of receipts) {
      const dest = `comprovantes/${path}`;
      if (already.has(dest)) continue;
      const { data: file, error } = await admin.storage.from("receipts").download(path);
      if (error || !file) { log.push(`comprovante ignorado: ${path}`); continue; }
      const { error: e2 } = await admin.storage.from(BUCKET).upload(dest, file, { upsert: false, contentType: file.type || undefined });
      if (!e2) copied++;
    }

    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);
    const cutoffDay = cutoff.toISOString().slice(0, 10);
    const daily = await listAll(admin, BUCKET, "daily");
    const old = daily.filter((p) => (p.split("/")[1] ?? "9999") < cutoffDay);
    if (old.length) await admin.storage.from(BUCKET).remove(old);

    const result = { summary, copied, removed: old.length };
    await admin.from("backup_runner").update({ last_run_at: now.toISOString(), last_result: result }).eq("id", 1);
    await finish(true, result);
    return json({ ok: true, day, summary, receipts_copied: copied, removed_old: old.length });
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    console.error("sales-backup failed:", e);
    await finish(false, {}, msg);
    return json({ error: "backup_failed", details: msg }, 500);
  }
});
