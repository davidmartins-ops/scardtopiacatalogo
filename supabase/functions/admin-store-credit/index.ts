import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  action: "list" | "lookup" | "adjust" | "history";
  email?: string;
  user_id?: string;
  amount?: number;
  note?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function findUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  const target = email.trim().toLowerCase();
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match;
    if (data.users.length < 200) return null;
    page++;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdminRows } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .limit(1);
    if (!isAdminRows?.length) return json({ error: "Forbidden" }, 403);

    const body = (await req.json().catch(() => ({}))) as Payload;

    if (body.action === "list") {
      const { data: rows, error } = await admin
        .from("store_credits")
        .select("user_id, balance, updated_at")
        .order("balance", { ascending: false });
      if (error) return json({ error: error.message }, 500);

      const enriched = await Promise.all(
        (rows ?? []).map(async (r: any) => {
          const { data: u } = await admin.auth.admin.getUserById(r.user_id);
          const { data: p } = await admin
            .from("customer_profiles")
            .select("display_name")
            .eq("id", r.user_id)
            .maybeSingle();
          return {
            user_id: r.user_id,
            balance: Number(r.balance),
            updated_at: r.updated_at,
            email: u?.user?.email ?? null,
            display_name: (p as any)?.display_name ?? null,
          };
        })
      );
      return json({ credits: enriched });
    }

    if (body.action === "lookup") {
      if (!body.email) return json({ error: "email required" }, 400);
      const target = await findUserByEmail(admin, body.email);
      if (!target) return json({ error: "Usuário não encontrado. Ele precisa ter feito login ao menos uma vez." }, 404);
      const { data: balRow } = await admin
        .from("store_credits")
        .select("balance, updated_at")
        .eq("user_id", target.id)
        .maybeSingle();
      const { data: p } = await admin
        .from("customer_profiles")
        .select("display_name")
        .eq("id", target.id)
        .maybeSingle();
      return json({
        user_id: target.id,
        email: target.email,
        display_name: (p as any)?.display_name ?? null,
        balance: Number((balRow as any)?.balance ?? 0),
        updated_at: (balRow as any)?.updated_at ?? null,
      });
    }

    if (body.action === "adjust") {
      if (!body.user_id || typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount === 0) {
        return json({ error: "user_id e amount (≠ 0) são obrigatórios" }, 400);
      }
      // Call the SECURITY DEFINER function as the calling admin (so auth.uid() = admin)
      const { data, error } = await userClient.rpc("admin_adjust_store_credit", {
        _user_id: body.user_id,
        _amount: body.amount,
        _note: body.note ?? null,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ balance: Number(data) });
    }

    if (body.action === "history") {
      if (!body.user_id) return json({ error: "user_id required" }, 400);
      const { data, error } = await admin
        .from("store_credit_transactions")
        .select("*")
        .eq("user_id", body.user_id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return json({ error: error.message }, 500);
      return json({ transactions: data ?? [] });
    }

    return json({ error: "invalid action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
