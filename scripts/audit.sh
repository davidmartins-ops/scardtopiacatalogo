#!/usr/bin/env bash
# Spencer's Cardtopia — Auditoria Fase 0
# Uso: bash scripts/audit.sh [URL]
# Requer: lighthouse, @axe-core/cli, curl
#   npm i -g lighthouse @axe-core/cli

set -euo pipefail

URL="${1:-https://www.spencerscardtopia.com.br/login}"
OUT_DIR="audits"
SLUG="$(echo "$URL" | sed -E 's#https?://##; s#[^a-zA-Z0-9]+#-#g; s#-$##')"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUT_DIR"

echo "▶ Auditando: $URL"
echo "▶ Saída: $OUT_DIR/"

# 1. Headers HTTP
echo "→ Coletando cabeçalhos HTTP..."
curl -sI "$URL" > "$OUT_DIR/headers-$SLUG-$TS.txt" || true

# 2. Lighthouse (mobile + desktop)
if command -v lighthouse >/dev/null 2>&1; then
  echo "→ Lighthouse (mobile)..."
  lighthouse "$URL" \
    --quiet --chrome-flags="--headless --no-sandbox" \
    --preset=perf --form-factor=mobile \
    --output=json --output=html \
    --output-path="$OUT_DIR/lighthouse-mobile-$SLUG-$TS" || true

  echo "→ Lighthouse (desktop)..."
  lighthouse "$URL" \
    --quiet --chrome-flags="--headless --no-sandbox" \
    --preset=desktop \
    --output=json --output=html \
    --output-path="$OUT_DIR/lighthouse-desktop-$SLUG-$TS" || true
else
  echo "⚠ lighthouse não instalado — pule com: npm i -g lighthouse"
fi

# 3. axe-core (acessibilidade)
if command -v axe >/dev/null 2>&1; then
  echo "→ axe-core..."
  axe "$URL" --save "$OUT_DIR/axe-$SLUG-$TS.json" || true
else
  echo "⚠ @axe-core/cli não instalado — pule com: npm i -g @axe-core/cli"
fi

echo "✔ Concluído. Veja relatórios em $OUT_DIR/"
