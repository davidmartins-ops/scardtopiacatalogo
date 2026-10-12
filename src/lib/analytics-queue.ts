import { supabase } from "@/integrations/supabase/client";

/** Analytics events are buffered and sent as one batch instead of one request each. */
export interface AnalyticsEvent {
  event_type: string;
  inventory_item_id?: string | null;
  item_name?: string | null;
  category?: string | null;
  session_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

const FLUSH_MS = 5000;
const MAX_BATCH = 25;
let queue: Required<AnalyticsEvent>[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

const flush = () => {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length) return;
  const rows = queue;
  queue = [];
  // Same keys on every row so the batch is a single insert.
  void supabase.from("analytics_events").insert(rows as never).then(() => {}, () => {});
};

export const queueAnalyticsEvent = (e: AnalyticsEvent) => {
  queue.push({
    event_type: e.event_type,
    inventory_item_id: e.inventory_item_id ?? null,
    item_name: e.item_name ?? null,
    category: e.category ?? null,
    session_id: e.session_id ?? null,
    metadata: e.metadata ?? null,
  });
  if (queue.length >= MAX_BATCH) flush();
  else if (!timer) timer = setTimeout(flush, FLUSH_MS);
};

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
}
