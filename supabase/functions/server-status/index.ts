import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Sample = { name: string; labels: string; value: number };

function parse(text: string): Sample[] {
  const out: Sample[] = [];
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([a-zA-Z_:][\w:]*)(\{[^}]*\})?\s+(\S+)/);
    if (m) out.push({ name: m[1], labels: m[2] ?? "", value: Number(m[3]) });
  }
  return out;
}

const sum = (s: Sample[], name: string, filter?: (l: string) => boolean) => {
  const r = s.filter((x) => x.name === name && (!filter || filter(x.labels)));
  return r.length ? r.reduce((a, b) => a + b.value, 0) : null;
};

async function cpuIdle(url: string, auth: string) {
  const get = async () => parse(await (await fetch(url, { headers: { Authorization: auth } })).text());
  const a = await get();
  await new Promise((r) => setTimeout(r, 1500));
  const b = await get();
  const tot = (s: Sample[]) => sum(s, "node_cpu_seconds_total") ?? 0;
  const idle = (s: Sample[]) => sum(s, "node_cpu_seconds_total", (l) => l.includes('mode="idle"')) ?? 0;
  const dt = tot(b) - tot(a);
  return { samples: b, cpu: dt > 0 ? Math.max(0, Math.min(100, (1 - (idle(b) - idle(a)) / dt) * 100)) : null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "unauthorized" }, 401);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  const t0 = Date.now();
  const { error: pingErr } = await admin.from("user_roles").select("id", { head: true, count: "exact" }).limit(1);
  const dbLatency = Date.now() - t0;

  const result: Record<string, unknown> = { checked_at: new Date().toISOString(), db_ok: !pingErr, db_latency_ms: dbLatency };
  try {
    const auth = "Basic " + btoa(`service_role:${key}`);
    const { samples: s, cpu } = await cpuIdle(`${url}/customer/v1/privileged/metrics`, auth);
    const memTotal = sum(s, "node_memory_MemTotal_bytes");
    const memAvail = sum(s, "node_memory_MemAvailable_bytes");
    const boot = sum(s, "node_boot_time_seconds");
    const pgStart = sum(s, "pg_postmaster_start_time_seconds");
    const conns = sum(s, "pg_stat_activity_count") ?? sum(s, "pg_stat_database_num_backends");
    const maxConns = sum(s, "pg_settings_max_connections");
    const load1 = sum(s, "node_load1");
    result.cpu_percent = cpu ?? (load1 != null ? Math.min(100, (load1 / 2) * 100) : null);
    result.memory_percent = memTotal && memAvail != null ? ((memTotal - memAvail) / memTotal) * 100 : null;
    result.memory_total_bytes = memTotal;
    result.connections = conns;
    result.max_connections = maxConns ?? 60;
    result.load1 = sum(s, "node_load1");
    const start = pgStart ?? boot;
    result.restarted_at = start ? new Date(start * 1000).toISOString() : null;
  } catch (e) {
    result.metrics_error = String((e as Error).message ?? e);
  }
  return json(result);
});
