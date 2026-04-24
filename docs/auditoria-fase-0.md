# Auditoria — Fase 0 (Pré-requisitos e Checagens)

Spencer's Cardtopia — checklist inicial de auditoria antes de aplicar correções das fases seguintes (LGPD, segurança, acessibilidade, SEO e performance).

URLs de produção:
- https://www.spencerscardtopia.com.br
- https://spencerscardtopia.com.br
- https://scardtopiacatalogo.lovable.app

---

## 1. Segurança / Transporte

- [ ] HTTPS válido e redirecionamento 301 de HTTP → HTTPS
- [ ] SSL Labs nota ≥ A (https://www.ssllabs.com/ssltest/analyze.html?d=spencerscardtopia.com.br)
- [ ] HSTS habilitado (`Strict-Transport-Security: max-age=63072000; includeSubDomains`)
- [ ] Cabeçalhos de segurança: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`
- [ ] Cookies de sessão Supabase com `Secure; HttpOnly; SameSite` (gerenciado pela Lovable Cloud)
- [ ] Sem segredos expostos no bundle (`grep -R "service_role" dist/`)

> Observação: HTTPS, HSTS, CDN e TLS são gerenciados pela infraestrutura da Lovable. Validar via SSL Labs e securityheaders.com.

## 2. LGPD / Conformidade

- [ ] Página `/privacidade` (Política de Privacidade em pt-BR)
- [ ] Página `/termos` (Termos de Uso)
- [ ] Banner de consentimento de cookies (aceitar/rejeitar não-essenciais)
- [ ] Registro/persistência do consentimento por usuário
- [ ] Link de revogação de consentimento no rodapé / dashboard

## 3. Backend / Banco de Dados (Lovable Cloud)

- [ ] Linter Supabase sem WARN/ERROR críticos (ver `audits/supabase-linter.json`)
- [ ] RLS habilitado em todas as tabelas públicas
- [ ] Policies revisadas manualmente (não confiar só no linter)
- [ ] Roles em tabela separada (`user_roles`) — ✅ já implementado
- [ ] Funções `SECURITY DEFINER` com `SET search_path = public` — ✅ `has_role`, `is_admin`

## 4. Acessibilidade (WCAG AA)

- [ ] axe-core sem violações críticas (`npx @axe-core/cli https://...`)
- [ ] WAVE sem erros (https://wave.webaim.org/)
- [ ] Contraste mínimo 4.5:1 (texto normal) / 3:1 (texto grande)
- [ ] Navegação 100% por teclado (Tab/Shift+Tab/Enter)
- [ ] `<label htmlFor>` em todos os inputs
- [ ] `alt` em todas as imagens não decorativas
- [ ] Foco visível (focus-visible ring) em botões/links/inputs

## 5. SEO técnico

- [ ] `<title>` único < 60 chars com keyword por página
- [ ] `meta description` < 160 chars por página
- [ ] H1 único por página
- [ ] `link rel="canonical"` em todas as rotas indexáveis
- [ ] `robots.txt` e `sitemap.xml` atualizados (✅ presentes em `/public`)
- [ ] Open Graph + Twitter Card por rota
- [ ] JSON-LD `Product` nas páginas de produto/drop
- [ ] `lang="pt-BR"` no `<html>` (atualmente `en` — ⚠️ corrigir)

## 6. Performance

- [ ] Lighthouse Performance ≥ 85 (mobile)
- [ ] LCP < 2.5s, CLS < 0.1, INP < 200ms
- [ ] Imagens com `loading="lazy"` e formatos modernos (WebP/AVIF)
- [ ] Bundle JS principal < 300 KB gzip
- [ ] Cache-Control configurado para assets (gerenciado pela CDN da Lovable)

---

## Comandos para gerar relatórios

Pré-requisitos locais:
```bash
npm i -g lighthouse @axe-core/cli
# Docker para OWASP ZAP (opcional)
docker pull ghcr.io/zaproxy/zaproxy:stable
```

### Auditoria automatizada

```bash
# Roda Lighthouse + axe contra produção e salva em ./audits/
bash scripts/audit.sh https://www.spencerscardtopia.com.br/login
```

### OWASP ZAP Baseline (opcional, fora da Lovable)

```bash
docker run --rm -v "$PWD/audits:/zap/wrk" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://www.spencerscardtopia.com.br/login \
  -J zap-baseline.json -r zap-baseline.html
```

### SSL Labs (manual)

Abrir: https://www.ssllabs.com/ssltest/analyze.html?d=spencerscardtopia.com.br

### Headers

```bash
curl -sI https://www.spencerscardtopia.com.br/ | tee audits/headers.txt
```

---

## Saídas esperadas (`/audits`)

- `lighthouse-login.json` / `.html`
- `lighthouse-catalogo.json` / `.html`
- `axe-login.json`
- `headers.txt`
- `supabase-linter.json` (gerado via Lovable; ver `audits/supabase-linter.md`)
- `zap-baseline.html` (opcional)

## Próximos passos

Após gerar os relatórios, registrar achados nesta tabela e priorizar para Fase 1 (Segurança/LGPD):

| ID | Categoria | Severidade | Descrição | Fase de correção |
|----|-----------|------------|-----------|------------------|
|    |           |            |           |                  |
