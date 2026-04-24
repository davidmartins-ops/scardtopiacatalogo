# Auditoria Backend — Lovable Cloud (Supabase Linter)

Data: 2026-04-24
Comando: `supabase--linter` (Lovable Cloud)

## Resumo

- 🔴 ERROR críticos: **0**
- 🟡 WARN: **1**
- 🟢 INFO: **0**

## Achados

### WARN-001 — Public Bucket Allows Listing

**Categoria:** SECURITY
**Doc:** https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing

**Descrição:** Há um bucket de storage público com uma policy `SELECT` ampla em `storage.objects` que permite que qualquer cliente **liste** todos os arquivos do bucket (não apenas baixá-los pela URL).

**Buckets esperados no projeto:** `products`, `receipts`.

**Risco:**
- `products`: baixo (imagens já públicas).
- `receipts`: ⚠️ **alto** se o bucket for público — comprovantes PIX de clientes não devem ser listáveis.

**Ação recomendada (Fase 1):** Revisar policies de `storage.objects` para `receipts`:
- Tornar bucket privado ou
- Restringir `SELECT` a `auth.uid() = owner` + admin via `has_role(auth.uid(), 'admin')`.

## Cabeçalhos HTTP de produção (coletados)

```
strict-transport-security: max-age=31536000; includeSubDomains  ✅
referrer-policy: strict-origin-when-cross-origin                 ✅
x-content-type-options: nosniff                                  ✅
set-cookie: ...; HttpOnly; Secure; SameSite=Lax                  ✅
server: cloudflare                                               ✅ CDN ativa
```

**Faltando (recomendado para Fase 1):**
- `Content-Security-Policy`
- `Permissions-Policy`
- `X-Frame-Options` (ou `frame-ancestors` no CSP)

## Próximos passos

1. Tratar WARN-001 (revisar bucket `receipts`) → entra na Fase 1.
2. Rodar `bash scripts/audit.sh` para gerar Lighthouse + axe.
3. Rodar SSL Labs e securityheaders.com manualmente.
4. Consolidar achados na tabela de `docs/auditoria-fase-0.md`.
