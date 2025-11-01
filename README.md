# Sistema de Gestão para Hamburgueria - SaaS

Sistema completo de gestão para hamburguerias, incluindo PDV, gestão de pedidos, produtos, clientes e muito mais.

## 🚀 Tecnologias

- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **UI**: Tailwind CSS + shadcn/ui
- **Deploy**: Vercel

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou bun
- Conta no Supabase

## 🛠️ Instalação

```bash
# Clone o repositório
git clone <seu-repo-url>

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais do Supabase
```

## 🔧 Configuração

1. Crie um projeto no Supabase
2. Configure as variáveis de ambiente no arquivo `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Execute as migrations do Supabase:
   ```bash
   supabase db reset
   ```
4. Faça deploy das Edge Functions:
   ```bash
   supabase functions deploy create-user
   supabase functions deploy delete-user
   supabase functions deploy online-order-intake
   # ... outras functions
   ```

## 📦 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview
```

## 📁 Estrutura do Projeto

```
├── src/
│   ├── pages/          # Páginas principais
│   ├── components/     # Componentes reutilizáveis
│   ├── hooks/          # Custom hooks
│   ├── utils/          # Funções utilitárias
│   └── integrations/   # Integrações (Supabase)
├── supabase/
│   ├── functions/      # Edge Functions
│   └── migrations/     # Migrations do banco
└── public/             # Arquivos estáticos
```

## 🔒 Segurança

- Nunca commite arquivos `.env` ou secrets
- Use variáveis de ambiente para todas as credenciais
- Mantenha o `SERVICE_ROLE_KEY` apenas nas variáveis de ambiente do Supabase

## 📝 Licença

Fellipe Teixeira (@feteixeiraz) Proprietário - Todos os direitos reservados
