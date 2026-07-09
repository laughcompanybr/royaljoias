# Módulo de Estoque e Produtos

## 1. Banco de dados (nova migração)

**Tabela `products`**
- `name`, `sku` (opcional, único por empresa quando preenchido), `category`, `description`
- `cost_price` (numeric), `sale_price` (numeric)
- `stock_qty` (int), `min_stock` (int)
- `status` (`'active' | 'inactive' | 'archived'`)
- `image_url` (opcional, bucket novo `product-images` privado)
- `company_id`, `created_by`, timestamps, soft-delete (`deleted_at`)
- Índices: `(company_id, status)`, `(company_id, name)`, `(company_id, sku)`

**Tabela `product_movements`** (histórico/auditoria)
- `product_id`, `type` (`'in' | 'out' | 'adjust' | 'sale' | 'sale_revert'`)
- `qty` (positivo = entrada, negativo = saída)
- `qty_after` (snapshot do saldo)
- `reason`, `order_id` (nullable), `actor`, `created_at`
- Índice por `product_id, created_at desc`

**Tabela `order_items`** (linhas do pedido)
- `order_id`, `product_id` (nullable — permite item avulso), `name_snapshot`, `sku_snapshot`
- `quantity`, `unit_sale_price`, `unit_cost_price`
- Timestamps

**Grants + RLS**: mesmas convenções das outras tabelas (`is_company_staff` para leitura/escrita, `service_role` full). Movimentos só podem ser criados via triggers/RPC — política restritiva para insert direto.

**Funções/triggers Postgres**
- `apply_order_items_stock(order_id, direction)` — RPC SECURITY DEFINER que, dentro de transação:
  1. Percorre `order_items` do pedido
  2. Se `direction = 'out'`: `UPDATE products SET stock_qty = stock_qty - qty` com `WHERE stock_qty >= qty` (retorna erro se qualquer linha falhar → transação inteira revertida)
  3. Insere `product_movements` correspondentes com `type='sale'` ou `'sale_revert'`
- Trigger em `orders`: quando `status` muda para `entregue` (ou `pago`, conforme regra atual) chama direção `out`; se voltar a status anterior, chama `sale_revert`.

**Configuração** em `app_settings`: `stock_block_when_insufficient` (bool) — bloqueia vs. só avisa.

## 2. Server functions (`src/features/products/products.functions.ts`)

- `listProducts({ search, category, status, availability, page, pageSize })`
- `getProduct(id)` — inclui últimas 50 movimentações
- `createProduct`, `updateProduct`, `archiveProduct`, `deleteProduct` (soft)
- `adjustStock({ productId, qty, reason, type: 'in'|'out'|'adjust' })` — insere movement + atualiza saldo (transação)
- `listProductMovements({ productId, page })`
- `listCategories()` — distinct
- `uploadProductImage` — usa bucket novo

Todas com `requireSupabaseAuth` + verificação de role staff/admin.

## 3. UI — rota `/produtos` (dentro de `_authenticated`)

Padrão idêntico às outras (Clientes/Fornecedores):
- `PageHeader` + botão "Novo produto" (FAB no mobile)
- Filtros: busca, categoria, status, disponibilidade (todos/em estoque/baixo/zerado), incluir arquivados
- Tabela desktop + cards mobile: nome, SKU, categoria, preço venda, estoque (badge âmbar se ≤ mínimo, vermelho se 0), status
- Drawer/Sheet de detalhes com abas: **Dados**, **Movimentações** (paginado com "Carregar mais"), **Ajustar estoque** (form entrada/saída/ajuste)
- `ProductForm` com upload de imagem (reaproveita padrão do `ReceiptField`)

Adicionar item no `nav-config.ts` (ícone `Package`).

## 4. Integração com Pedidos

**OrderForm** — nova seção "Itens do pedido":
- Combobox `ProductPicker` (busca server-side por nome/SKU) — mostra estoque disponível
- Ao selecionar: adiciona linha com nome/valores pré-preenchidos; usuário edita só `quantity`
- Mantém possibilidade de "item avulso" (produto=null, digita nome/valores) para não quebrar pedidos atuais
- `sale_price` do pedido = soma dos itens (readonly quando há itens); `cost_price` idem
- Valida estoque na hora: se `quantity > stock_qty` e `stock_block_when_insufficient=true` → bloqueia submit com toast; se false → só avisa

**OrderDetailSheet**: lista dos itens do pedido; ao mudar status para "entregue" a RPC de estoque roda automaticamente (trigger). Ao reverter, devolve estoque.

**Pedidos legados** (sem itens): continuam funcionando — trigger só age quando há `order_items`.

## 5. Alertas no Dashboard

Novo `StatCard` "Estoque baixo" mostrando contagem de produtos com `stock_qty <= min_stock AND status='active'`, linkando para `/produtos?availability=low`.

Adicionar seção "Alertas de estoque" listando os 5 produtos mais críticos (opcional, condicional a existir algum).

## 6. Testes

- Unit: cálculos de saldo pós-movimento, validação de estoque insuficiente
- Integração: RPC `apply_order_items_stock` — cenários de sucesso, insuficiência (rollback), reversão
- E2E: criar produto → criar pedido com esse produto → mudar para entregue → verificar `stock_qty` decrementado e movimento registrado

## Detalhes técnicos

- Bucket `product-images` (privado), RLS: staff da empresa lê/escreve pasta `{company_id}/…`
- Preços com `numeric(12,2)`; quantidades `integer` (assume unidades inteiras — se precisar frações, mudar para `numeric(12,3)` — pergunto se necessário)
- Categorias como texto livre + sugestões de distinct (mais simples que tabela separada)
- Reaproveita `formatBRL`, `EmptyState`, `PageHeader`, componentes shadcn já existentes — mantém identidade visual atual

## Ordem de execução

1. Migração (tabelas, grants, RLS, RPC, trigger, bucket)
2. Server functions + schemas Zod
3. Rota `/produtos` + form + detalhes + movimentações + ajuste de estoque
4. Nav + StatCard no dashboard
5. Integração no `OrderForm` e `OrderDetailSheet`
6. Testes unit/integração/E2E

## Dúvidas antes de começar

1. **Quantidades fracionadas** (ex.: 0,5 kg) ou só inteiras? Assumindo inteiras.
2. **Baixa de estoque acontece em qual status?** Sugiro `entregue`. Alternativa: `pago`, ou já no momento de criar o pedido (reserva).
3. **Multi-empresa**: filtrar sempre por `company_id` (mesmo padrão de clientes/fornecedores). Confirmo?

Se preferir, sigo com os defaults sugeridos (inteiros, baixa em "entregue", scope por empresa).
