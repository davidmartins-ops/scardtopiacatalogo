import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SlaRule {
  id: string;
  status: string;
  max_hours: number;
  enabled: boolean;
}

interface OrderRow {
  id: string;
  status: string;
  status_updated_at: string;
  sla_breached_at: string | null;
  sla_breach_status: string | null;
  total: number;
  user_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: rules } = await supabase
      .from("order_sla_rules")
      .select("*")
      .eq("enabled", true);

    const enabledRules = (rules ?? []) as SlaRule[];
    if (enabledRules.length === 0) {
      return new Response(JSON.stringify({ checked: 0, breached: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ruleByStatus = new Map(enabledRules.map((r) => [r.status, r]));
    const activeStatuses = enabledRules.map((r) => r.status);

    const { data: orders } = await supabase
      .from("orders")
      .select("id, status, status_updated_at, sla_breached_at, sla_breach_status, total, user_id")
      .in("status", activeStatuses);

    const all = (orders ?? []) as OrderRow[];
    const now = Date.now();
    let newBreaches = 0;

    for (const o of all) {
      const rule = ruleByStatus.get(o.status);
      if (!rule) continue;
      const updated = new Date(o.status_updated_at).getTime();
      const ageHours = (now - updated) / (1000 * 60 * 60);
      const breached = ageHours >= rule.max_hours;
      const wasBreachedForCurrentStatus =
        o.sla_breach_status === o.status && o.sla_breached_at !== null;

      if (breached && !wasBreachedForCurrentStatus) {
        await supabase
          .from("orders")
          .update({ sla_breached_at: new Date().toISOString(), sla_breach_status: o.status })
          .eq("id", o.id);

        await supabase.from("admin_audit_log").insert({
          actor_id: null,
          actor_email: "system",
          action: "sla_breach",
          entity_type: "order",
          entity_id: o.id,
          metadata: {
            status: o.status,
            max_hours: rule.max_hours,
            age_hours: Math.round(ageHours * 10) / 10,
            total: o.total,
          },
        });
        newBreaches += 1;
      } else if (!breached && wasBreachedForCurrentStatus) {
        // Status changed since breach – clear it
        await supabase
          .from("orders")
          .update({ sla_breached_at: null, sla_breach_status: null })
          .eq("id", o.id);
      }
    }

    return new Response(
      JSON.stringify({ checked: all.length, breached: newBreaches }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-order-sla error", err);
    return new Response(
      JSON.stringify({ error: String((err as Error)?.message ?? err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
