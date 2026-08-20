# Plano: Setor de Encomendas Especiais

## Resumo
Criar um módulo de encomendas independente do estoque atual. Clientes logados podem solicitar produtos sem estoque (bonecos, cartas raras, peças importadas) com dois modelos: preço fixo ou cotação manual. O fluxo admin aprova, cota, recebe pagamento e gera etiqueta de envio usando a infraestrutura já existente (pagamento, SuperFrete, notificações, emails).

## Escopo aprovado
- Tipos de produto: bonecos/action figures e cartas/singles.
- Modelos de preço: preço fixo e cotação manual (ambos).
- Pagamento: só após aprovação da cotação para produtos sem preço fixo; produtos fixos seguem checkout normal.
- Visibilidade: produtos fixos podem aparecer no catálogo; produtos sem preço fixo apenas na área logada.
- Sem interferência no estoque, pedidos padrão e catálogo existente.

## Etapas de implementação

### 1. Database schema
- Criar tabela `special_order_products`: catálogo de produtos de encomenda com preço fixo (separado de `inventory`).
- Criar tabela `special_orders`: pedido de encomenda do cliente com status, tipo, dados de envio, pagamento e etiqueta.
- Criar tabela `special_order_items`: itens de cada encomenda (produto fixo ou descrição livre).
- Criar tabela `special_order_quotes`: cotações enviadas pelo admin para itens sem preço fixo.
- Criar tabela `special_order_status_history`: histórico de status (auditoria).
- Criar tabela `special_order_audit_log`: auditoria de ações admin.
- Criar enum `special_order_status`: requested, quoted, approved, paid, ordered, received, shipped, delivered, cancelled.
- Criar enum `special_order_item_type`: fixed_price, quotation.
- GRANT e RLS policies para cada nova tabela.
- Triggers para `updated_at` e histórico de status.

### 2. Backend
- Edge Function `create-special-order`: cria encomenda a partir da solicitação do cliente.
- Edge Function `special-order-quote`: admin envia cotação (validação de permissão).
- Edge Function `special-order-approve`: cliente aprova cotação.
- Edge Function `process-special-order-payment`: gera pagamento (reaproveita InfinitePay/SuperFrete checkout).
- Edge Function `special-order-status-update`: admin atualiza status, com geração automática de etiqueta SuperFrete quando o item chega.
- Edge Function `notify-special-order`: emails transacionais para cliente e admin.
- Trigger DB para notificar admin quando nova encomenda for criada.
- Trigger DB para criar `special_order_status_history` a cada mudança.

### 3. Admin UI
- Nova página `/admin/encomendas`: lista todas as encomendas com filtros por status e tipo.
- Página `/admin/encomendas/:id`: detalhes, cotação, aprovação, status, pagamento, etiqueta e histórico.
- Página `/admin/produtos-encomenda`: CRUD de produtos de encomenda com preço fixo.
- Notificações admin para novas encomendas.
- Botões de ação: enviar cotação, aprovar, marcar como pago, gerar etiqueta, reverter etiqueta, cancelar.

### 4. Customer UI
- Nova página `/conta/encomendas`: lista encomendas do cliente.
- Página `/conta/encomendas/:id`: detalhes, cotações pendentes de aprovação, histórico.
- Formulário de solicitação de encomenda em `/conta/encomendas/nova`.
- Integração com o catálogo para produtos fixos (botão "Encomendar" quando não houver estoque).

### 5. Integrações
- Reutilizar pagamento existente (InfinitePay, PIX, cartão).
- Reutilizar SuperFrete para etiquetas.
- Reutilizar sistema de notificações e emails transacionais.
- Reutilizar sistema de créditos da loja (opcional, se desejado).

### 6. Segurança
- RLS policies: cliente vê apenas suas encomendas; admin vê todas.
- Validação de permissão admin em todas as Edge Functions.
- Proteção contra injeção e path traversal em uploads de fotos de referência.
- Auditoria de ações admin.

### 7. Testes
- Testes de integração para criação, cotação, aprovação e pagamento.
- Testes de controle de acesso (cliente não acessa encomendas de outros).
- Testes de notificações e histórico de status.

## Fora do escopo inicial
- Integração com fornecedores externos.
- Estoque de produtos de encomenda.
- Recompra automática.
- Marketplace de encomendas entre usuários.

## Notas técnicas
- Não criar foreign keys para `auth.users` (conforme regras do projeto); usar `user_id` sem FK ou referenciar `profiles`.
- Todos os `CREATE TABLE` devem incluir `GRANT`, `ENABLE ROW LEVEL SECURITY` e `CREATE POLICY` na mesma migration.
- Usar o mesmo padrão de nomenclatura e design do restante do projeto.
