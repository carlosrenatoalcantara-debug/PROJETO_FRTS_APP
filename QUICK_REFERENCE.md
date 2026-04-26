# 🚀 Quick Reference - Forte Solar CRM com MongoDB

## 📁 Estrutura de Arquivos Principais

```
backend/
├── src/
│   ├── config/
│   │   └── database.js              # Configuração MongoDB (usar MONGODB_URI do .env)
│   │
│   ├── models/
│   │   ├── CrmFunil.js              # Schema dos funis de vendas
│   │   ├── CrmColuna.js             # Schema das colunas/estágios
│   │   └── CrmLead.js               # Schema dos leads com endereços
│   │
│   ├── controllers/
│   │   ├── crmController.js         # Lógica do CRM (async, MongoDB)
│   │   └── adminController.js       # Endpoints de manutenção
│   │
│   ├── routes/
│   │   ├── crm.js                   # Rotas do CRM
│   │   └── admin.js                 # Rotas de admin/manutenção
│   │
│   ├── utils/
│   │   └── arquivamentoPolicy.js    # Cron jobs + arquivamento
│   │
│   ├── seeds/
│   │   └── crmInitialData.js        # Inicializa funis/colunas padrão
│   │
│   └── server.js                    # ✏️ Importa crmInitialData e arquivamentoPolicy
│
├── .env                              # ✏️ Novo: MONGODB_URI
└── package.json                      # ✏️ Novo: node-cron v3.0.2
```

---

## 🔌 Conectando ao Banco de Dados

### Local (Desenvolvimento)
```bash
# 1. Instalar MongoDB
# Windows: https://docs.mongodb.com/manual/tutorial/install-mongodb-on-windows/
# Mac: brew install mongodb-community
# Linux: sudo apt-get install mongodb

# 2. Iniciar MongoDB
mongod --dbpath ~/data/db

# 3. Variável de Ambiente (.env)
MONGODB_URI=mongodb://localhost:27017/forte_solar

# 4. Iniciar Backend
npm start
```

### Cloud (MongoDB Atlas)
```bash
# 1. Criar conta em https://www.mongodb.com/cloud/atlas
# 2. Criar cluster (M0 Free é suficiente)
# 3. Copiar connection string
# 4. Atualizar .env
MONGODB_URI=mongodb+srv://usuario:senha@cluster0.mongodb.net/forte_solar

# 5. Iniciar Backend
npm start
```

---

## 🎯 Endpoints CRM

### FUNIS (Gestão de Funis de Vendas)
```bash
GET    /api/crm/funis              # Listar funis ativos
POST   /api/crm/funis              # Criar novo funis
  Body: { "nome": "Suporte", "descricao": "..." }

PATCH  /api/crm/funis/:id          # Atualizar funis
DELETE /api/crm/funis/:id          # Desativar funis (soft delete)
```

### COLUNAS (Estágios do Kanban)
```bash
GET    /api/crm/colunas              # Listar colunas
GET    /api/crm/colunas?funilId=xxx  # Listar por funis

POST   /api/crm/colunas              # Criar coluna
  Body: { "nome": "Novo Estágio", "funilId": "...", "limiteWIP": 10 }

PATCH  /api/crm/colunas/:id          # Atualizar coluna
DELETE /api/crm/colunas/:id          # Desativar coluna
```

### LEADS (Cartões do Kanban)
```bash
GET    /api/crm/leads                # Listar leads
GET    /api/crm/leads?funilId=xxx    # Filtrar por funis
GET    /api/crm/leads?colunaId=xxx   # Filtrar por coluna
GET    /api/crm/leads?arquivado=true # Ver leads arquivados

POST   /api/crm/leads                # Criar lead
  Body: {
    "nome": "João Silva",
    "colunaId": "...",
    "funilId": "...",
    "valor": 50000,
    "endereco": "Rua Teste, 123",    # ← NOVO
    "cidade": "São Paulo",            # ← NOVO
    "estado": "SP",                   # ← NOVO
    "email": "joao@example.com"
  }

GET    /api/crm/leads/:id            # Obter lead específico
PATCH  /api/crm/leads/:id            # Atualizar lead
PATCH  /api/crm/leads/:id/mover      # Mover para coluna
  Body: { "colunaId": "..." }

DELETE /api/crm/leads/:id            # Arquivar lead (soft delete)
```

### RELATÓRIOS
```bash
GET    /api/crm/funis/:id/stats      # Estatísticas por funis
GET    /api/crm/leads/por-origem     # Leads agrupados por origem
```

---

## 🔐 Endpoints de Manutenção (Admin)

**Requer header**: `X-Admin-Key: <ADMIN_API_KEY>` (vê .env)

```bash
# Executar manutenção completa
POST   /api/admin/manutencao
# Faz: Arquivamento + Compactação + Relatório

# Arquivar leads antigos (>6 meses sem atualização)
POST   /api/admin/arquivar-leads

# Compactar dados antigos (remover notas/tags)
POST   /api/admin/compactar-dados
  Body: { "diasThreshold": 180 }  # Opcional

# Gerar relatório trimestral
GET    /api/admin/relatorio-win-rate
```

---

## 📝 Exemplos de Uso

### Criar um Lead
```bash
curl -X POST http://localhost:5005/api/crm/leads \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Empresa XYZ",
    "colunaId": "507f1f77bcf86cd799439011",
    "funilId": "507f1f77bcf86cd799439012",
    "valor": 75000,
    "endereco": "Av. Paulista, 1000",
    "cidade": "São Paulo",
    "estado": "SP",
    "telefone": "(11) 3030-3030",
    "origem": "telefone"
  }'
```

### Listar Leads de um Funis
```bash
curl "http://localhost:5005/api/crm/leads?funilId=507f1f77bcf86cd799439012"
```

### Mover Lead para Próxima Coluna
```bash
curl -X PATCH http://localhost:5005/api/crm/leads/507f1f77bcf86cd799439013/mover \
  -H "Content-Type: application/json" \
  -d '{"colunaId": "507f1f77bcf86cd799439014"}'
```

### Executar Manutenção Manual
```bash
curl -X POST http://localhost:5005/api/admin/manutencao \
  -H "X-Admin-Key: dev-key-123"
```

---

## 🧪 Teste Rápido (5 minutos)

### 1. Verificar Conectividade
```bash
# Terminal 1
cd backend && npm start
# Deve exibir: ✅ MongoDB conectado com sucesso

# Terminal 2
curl http://localhost:5005/api/health
# Resposta: { "status": "ok", "servico": "Forte Solar API" }
```

### 2. Listar Funis Padrão (criados automaticamente)
```bash
curl http://localhost:5005/api/crm/funis | jq
# Deve retornar 1 funis: "Vendas"
```

### 3. Listar Colunas Padrão
```bash
curl http://localhost:5005/api/crm/colunas | jq
# Deve retornar 5 colunas: Lead, Qualificado, Proposta, Negociação, Fechado
```

### 4. Criar um Lead de Teste
```bash
FUNIL_ID=$(curl -s http://localhost:5005/api/crm/funis | jq -r '.[0]._id')
COLUNA_ID=$(curl -s http://localhost:5005/api/crm/colunas | jq -r '.[0]._id')

curl -X POST http://localhost:5005/api/crm/leads \
  -H "Content-Type: application/json" \
  -d "{
    \"nome\": \"Lead Teste\",
    \"funilId\": \"$FUNIL_ID\",
    \"colunaId\": \"$COLUNA_ID\",
    \"valor\": 10000,
    \"endereco\": \"Rua Teste, 123\"
  }" | jq
```

### 5. Verificar Persistência (Restart)
```bash
# 1. Ctrl+C no backend
# 2. npm start (inicia novamente)
# 3. curl http://localhost:5005/api/crm/leads | jq
#    Deve retornar o lead criado (ainda lá!)
```

---

## 🔄 Fluxo de Trabalho Típico

### 1. No CRM (Frontend)
```
Criar Lead
├─ Nome, Valor, Origem
├─ Endereço, Cidade, Estado  ← NOVO
└─ Botão "Criar Proposta"    ← NOVO
    └─ Abre /propostas/nova?leadId=xxx
       └─ Pré-preenche: nome, endereço, cidade, estado
```

### 2. Na Proposta
```
Preencher Dados
├─ Cliente: João Silva (do lead)
├─ Endereço: Rua Teste, 123 (do lead)
├─ Painel Solar: 10x 550Wp
├─ Inversor: 5kW
└─ Gerar Diagrama Unifilar
    └─ SVG responsivo com espaçamento automático
```

### 3. Armazenamento Automático
```
Dados salvos em MongoDB
├─ Lead em crmleads
├─ Proposta em propostas (colecao existente)
└─ Histórico mantido (createdAt, updatedAt)
```

### 4. Manutenção Automática
```
Toda semana-feira às 02:00
└─ Arquiva leads não atualizados há 6+ meses
```

---

## 📊 Verificar Dados no Banco

### Via MongoDB CLI (Local)
```bash
# Conectar
mongosh mongodb://localhost:27017/forte_solar

# Ver coleções
show collections

# Contar leads
db.crmleads.countDocuments()

# Ver um lead
db.crmleads.findOne({ nome: "João Silva" })

# Ver leads por origem
db.crmleads.aggregate([
  { $match: { arquivado: false } },
  { $group: { _id: "$origem", count: { $sum: 1 } } }
])

# Sair
exit
```

### Via MongoDB Atlas Dashboard
1. Ir para [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Cluster → Collections
3. Expandir `forte_solar` → `crmleads`
4. Ver/filtrar documentos em tempo real

---

## 🚨 Troubleshooting

### Erro: "connect ECONNREFUSED"
```bash
# Causa: MongoDB não está rodando
# Solução:
mongod --dbpath ~/data/db
```

### Erro: "MongooseError: Cannot connect"
```bash
# Causa: String de conexão incorreta
# Solução: Verificar .env
echo $MONGODB_URI  # Ver qual está sendo usada
```

### Erro: "E11000: Duplicate Key"
```bash
# Causa: Tentou criar documento com _id duplicado
# Solução: MongoDB gera _id automaticamente, não precisa passar
```

### Erro: "WIP Limit exceeded"
```bash
# Causa: Coluna atingiu limite de trabalho em andamento
# Solução: Aumentar limite em PATCH /api/crm/colunas/:id ou mover leads
```

---

## 📚 Leitura Recomendada

**Em Ordem de Importância**:
1. `IMPLEMENTATION_SUMMARY.md` - Visão geral completa
2. `DEPLOYMENT_MONGODB_ATLAS.md` - Se deployando para cloud
3. `TESTING_GUIDE.md` - Antes de ir para produção
4. MongoDB Docs: https://docs.mongodb.com
5. Mongoose Guide: https://mongoosejs.com/docs/index.html

---

## ⚡ Dicas Rápidas

### Performance
- Use indexes: `db.crmleads.createIndex({ "funilId": 1 })`
- Paginar resultados: `GET /api/crm/leads?skip=0&limit=50`
- Usar agregação para relatórios grandes

### Segurança
- Nunca comitar .env com senhas reais
- Usar variáveis de ambiente em produção
- Renovar credenciais MongoDB a cada 3 meses
- IPs específicos em produção (não 0.0.0.0/0)

### Backup
- MongoDB Atlas faz backup automático (free: 7 dias)
- Exportar dados regularmente: `mongodump --uri=...`
- Testar restauração de backup periodicamente

---

## 🎯 Checklist de Deploy

- [ ] MongoDB local testado
- [ ] Backend startup sem erros
- [ ] Endpoints testados (curl)
- [ ] Frontend conectado ao backend
- [ ] CRM criando leads
- [ ] Leads persistem após restart
- [ ] MongoDB Atlas conta criada
- [ ] Connection string do Atlas copiada
- [ ] .env.production criado com URI cloud
- [ ] Testes completos (TESTING_GUIDE.md)
- [ ] Manutenção agendada (cron jobs verificados)
- [ ] Backups verificados
- [ ] Alertas configurados (se usando Atlas)

---

## 📞 Resumo de Tecnologias

| Componente | Tecnologia | Docs |
|------------|-----------|------|
| Database | MongoDB 7.0+ | https://docs.mongodb.com |
| ODM | Mongoose 9.5+ | https://mongoosejs.com |
| Scheduling | node-cron 3.0+ | https://github.com/kelektiv/node-cron |
| Runtime | Node.js 20+ | https://nodejs.org |
| Framework | Express.js 4.21+ | https://expressjs.com |

---

**Versão**: 1.0 | **Data**: Abr/2026 | **Status**: ✅ Production-Ready
