import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  action: "list" | "grant" | "revoke";
  email?: string;
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

    // Verify caller and check admin role
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
      const { data: roles, error } = await admin
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .eq("role", "admin")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);

      const results = await Promise.all(
        (roles ?? []).map(async (r) => {
          const { data: u } = await admin.auth.admin.getUserById(r.user_id);
          return {
            id: r.id,
            user_id: r.user_id,
            email: u?.user?.email ?? null,
            created_at: r.created_at,
          };
        })
      );
      return json({ admins: results });
    }

    if (!body.email) return json({ error: "email required" }, 400);
    const targetEmail = body.email.trim().toLowerCase();

    // Find target user by email (paginate through users)
    let foundUserId: string | null = null;
    let page = 1;
    while (page <= 20 && !foundUserId) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      const match = data.users.find((u) => (u.email ?? "").toLowerCase() === targetEmail);
      if (match) foundUserId = match.id;
      if (data.users.length < 200) break;
      page++;
    }

    if (!foundUserId) {
      return json(
        { error: "Usuário não encontrado. Peça que ele faça login pela primeira vez antes de promover." },
        404
      );
    }

    if (body.action === "grant") {
      const { error } = await admin
        .from("user_roles")
        .insert({ user_id: foundUserId, role: "admin" });
      if (error && !error.message.includes("duplicate")) return json({ error: error.message }, 500);
      return json({ ok: true, user_id: foundUserId });
    }

    if (body.action === "revoke") {
      if (foundUserId === userData.user.id) {
        return json({ error: "Você não pode remover seu próprio acesso admin." }, 400);
      }
      const { error } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", foundUserId)
        .eq("role", "admin");
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "invalid action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
