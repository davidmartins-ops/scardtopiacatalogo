#!/usr/bin/env node
/**
 * Audit: garante que o HTML servido (index.html) e a árvore React não duplicam
 * o JSON-LD de Organization. Como o app é SPA, validamos:
 *  1) O index.html final NÃO deve conter scripts ld+json com "Organization".
 *  2) Apenas o SiteFooter pode injetar Organization JSON-LD em runtime.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const distHtml = "dist/index.html";
let html = "";
try {
  html = readFileSync(distHtml, "utf8");
} catch {
  console.warn(`[audit-jsonld] ${distHtml} não encontrado — rode após o build.`);
  process.exit(0);
}

const orgInHtml = (html.match(/"@type"\s*:\s*"Organization"/g) || []).length;
if (orgInHtml > 0) {
  console.error(
    `[audit-jsonld] ❌ index.html contém ${orgInHtml} Organization JSON-LD — deve ser injetado apenas em runtime pelo SiteFooter.`,
  );
  process.exit(1);
}

// Procura no código-fonte por outras injeções de Organization JSON-LD além do SiteFooter
const allowed = new Set(["src/components/SiteFooter.tsx"]);
const offenders: string[] = [];

const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(entry)) {
      const txt = readFileSync(p, "utf8");
      if (txt.includes('"Organization"') && txt.includes("application/ld+json")) {
        if (!allowed.has(p.replace(/\\/g, "/"))) offenders.push(p);
      }
    }
  }
};
walk("src");

if (offenders.length) {
  console.error("[audit-jsonld] ❌ Organization JSON-LD injetado fora do SiteFooter:");
  offenders.forEach((f) => console.error("  -", f));
  process.exit(1);
}

console.log("[audit-jsonld] ✅ Organization JSON-LD único e centralizado no SiteFooter.");
