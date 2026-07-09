# Royal Joias

Painel executivo proprietário — gestão de pedidos, clientes, financeiro e operações.

**Developed by Laugh Company**

## Stack

- TanStack Start (React 19, Vite 7)
- Tailwind CSS v4
- Supabase (auth, database, storage)
- TanStack Query
- Framer Motion, Recharts

## Scripts

```bash
bun install
bun run dev        # dev server
bun run build      # production build
bun run preview    # serve build
bun run lint
```

## Estrutura

- `src/routes/` — rotas file-based (TanStack Router)
- `src/components/` — componentes de UI reutilizáveis
- `src/features/` — módulos por domínio (auth, pedidos, etc.)
- `src/lib/` — utilitários e server functions
- `src/integrations/supabase/` — client do backend

## Deploy

Guia completo em [`DEPLOYMENT.md`](./DEPLOYMENT.md) — cobre Vercel (alvo
principal), Netlify, Node/VPS e Docker, além da migração de banco Supabase
próprio a partir das migrações em `supabase/migrations/`.

Variáveis de ambiente necessárias estão documentadas em
[`.env.example`](./.env.example).

---

© Laugh. Todos os direitos reservados.
