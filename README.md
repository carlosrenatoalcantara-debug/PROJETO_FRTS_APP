# Forte Solar — Sistema de Gestão

Sistema de gestão de projetos fotovoltaicos (FV) e elétrico-veicular (EV).

## Estrutura

```
PROJETO_FRTS_APP/
├── frontend/          # React + Vite + Tailwind CSS
└── backend/           # Node.js + Express
```

## Como rodar

### Frontend
```bash
cd frontend
npm install
npm run dev
# Abre em http://localhost:3000
```

### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
# Roda em http://localhost:5000
```

## Rotas da aplicação

| Rota             | Descrição                     |
|------------------|-------------------------------|
| /dashboard       | Visão geral com KPIs          |
| /clientes        | Cadastro de clientes          |
| /projetos-fv     | Projetos fotovoltaicos        |
| /projetos-ev     | Projetos elétrico-veicular    |
| /configuracoes   | Configurações do sistema      |

## API Endpoints

| Método | Endpoint              | Descrição               |
|--------|-----------------------|-------------------------|
| GET    | /api/health           | Status da API           |
| GET    | /api/dashboard/resumo | KPIs do dashboard       |
| CRUD   | /api/clientes         | Gestão de clientes      |
| CRUD   | /api/projetos-fv      | Projetos fotovoltaicos  |
| CRUD   | /api/projetos-ev      | Projetos EV             |
