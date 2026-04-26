# MongoDB Setup - Forte Solar

## Opção 1: MongoDB Local (Recomendado para Desenvolvimento)

### Windows

1. **Baixar e instalar MongoDB Community Edition:**
   - Acesse: https://www.mongodb.com/try/download/community
   - Escolha Windows e baixe o instalador MSI
   - Execute e instale com as opções padrão

2. **Verificar instalação:**
   ```bash
   mongod --version
   ```

3. **Iniciar MongoDB:**
   ```bash
   # No Windows PowerShell como Admin:
   net start MongoDB

   # Ou via WSL2:
   mongod --dbpath /data/db
   ```

4. **Configuração automática:**
   - MongoDB rodará em `mongodb://localhost:27017` por padrão
   - Variável `.env` já configurada para isso

### macOS

```bash
# Via Homebrew:
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Verificar:
mongosh --eval "db.adminCommand('ping')"
```

### Linux (Ubuntu)

```bash
# Adicionar repositório:
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Instalar:
sudo apt-get update
sudo apt-get install -y mongodb-org

# Iniciar:
sudo systemctl start mongod
```

---

## Opção 2: MongoDB Atlas (Cloud - Gratuito)

### Passo a Passo

1. **Criar conta:**
   - Acesse: https://www.mongodb.com/cloud/atlas
   - Clique "Try Free" (gratuito)
   - Crie uma conta com seu email

2. **Criar cluster:**
   - No dashboard, clique "Create Deployment"
   - Escolha "Shared" (gratuito)
   - Selecione a região mais próxima
   - Confirme (leva 2-3 minutos)

3. **Criar credenciais:**
   - Vá para "Database Access"
   - Clique "Add New Database User"
   - Username: `forte_solar`
   - Password: gere uma senha segura (salve!)
   - Permissions: "Atlas Admin"

4. **Configurar rede:**
   - Vá para "Network Access"
   - Clique "Add IP Address"
   - Selecione "Allow from anywhere" (0.0.0.0/0) para desenvolvimento
   - Confirme

5. **Pegar connection string:**
   - Clique no botão "Connect" ao lado do cluster
   - Escolha "Drivers"
   - Copie a string (exemplo abaixo)
   - **Substitua `<password>` pela senha criada**

6. **Atualizar .env:**
   ```
   MONGODB_URI=mongodb+srv://forte_solar:<password>@cluster0.xxxxx.mongodb.net/forte_solar?retryWrites=true&w=majority
   ```

---

## Verificar Conexão

### Via Backend

Ao iniciar o backend com `npm run dev`, você verá:

```
✅ MongoDB conectado com sucesso
✅ Forte Solar API rodando em http://localhost:5000
```

Se houver erro:
```
❌ MongoDB conectado com sucesso
   URI: mongodb://localhost:27017/forte_solar
   Certifique-se de que MongoDB está rodando...
```

### Via MongoDB Shell

**Local:**
```bash
mongosh
# Conecta automaticamente a localhost:27017
db.version()  # Verificar versão
use forte_solar  # Mudar para DB do projeto
db.clientes.find()  # Listar clientes
```

**Atlas:**
```bash
mongosh "mongodb+srv://forte_solar:password@cluster0.xxxxx.mongodb.net/forte_solar"
db.clientes.find()
```

---

## Popular Banco de Dados (Seed)

### Executar Seed Inicial

```bash
cd backend
npm run seed
```

Isso criará:
- ✅ 1 Empresa (Forte Solar)
- ✅ 3 Clientes de exemplo
- ✅ 3 Painéis FV (Canadian Solar, JA Solar, Bifacial)
- ✅ 3 Inversores (SMA, Fronius, Growatt)
- ✅ 3 Estruturas (Metálico, Cerâmico, Solo)

Saída esperada:
```
✅ MongoDB conectado com sucesso
🧹 Banco de dados limpo
✅ Empresa padrão criada: Forte Solar
✅ 3 clientes criados
✅ 3 painéis FV criados
✅ 3 inversores criados
✅ 3 estruturas criadas

✅ Seed inicial completo!
```

---

## Estrutura do Banco

### Collections Criadas

```
forte_solar/
├── clientes/          # 3 clientes
├── projetosfvs/       # Projetos solares
├── projetoevs/        # Projetos EV
├── equipamentos/      # 9 equipamentos (painéis, inversores, estruturas)
├── empresas/          # 1 empresa padrão (Forte Solar)
└── leads/             # CRM
```

### Models Disponíveis

```javascript
// Importar em controllers:
import { Cliente } from '../models/Cliente.js'
import { ProjetoFV } from '../models/ProjetoFV.js'
import { Equipamento } from '../models/Equipamento.js'
import { Empresa } from '../models/Empresa.js'
import { Lead } from '../models/Lead.js'

// Usar em queries:
await Cliente.find()
await ProjetoFV.findById(id)
await Equipamento.findByIdAndUpdate(id, dados)
```

---

## Problemas Comuns

### ❌ "Erro ao conectar MongoDB: ECONNREFUSED"
**Solução:** MongoDB não está rodando
- Local: Execute `mongod` ou `net start MongoDB` (Windows)
- Atlas: Verifique credenciais e IP whitelist

### ❌ "E11000 duplicate key error"
**Solução:** Email ou sku já existe
- Verifique dados duplicados
- Execute `npm run seed` para limpar

### ❌ "MongooseError: Cannot find module"
**Solução:** Mongoose não instalado
```bash
npm install mongoose
```

### ❌ Dados desaparecem ao reiniciar
**Antes (sem DB):** Array em memória
**Agora (com MongoDB):** Dados persistidos no banco
✅ Problema resolvido!

---

## Dados de Teste

Após `npm run seed`, acesse:

```bash
mongosh
use forte_solar
db.clientes.find().pretty()
```

Clientes:
```json
{
  "nome": "João Silva",
  "email": "joao@email.com",
  "telefone": "(11) 99999-0001",
  "tipo": "Pessoa Física",
  "cidade": "São Paulo",
  "estado": "SP"
}
```

Equipamentos:
- **Painéis:** Canadian Solar, JA Solar, Bifacial
- **Inversores:** SMA, Fronius, Growatt
- **Estruturas:** Metálico, Cerâmico, Solo

---

## Próximos Passos

1. ✅ MongoDB configurado
2. ⬜ Atualizar ProjetosFVController para MongoDB
3. ⬜ Atualizar EquipamentosController para MongoDB
4. ⬜ Adicionar autenticação
5. ⬜ Deploy em produção

---

**Status:** MongoDB integrado e funcionando ✅
**Data:** 2026-04-24
**Proxmidade próxima atualização:** 2026-04-25
