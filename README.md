# Meu Dinheiro Feliz

Faça um site de um app de gestão financeira

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://finovafin.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/79b59330-c835-4236-8c89-84831305e336).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Configuração do Supabase

O app usa Supabase para banco de dados e autenticação (email + senha). Os dados
ficam no projeto Supabase na nuvem — nada é armazenado localmente.

### 1. Criar o schema

No painel do Supabase, abra **SQL Editor**, cole o conteúdo de
[`supabase/schema.sql`](supabase/schema.sql) e execute. Isso cria:

- `accounts` — contas e carteiras, com saldo inicial
- `categories` — categorias de receita e despesa
- `transactions` — lançamentos, incluindo transferências entre contas
- `profiles` — nome do usuário
- `account_balances` — view que calcula o saldo atual de cada conta
- Políticas de **RLS** em todas as tabelas: cada pessoa só acessa os próprios dados
- Um trigger que, a cada cadastro, cria o perfil, uma carteira e 12 categorias

O arquivo é idempotente — pode rodar de novo sem quebrar.

### 2. Apontar o app para o projeto

Copie `.env.example` para `.env` e preencha com os valores de
**Project Settings > API**:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

A `anon key` é pública por design — quem protege os dados é o RLS. Nunca use a
`service_role` key aqui.

### 3. Confirmação de email (opcional)

Por padrão o Supabase exige confirmação de email no cadastro. Para testar sem
caixa de entrada, desligue em **Authentication > Providers > Email >
Confirm email**. Com a opção ligada, o app avisa que o link foi enviado.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `src/routes/index.tsx` | Landing page pública |
| `src/routes/login.tsx` | Entrar e criar conta |
| `src/routes/_authed.tsx` | Layout protegido — redireciona para `/login` sem sessão |
| `src/routes/_authed/dashboard.tsx` | Saldos, gráficos e últimos lançamentos |
| `src/routes/_authed/transacoes.tsx` | Lista, filtros e formulário de lançamento |
| `src/routes/_authed/contas.tsx` | CRUD de contas e carteiras |
| `src/routes/_authed/categorias.tsx` | CRUD de categorias |
| `src/lib/auth.ts` | Server functions de autenticação |
| `src/lib/supabase/` | Clientes (browser e servidor) e tipos do banco |
| `src/lib/queries/` | Queries e mutations com TanStack Query |
