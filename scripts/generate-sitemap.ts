// Runs before `vite build` (prebuild hook); writes public/sitemap.xml.
// Fetches drops from Supabase via the public REST endpoint so dynamic
// /catalogo/drop/:dropId routes appear in the sitemap.
//
// Admin routes (/admin, /admin/*, /admin/login, /admin/relatorios,
// /admin/notificacoes) are intentionally excluded — they're disallowed
// in robots.txt and require authentication.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://www.spencerscardtopia.com.br";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://uonzprmsnctldppgrcxo.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvbnpwcm1zbmN0bGRwcGdyY3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMzgyMjksImV4cCI6MjA4OTgxNDIyOX0.wbi-9vUuYofONi3AJmIzMFZJsUM5sDaUEzbUfp73o4Y";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/catalogo", changefreq: "daily", priority: "0.9" },
  { path: "/tendencias", changefreq: "daily", priority: "0.7" },
  { path: "/sobre", changefreq: "monthly", priority: "0.6" },
  { path: "/faq", changefreq: "monthly", priority: "0.6" },
  { path: "/conta/login", changefreq: "monthly", priority: "0.5" },
  { path: "/login", changefreq: "monthly", priority: "0.5" },
  { path: "/conta", changefreq: "weekly", priority: "0.5" },
  { path: "/reset-password", changefreq: "monthly", priority: "0.3" },
  { path: "/termos", changefreq: "monthly", priority: "0.4" },
  { path: "/privacidade", changefreq: "monthly", priority: "0.4" },
];

async function fetchDropIds(): Promise<string[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/inventory?select=id,product_type&product_type=eq.drop`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!res.ok) {
      console.warn(`[sitemap] Could not fetch drops (${res.status}); continuing without dynamic entries.`);
      return [];
    }
    const rows = (await res.json()) as Array<{ id: string }>;
    return rows.map((r) => r.id);
  } catch (err) {
    console.warn("[sitemap] Drop fetch failed:", err);
    return [];
  }
}

function renderXml(entries: SitemapEntry[]): string {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n")
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

async function main() {
  const dropIds = await fetchDropIds();
  const dropEntries: SitemapEntry[] = dropIds.map((id) => ({
    path: `/catalogo/drop/${encodeURIComponent(id)}`,
    changefreq: "weekly",
    priority: "0.7",
  }));

  const all = [...staticEntries, ...dropEntries];
  writeFileSync(resolve("public/sitemap.xml"), renderXml(all));
  console.log(
    `[sitemap] Wrote public/sitemap.xml — ${staticEntries.length} static + ${dropEntries.length} drops = ${all.length} URLs`
  );
}

main().catch((err) => {
  console.error("[sitemap] Failed:", err);
  process.exit(0); // Don't block builds on sitemap failure
});
