# Deploy — Royal Joias

Guia de deploy do projeto em ambiente próprio (Vercel), incluindo migração
do banco Supabase.

---

## 1. Preparar um projeto Supabase próprio

O código não depende de nenhuma infraestrutura proprietária: qualquer
projeto Supabase (Cloud ou self-hosted) funciona.

1. Crie o projeto em https://supabase.com/dashboard.
2. Anote em local seguro:
   - **Project URL** (`https://<ref>.supabase.co`)
   - **Project ref** (`<ref>`)
   - **anon / publishable key**
   - **service_role key** (segredo)
3. Aplique as migrações em ordem cronológica:

   ```bash
   # com a Supabase CLI (recomendado)
   supabase link --project-ref <ref>
   supabase db push
   ```

   Todas as migrações vivem em `supabase/migrations/*.sql` e são
   idempotentes (usam `CREATE TABLE IF NOT EXISTS`, `CREATE POLICY` únicas
   por nome etc.). Elas cobrem: schema completo, RLS, grants no schema
   `public`, funções `SECURITY DEFINER` (`has_role`, `is_staff_or_admin`)
   e buckets de storage.
4. **Storage buckets** — se a CLI não replicar automaticamente, crie
   manualmente em Storage:
   - `order-files` (privado)
   - `client-files` (privado)
5. **Auth** — em Authentication → Providers:
   - Habilite **Email/Password**.
   - (Opcional) Configure Google OAuth com o `redirect_uri`
     `https://<seu-domínio>/auth/callback`.
   - Em Authentication → URL Configuration, defina o **Site URL** como
     `https://<seu-domínio>` e adicione o mesmo host em
     **Redirect URLs**.

---

## 2. Variáveis de ambiente

Copie `.env.example` → `.env` para desenvolvimento local e configure
**as mesmas variáveis** no painel do host de produção.

| Variável                          | Escopo             | Descrição                                     |
| --------------------------------- | ------------------ | --------------------------------------------- |
| `SUPABASE_URL`                    | Server + Build     | URL do projeto Supabase                       |
| `SUPABASE_PUBLISHABLE_KEY`        | Server + Build     | Chave pública / anon                          |
| `SUPABASE_PROJECT_ID`             | Server + Build     | Ref do projeto                                |
| `VITE_SUPABASE_URL`               | Client (bundle)    | Espelho da URL para o browser                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY`   | Client (bundle)    | Espelho da chave pública                      |
| `VITE_SUPABASE_PROJECT_ID`        | Client (bundle)    | Espelho do ref                                |
| `SUPABASE_SERVICE_ROLE_KEY`       | **Server apenas**  | Bypass de RLS — nunca com prefixo `VITE_`     |
| `NODE_ENV`                        | Server             | `production` no deploy                        |

> ⚠️ Nenhuma chave privada pode ter prefixo `VITE_`. O Vite injeta essas
> variáveis no bundle client-side.

---

## 3. Deploy na Vercel

1. **Importar o repositório** em https://vercel.com/new.
2. **Framework preset**: deixe em "Other" (a detecção automática do
   TanStack Start via Nitro é usada).
3. **Install command**: `bun install --frozen-lockfile`
4. **Build command**: `bun run build`
5. **Output directory**: `.vercel/output` (o Nitro escreve nesse caminho
   quando detecta o ambiente Vercel e a Vercel serve daí automaticamente).
6. **Environment Variables**: cole todas as variáveis da seção 2 em
   Production (e Preview, se quiser previews funcionais).
7. **Node version**: 20 ou superior (Settings → General → Node.js Version).

O arquivo `vercel.json` na raiz do repositório já fixa install/build/output
e desliga comentários automáticos em PRs.

O Nitro detecta `VERCEL=1` no ambiente de build e emite automaticamente
o preset Vercel — não é preciso setar `NITRO_PRESET`.

---

## 4. Deploy em outros ambientes

O projeto não usa nenhuma API exclusiva da Vercel. Para outros hosts:

- **Netlify**: `NITRO_PRESET=netlify` no ambiente de build; publish
  directory `.netlify`.
- **Node self-hosted / VPS / Docker**: `NITRO_PRESET=node-server`; o
  output fica em `.output/server/index.mjs`; suba com
  `node .output/server/index.mjs` atrás de um reverse-proxy (nginx/caddy)
  com HTTPS.
- **Cloudflare Workers**: preset padrão do template; sem configuração.

Detalhes: https://nitro.build/deploy

---

## 5. Checklist pré-produção

- [ ] Migrações aplicadas (`supabase db push`) e `check:grants` verde.
- [ ] Buckets `order-files` e `client-files` criados como privados.
- [ ] Site URL e Redirect URLs configurados em Auth.
- [ ] Variáveis de ambiente completas na Vercel (Production **e** Preview).
- [ ] `bun run build` local roda sem erro (`postbuild` roda a varredura
      anti-branding no `dist`).
- [ ] `bun run test:e2e` verde localmente contra `bun run dev`.
- [ ] Domínio custom apontado (Settings → Domains) — Vercel emite o
      certificado automático.

---

## 6. Pós-deploy

- Verifique `/auth`, `/dashboard`, `/access-denied` e um upload em
  `/pedidos`.
- Confira logs em Vercel → Deployments → Logs para qualquer 500 SSR.
- Rode `bun run check:grants` no CI a cada push (workflow em
  `.github/workflows/ci.yml`).

Sistema desenvolvido por **Laugh**.
