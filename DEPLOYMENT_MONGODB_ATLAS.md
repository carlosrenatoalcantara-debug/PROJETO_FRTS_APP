# Guia de Deployment: MongoDB Atlas Cloud

## 📋 Visão Geral

Este guia descreve como migrar o Forte Solar para usar MongoDB Atlas (cloud) com dados persistentes em vez de dados em memória.

### Mudanças Implementadas

1. **CRM agora persiste em MongoDB** (não mais em memória)
   - Novos modelos: `CrmFunil`, `CrmColuna`, `CrmLead`
   - Soft delete para manter histórico
   - Suporte a WIP limits (Work In Progress)
   - Relatórios e estatísticas

2. **Dados inicializados automaticamente**
   - Funis e colunas padrão criados na primeira inicialização
   - Sem perda de dados em restart do servidor

3. **Melhorias implementadas**
   - CRM com endereços pré-cadastrados ✓
   - Diagrama unifilar com melhor espaçamento ✓
   - Leitura aprimorada de datasheets ✓
   - Persistência de dados em nuvem (em progresso)

---

## 🚀 Passo 1: Criar Conta MongoDB Atlas

### 1.1 Cadastro
1. Acesse [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Clique em **"Try Free"** ou **"Sign Up"**
3. Preencha: Email, senha, nome completo, organização
4. Concorde com os termos e clique **"Create Account"**

### 1.2 Configuração Inicial
1. Verifique seu email (confirme a conta)
2. Faça login no MongoDB Atlas
3. Crie uma **nova organização** (ex: "Forte Solar")
4. Crie um **novo projeto** (ex: "production" ou "desenvolvimento")

---

## 🌐 Passo 2: Criar Cluster MongoDB

### 2.1 Criar Cluster
1. No dashboard do projeto, clique **"Create Deployment"**
2. Escolha **"Build a Database"**
3. Selecione **"M0 (Free)"** para começar (upgrade depois se necessário)
4. Selecione a **Region**:
   - Para Brasil: **São Paulo (sa-east-1)** ou **us-east-1**
5. Clique **"Create Deployment"**

### 2.2 Aguardar Inicialização
- Aguarde 3-5 minutos até o cluster estar pronto
- Status mudará para "RUNNING" (verde)

---

## 🔐 Passo 3: Configurar Segurança

### 3.1 Criar Usuário de Banco de Dados
1. Na aba **"Security"** → **"Database Access"**
2. Clique **"Add New Database User"**
3. Preencha:
   - **Username**: `forte-solar` (ou similar)
   - **Password**: gere uma senha forte (ou use **"Autogenerate"**)
   - **User Privileges**: selecione **"Built-in role" → "Atlas Admin"**
4. Clique **"Add User"**
5. **Copie e guarde a senha em um local seguro**

### 3.2 Configurar IP Whitelist
1. Na aba **"Security"** → **"Network Access"**
2. Clique **"Add IP Address"**
3. Opções:
   - **Para desenvolvimento**: Clique **"Allow Access from Anywhere"** (0.0.0.0/0)
   - **Para produção**: Adicione apenas seus IPs específicos
4. Clique **"Add Entry"**

---

## 🔗 Passo 4: Obter String de Conexão

### 4.1 Connection String
1. No dashboard do cluster, clique **"Connect"**
2. Escolha **"Drivers"**
3. Selecione:
   - **Driver**: "Node.js"
   - **Version**: "5.x or later"
4. Copie a **connection string**:
   ```
   mongodb+srv://<username>:<password>@<cluster>.<random>.mongodb.net/<database>?retryWrites=true&w=majority
   ```

### 4.2 Substituir Placeholders
- `<username>`: `forte-solar` (ou seu usuário)
- `<password>`: Sua senha (URL-encoded se contiver caracteres especiais)
- `<cluster>`: Nome do seu cluster (ex: `cluster0`)
- `<database>`: `forte_solar` (nome do banco)

**Exemplo Final:**
```
mongodb+srv://forte-solar:minha_senha@cluster0.abc123.mongodb.net/forte_solar?retryWrites=true&w=majority
```

---

## 🔧 Passo 5: Configurar Variáveis de Ambiente

### 5.1 Atualizar .env (Desenvolvimento)
```bash
# Antes (local):
MONGODB_URI=mongodb://localhost:27017/forte_solar

# Depois (cloud):
MONGODB_URI=mongodb+srv://forte-solar:sua_senha@cluster0.abc123.mongodb.net/forte_solar?retryWrites=true&w=majority
```

### 5.2 Atualizar .env (Produção)
Criar arquivo `.env.production`:
```bash
PORT=5005
NODE_ENV=production
FRONTEND_URL=https://seu-dominio.com

# MongoDB Atlas (Production)
MONGODB_URI=mongodb+srv://forte-solar:sua_senha@cluster0-prod.abc123.mongodb.net/forte_solar_prod?retryWrites=true&w=majority

ADMIN_API_KEY=chave-secreta-forte
```

---

## ✅ Passo 6: Testar Conexão

### 6.1 Iniciar Backend
```bash
cd backend
npm install
npm start
```

### 6.2 Verificar Logs
Você deve ver:
```
✅ MongoDB conectado com sucesso
📋 Inicializando dados padrão do CRM...
✓ Funis "Vendas" criado
✓ Coluna "Lead" criada
✓ Coluna "Qualificado" criada
...
✅ Forte Solar API rodando em http://localhost:5005
```

### 6.3 Testar via API
```bash
# Listar funis (deve retornar dados)
curl http://localhost:5005/api/crm/funis

# Listar colunas
curl http://localhost:5005/api/crm/colunas

# Criar novo lead
curl -X POST http://localhost:5005/api/crm/leads \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Test Lead",
    "colunaId": "<id_coluna>",
    "funilId": "<id_funil>",
    "endereco": "Rua Teste, 123",
    "cidade": "São Paulo",
    "estado": "SP"
  }'
```

---

## 💾 Passo 7: Migrar Dados Existentes (Opcional)

Se você tem dados já criados em memória e quer migratá-los para MongoDB:

### 7.1 Exportar Dados (Node.js REPL)
```javascript
// Se tinha dados em memória antes
const leads = [
  { nome: "Lead 1", ... },
  { nome: "Lead 2", ... },
]

// Salvar em arquivo JSON
fs.writeFileSync('leads_backup.json', JSON.stringify(leads, null, 2))
```

### 7.2 Importar via Script
Criar arquivo `scripts/import-crm-data.js`:
```javascript
import mongoose from 'mongoose'
import fs from 'fs'
import { CrmLead } from '../src/models/CrmLead.js'

async function importar() {
  await mongoose.connect(process.env.MONGODB_URI)
  
  const dados = JSON.parse(fs.readFileSync('leads_backup.json'))
  
  for (const lead of dados) {
    const novoLead = new CrmLead(lead)
    await novoLead.save()
  }
  
  console.log(`✓ ${dados.length} leads importados`)
  await mongoose.disconnect()
}

importar()
```

Executar:
```bash
node scripts/import-crm-data.js
```

---

## 📊 Passo 8: Configurar Arquivamento e Retenção

### 8.1 Política de Retenção
Editar arquivo novo: `src/utils/arquivamentoPolicy.js`

```javascript
import { CrmLead } from '../models/CrmLead.js'

export async function arquivarLeadsAntigos() {
  const seisMemesAtras = new Date()
  seisMemesAtras.setMonth(seisMemesAtras.getMonth() - 6)

  // Arquivar leads sem atualização por 6 meses
  await CrmLead.updateMany(
    {
      updatedAt: { $lt: seisMemesAtras },
      arquivado: false,
    },
    { arquivado: true }
  )

  console.log('✓ Leads antigos arquivados')
}

// Executar em agendamento (cron job)
// Por exemplo: toda segunda-feira às 2am
import cron from 'node-cron'
cron.schedule('0 2 * * 1', arquivarLeadsAntigos)
```

### 8.2 Installar node-cron (se não tiver)
```bash
npm install node-cron
```

### 8.3 Importar no server.js
```javascript
import './utils/arquivamentoPolicy.js'
```

---

## 🗄️ Passo 9: Monitorar MongoDB Atlas

### 9.1 Dashboard
1. Acesse [cloud.mongodb.com](https://cloud.mongodb.com)
2. Veja métricas em tempo real:
   - **Operations/sec**: Requisições por segundo
   - **Network I/O**: Entrada/saída de dados
   - **Storage**: Espaço usado
   - **Connection Count**: Conexões ativas

### 9.2 Alertas
1. Clique em **"Alerts"**
2. Configure alertas para:
   - Uso de espaço > 80%
   - Taxa de erro > 1%
   - Conexões lentas > 100ms

### 9.3 Backups
MongoDB Atlas faz backups automáticos:
- **M0 (Free)**: Snapshots a cada 6 horas (retenção 7 dias)
- **M2+**: Snapshots a cada hora (retenção 35 dias)

Para upgrade: M0 → M2 (custa ~$9/mês)

---

## 📈 Passo 10: Upgrade para Produção (Opcional)

### 10.1 Quando Fazer Upgrade
- Se atingir limite de armazenamento (512 MB para M0)
- Se precisar de 3+ conexões simultâneas
- Se precisar de backups mais frequentes

### 10.2 Upgrade M0 → M2
1. No cluster, clique **"...Upgrade"**
2. Selecione **"M2 (Shared Tier)" ou "M10 (Dedicated)"**
3. Escolha região
4. Clique **"Confirm"**
5. Aguarde 3-5 minutos (sem downtime)

### 10.3 Criar Segundo Cluster (Staging)
Para testes antes de produção:
1. Crie novo cluster: `cluster-staging`
2. Use mesmos usuários/IPs
3. Use database nome: `forte_solar_staging`
4. Configure variável: `MONGODB_URI_STAGING=...`

---

## 🔍 Troubleshooting

### Erro: "connect ECONNREFUSED"
**Causa**: Banco de dados não está acessível
- ✓ Verifique se string de conexão está correta
- ✓ Verifique se IP está no whitelist
- ✓ Verifique se cluster está em status "RUNNING"

### Erro: "Invalid username/password"
**Causa**: Credenciais incorretas
- ✓ Verifique username e password no .env
- ✓ Se tem caracteres especiais, use URL encode (ex: `@` = `%40`)
- ✓ Recrie o usuário se necessário

### Erro: "MongoNetworkError: getaddrinfo ENOTFOUND"
**Causa**: DNS não resolve
- ✓ Tente reiniciar o servidor backend
- ✓ Verifique conexão de internet
- ✓ Tente conectar diretamente: `mongosh "mongodb+srv://..."`

### Lento ou timeouts
**Causa**: Performance do cluster
- ✓ Verifique latência de rede (Brasil → cluster)
- ✓ Mude cluster para região mais próxima
- ✓ Upgrade para tier superior (M2+)

---

## 📋 Checklist Final

- [ ] Conta MongoDB Atlas criada
- [ ] Cluster em execução
- [ ] Usuário de banco de dados criado
- [ ] IP whitelist configurado
- [ ] String de conexão copiada
- [ ] .env atualizado
- [ ] Backend testado com sucesso
- [ ] Dados migraram corretamente
- [ ] Arquivamento configurado
- [ ] Backups validados
- [ ] Alertas configurados

---

## 📞 Próximos Passos

1. **Deploy Frontend**: Colocar frontend em produção (Vercel, Netlify, etc.)
2. **Deploy Backend**: Colocar backend em host (Heroku, Railway, AWS, etc.)
3. **SSL/HTTPS**: Configurar certificado SSL
4. **Domínio**: Apontar domínio para seu servidor
5. **CI/CD**: Configurar pipeline de deploy automático

---

## 📚 Referências

- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com)
- [Connection String Reference](https://www.mongodb.com/docs/manual/reference/connection-string/)
- [Node.js Driver](https://www.mongodb.com/docs/drivers/node/)
- [Mongoose Documentation](https://mongoosejs.com)

---

## 💡 Dicas Importantes

### Segurança
- ⚠️ Nunca commite .env com senhas reais
- ⚠️ Use variáveis de ambiente em produção
- ⚠️ Mude senha a cada 3 meses
- ⚠️ Use IPs específicos em produção (não 0.0.0.0/0)

### Performance
- Use indexes para campos frequentes (implementados automaticamente no Mongoose)
- Agregações para relatórios grandes
- Cache com Redis para dados estáticos

### Backup
- Teste restauração de backup periodicamente
- Exporte dados críticos mensalmente
- Mantenha backup local + cloud

---

**Versão**: 1.0  
**Última Atualização**: Abril 2026  
**Mantido por**: Forte Solar Dev Team
