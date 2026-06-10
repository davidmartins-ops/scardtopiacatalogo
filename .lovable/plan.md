# Fase 3 — Operação: Reconciliação, Reembolso e NFe

Plano em três frentes independentes, entregues em sequência para validar cada uma antes da próxima. Cada frente tem schema, UI admin e (quando necessário) Edge Function.

---

## Frente 1 — Reconciliação Financeira

Objetivo: cruzar pagamentos recebidos (PIX comprovante, cartão futuro) com pedidos, identificar divergências e fechar caixa por dia.

### Banco
- Nova tabela `public.payment_reconciliation`:
  - `id uuid pk`, `order_id uuid fk orders`, `expected_amount numeric`, `received_amount numeric`, `method text` (`pix|credit|other`), `received_at timestamptz`, `bank_reference text`, `status text` (`matched|divergent|unmatched|manual`), `notes text`, `reconciled_by uuid`, `reconciled_at timestamptz`, `created_at`.
  - GRANTs + RLS: admin lê/escreve via `is_admin()`; `service_role` total.
- Nova tabela `public.cash_closures` (fechamento diário):
  - `id`, `closure_date date unique`, `total_orders int`, `total_expected numeric`, `total_received numeric`, `divergence numeric`, `closed_by uuid`, `closed_at`, `notes`.
- View `v_daily_reconciliation` agregando `orders` + `payment_reconciliation` por dia.

### UI Admin (`/admin/reconciliacao`)
- Tabela diária com filtro por período e status.
- Para cada pedido pago: cartões "Esperado vs Recebido", botão **Marcar como conciliado** / **Marcar divergência** com campo de nota.
- Importação opcional de extrato CSV (banco/PIX) → faz match automático por valor+data (±2 dias, tolerância R$0,05).
- Botão **Fechar caixa do dia** gera `cash_closures` e bloqueia edição retroativa.

### Notificações
- Trigger: criar `admin_notifications` tipo `reconciliation_divergence` quando `status='divergent'`.

---

## Frente 2 — Reembolso (Refund)

Objetivo: fluxo formal de estorno ligado a disputas (`order_disputes` já existe) com registro contábil e reposição de estoque.

### Banco
- Nova tabela `public.order_refunds`:
  - `id`, `order_id fk`, `dispute_id fk order_disputes nullable`, `amount numeric`, `reason text`, `method text` (`pix|reverse_credit|store_credit`), `status text` (`pending|approved|processed|rejected`), `pix_key text nullable`, `proof_url text` (comprovante de estorno), `requested_by uuid`, `approved_by uuid`, `processed_at timestamptz`, `notes`, `created_at`.
  - GRANTs + RLS: cliente lê seus próprios; admin total.
- Função `restock_refunded_items(refund_id)`: ao aprovar, repõe `inventory.quantity` dos itens do pedido e grava `inventory_audit` com `source='refund'`.
- Trigger: ao `status='processed'`, atualizar `orders.status='cancelled'` (se reembolso total) e disparar notificação ao cliente.

### UI Admin
- Aba **Reembolsos** dentro de `OrderDetail` admin (e listagem geral em `/admin/reembolsos`).
- Fluxo: Solicitar → Aprovar (define método, valor, PIX) → Processar (upload do comprovante via bucket `receipts`) → Concluído.
- Checkbox "Repor estoque" no momento da aprovação.

### UI Cliente
- Em `/conta/pedidos/:id`, botão **Solicitar reembolso** (cria refund pendente vinculado a uma disputa).
- Status do reembolso visível com timeline.

### Email
- Template app email `refund-status-update.tsx` (solicitado / aprovado / processado / rejeitado), via `send-transactional-email`.

---

## Frente 3 — NFe Modelo 55

Objetivo: emitir NFe de produto para cada pedido entregue, com armazenamento de DANFE/XML e reenvio ao cliente.

### Decisão de provedor
- Como cliente ainda não escolheu, recomendaremos **Focus NFe** (REST simples, sandbox grátis, suporta NFe 55) e estruturaremos o código com camada de adapter (`nfe-provider.ts`) trocável.
- Secret necessário: `FOCUS_NFE_TOKEN` (sandbox primeiro), `FOCUS_NFE_CNPJ_EMITENTE`. Pediremos via `add_secret` apenas quando frente 3 começar.

### Dados do emitente (configuração única)
- Nova tabela `public.tax_settings` (singleton, `id=1`):
  - `cnpj`, `razao_social`, `nome_fantasia`, `ie`, `crt` (regime), `cep`, `logradouro`, `numero`, `bairro`, `municipio`, `uf`, `ambiente` (`homologacao|producao`), `serie`, `proxima_numeracao`, `cfop_padrao`, `ncm_padrao`, `csosn_padrao`.
- UI em `/admin/configuracoes/fiscal`.

### Schema NFe
- Nova tabela `public.invoices`:
  - `id`, `order_id fk unique`, `provider text` (`focus_nfe`), `provider_ref text` (chave NFe), `numero int`, `serie int`, `status text` (`draft|processing|authorized|rejected|cancelled`), `xml_url text`, `danfe_url text`, `protocolo text`, `rejection_reason text`, `emitted_at`, `cancelled_at`, `created_by uuid`, `created_at`.
  - RLS: cliente lê NFe do próprio pedido; admin total.
- Adicionar `customer_info` em `orders` deve conter CPF/CNPJ; criar migração para garantir campo `tax_id` nos dados do cliente no checkout (campo opcional no formulário, obrigatório se "Quero NF").

### Edge Functions
- `emit-nfe` (verify_jwt=true, admin only): monta payload a partir de `orders` + `inventory.ncm` + `tax_settings`, chama Focus NFe, salva em `invoices` com status `processing`.
- `nfe-webhook` (verify_jwt=false): recebe callback do provedor com autorização/rejeição, atualiza `invoices`, baixa XML/DANFE para storage bucket novo `invoices` (privado), notifica admin e dispara email ao cliente.
- `cancel-nfe`: cancelamento dentro de 24h com justificativa.

### Storage
- Novo bucket privado `invoices` para XML e PDF DANFE; políticas: admin read/write, cliente read apenas do próprio pedido.

### Inventário
- Adicionar colunas em `inventory`: `ncm text`, `cest text`, `origem int default 0`, `unidade text default 'UN'`. Form admin ganha esses campos (opcionais, com default por categoria).

### UI Admin
- Em `OrderDetail` admin: botão **Emitir NFe** (habilitado quando status ≥ `payment_confirmed`), mostra status, links DANFE/XML, botão **Cancelar NFe**.
- Listagem `/admin/notas` com filtros por status/período e re-download.

### UI Cliente
- Em `/conta/pedidos/:id`: bloco "Nota Fiscal" com botão Baixar DANFE / XML quando autorizada.

### Email
- Template `invoice-issued.tsx` enviado automaticamente ao cliente com link da DANFE.

---

## Ordem de entrega sugerida

```text
Sprint A (esta semana)  → Frente 1: Reconciliação (sem dependências externas)
Sprint B (próxima)      → Frente 2: Reembolso (depende só de UI + estoque)
Sprint C (3ª semana)    → Frente 3: NFe (requer escolha de provedor + cadastro fiscal completo)
```

Antes de iniciar a Sprint C eu vou precisar:
1. Confirmar provedor NFe (sugiro Focus NFe sandbox para começar sem custo).
2. CNPJ, IE, regime tributário e certificado/credenciais do emitente.
3. NCM padrão para cartas colecionáveis (geralmente 4911.99.00) e CFOPs de venda interestadual/intraestadual.

## Detalhes técnicos resumidos

- Todas as novas tabelas seguem o padrão do projeto: `GRANT` → `ENABLE RLS` → `CREATE POLICY` com `is_admin()`.
- Edge Functions usam `corsHeaders` local conforme memory `tech/edge-functions-cors`.
- Emails reutilizam a infra de transactional já configurada (`send-transactional-email`).
- Notificações usam o sistema genérico `admin_notifications` já existente.
- Nenhum código atual de checkout/WhatsApp/PIX é alterado nesta fase — apenas adicionamos camadas pós-venda.

## Próximo passo

Aprovando este plano, começo pela **Sprint A (Reconciliação)** já no próximo turno: migração + página `/admin/reconciliacao` + importador CSV.