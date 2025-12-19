🍔 Burguer.IA — Plataforma SaaS de Gestão para Food Service

Burguer.IA é uma plataforma SaaS moderna e inteligente, desenvolvida para hamburguerias, lanchonetes, pizzarias e pequenos estabelecimentos de alimentação, com foco em organização, controle financeiro, automação e tomada de decisão baseada em dados.

O sistema foi projetado para resolver problemas reais do dia a dia do pequeno empreendedor, indo além de um PDV tradicional, incorporando gestão de custos, estoque inteligente, relatórios estratégicos e recursos de Inteligência Artificial.

🚀 Visão Geral

O Burguer.IA centraliza toda a operação do estabelecimento em um único sistema:

Pedidos e PDV

Gestão de produtos e ingredientes

Controle automático de estoque

Precificação baseada em custo real

Relatórios e indicadores de desempenho

Assistente inteligente para apoio ao negócio

Estrutura multi-tenant (várias empresas no mesmo sistema, com isolamento total de dados)

Tudo acessível via navegador, sem necessidade de instalação.

🎯 Público-alvo

Hamburguerias

Lanchonetes

Pizzarias

Food trucks

Pequenos restaurantes

Empreendedores que querem sair do “caderno e planilha” e profissionalizar a gestão

🧠 Diferenciais

Cálculo de custo real por produto, baseado em ingredientes

Estoque automático (baixa de ingredientes a cada venda)

Alertas de estoque baixo

Insights de negócio (horários fracos/fortes, produtos mais lucrativos)

Assistente de IA para análise de vendas e sugestões estratégicas

Arquitetura preparada para automações via WhatsApp

Sistema multi-tenant seguro, com isolamento total entre clientes

🧱 Arquitetura e Tecnologias

O projeto utiliza um stack moderno, escalável e seguro:

Frontend

React

TypeScript

Vite

Tailwind CSS

shadcn/ui

Backend

Supabase

PostgreSQL

Row Level Security (RLS)

Edge Functions

Auth

Infraestrutura

Vercel (deploy e rotas backend)

Mercado Pago (cobrança e pagamentos)

OpenAI API (recursos de Inteligência Artificial)

Integração com APIs de WhatsApp (em evolução)

🏗️ Estrutura do Projeto
├── src/
│   ├── components/        # Componentes reutilizáveis
│   ├── pages/             # Páginas do sistema
│   ├── hooks/             # Hooks customizados
│   ├── services/          # Integrações (API, billing, IA)
│   ├── utils/             # Funções utilitárias
│   └── styles/            # Estilos globais
│
├── supabase/
│   ├── migrations/        # Migrations do banco
│   └── functions/         # Edge Functions
│
├── public/                # Assets estáticos
└── README.md

🔐 Segurança

Autenticação via Supabase Auth

Isolamento total de dados por tenant (RLS)

Tokens e chaves protegidos por variáveis de ambiente

Nenhuma credencial sensível exposta no frontend

Webhooks validados e idempotentes

💳 Cobrança e Planos

O sistema possui níveis de assinatura, com cobrança mensal via Mercado Pago:

Planos com valores diferentes por nível

Geração automática de cobrança mensal

Alertas de pagamento no painel

Baixa automática após confirmação de pagamento

Estrutura preparada para recorrência, multas e juros

📈 Status do Projeto

🚧 Em desenvolvimento ativo
O projeto está em constante evolução, com novas funcionalidades sendo adicionadas de forma incremental, priorizando estabilidade, usabilidade e retorno real para os clientes.

🧑‍💻 Autor e Responsável Técnico

Fellipe Teixeira
Criador e desenvolvedor do Burguer.IA

LinkedIn: https://www.linkedin.com/in/feateixeira

GitHub: https://github.com/feateixeira

📄 Licença e Uso

Este repositório contém código proprietário.

❌ Não é um projeto open-source
❌ Não é autorizado copiar, redistribuir ou comercializar este sistema
✅ Uso exclusivo do autor e de clientes licenciados

Todos os direitos reservados.