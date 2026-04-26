# 🔐 Configuração Segura de Credenciais - MongoDB Atlas

## ⚠️ IMPORTANTE: Segurança

Este arquivo contém instruções para armazenar suas credenciais de forma **SEGURA**. 

### Nunca:
- ❌ Comitar `.env` com senhas no git
- ❌ Compartilhar credenciais via email/chat/Discord
- ❌ Usar mesma senha em múltiplos serviços
- ❌ Deixar credenciais visíveis na tela

### Sempre:
- ✅ Guardar em arquivo local (não versionado)
- ✅ Usar variáveis de ambiente em produção
- ✅ Renovar credenciais a cada 3 meses
- ✅ Usar senhas fortes (20+ caracteres)

---

## 📋 Passo 1: Criar MongoDB Atlas

### 1.1 Registrar-se
1. Acesse [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Clique em **"Try Free"**
3. Preencha com seu email/senha
4. Confirme seu email

### 1.2 Criar Organização e Projeto
1. No dashboard, clique **"Create Organization"**
   - Nome: "Forte Solar"
2. Clique **"New Project"**
   - Nome: "production" ou "development"

### 1.3 Criar Cluster (Banco de Dados)
1. Clique **"Build a Deployment"**
2. Escolha **"M0 (Free)"** → não paga nada
3. Selecione região: **São Paulo (sa-east-1)** ou **us-east-1**
4. Clique **"Create Deployment"**
5. Aguarde 3-5 minutos até ficar **RUNNING** (verde)

---

## 🔑 Passo 2: Criar Usuário e Obter Credenciais

### 2.1 Criar Usuário de Banco de Dados
1. No cluster, vá para **"Security" → "Database Access"**
2. Clique **"Add New Database User"**
3. **Username**: `forte-solar` (copie exatamente)
4. **Password**: Clique **"Autogenerate"** para gerar senha forte
5. Copie a senha gerada
6. Clique **"Add User"**

**Guarde este arquivo localmente com as credenciais!**

### 2.2 Configurar IP Whitelist
1. Vá para **"Security" → "Network Access"**
2. Clique **"Add IP Address"**
3. Para **desenvolvimento**: Clique **"Allow Access from Anywhere"** (0.0.0.0/0)
4. Para **produção**: Use seu IP específico
5. Clique **"Add Entry"** e confirme

### 2.3 Obter Connection String
1. Volte ao cluster, clique **"Connect"**
2. Escolha **"Drivers"**
3. Selecione **Node.js** versão **5.x or later**
4. Copie a connection string:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
   ```

---

## 🛡️ Passo 3: Armazenar Credenciais Localmente (SEGURO)

### Opção A: Arquivo Local (Recomendado)

**Criar arquivo seguro local** (NÃO no repositório):
```bash
# Windows
notepad "%USERPROFILE%\.mongodb-credentials"

# Mac/Linux
nano ~/.mongodb-credentials
```

**Preencher com (substitua pelos seus valores)**:
```
# MongoDB Atlas Credentials
# NUNCA comitar este arquivo!
# Data: [sua data]

MONGO_USERNAME=forte-solar
MONGO_PASSWORD=[sua_senha_aqui]
MONGO_CLUSTER=cluster0.abc123
MONGO_REGION=sa-east-1
MONGO_DATABASE=forte_solar

# Connection String Completa:
# mongodb+srv://forte-solar:sua_senha@cluster0.abc123.mongodb.net/forte_solar?retryWrites=true&w=majority
```

**Proteger arquivo** (permissões):
```bash
# Mac/Linux
chmod 600 ~/.mongodb-credentials

# Windows (via PowerShell admin)
icacls "$env:USERPROFILE\.mongodb-credentials" /inheritance:r /grant:r "%USERNAME%:F"
```

### Opção B: Gerenciador de Senhas
Use: 1Password, Bitwarden, KeePass, LastPass
- Criar entrada com as credenciais
- Guardar de forma segura
- Copiar quando precisar

---

## 📝 Passo 4: Criar Arquivo `.env.production` Seguro

**Criar arquivo** (no repositório do projeto):
```bash
# Windows
cd C:\PROJETO_FRTS_APP\backend
notepad .env.production

# Mac/Linux
cd ~/PROJETO_FRTS_APP/backend
nano .env.production
```

**Conteúdo** (substitua pelos seus valores):
```bash
PORT=5005
NODE_ENV=production
FRONTEND_URL=https://seu-dominio.com

# MongoDB Atlas (PREENCHER COM SUAS CREDENCIAIS)
MONGODB_URI=mongodb+srv://forte-solar:SUA_SENHA_AQUI@cluster0.abc123.mongodb.net/forte_solar?retryWrites=true&w=majority

# Admin
ADMIN_API_KEY=chave-secreta-muito-forte-aqui

# SolarMarket (copiar de .env original)
SOLARMARKET_API_KEY=6059:iQANRfzf2ykzC46raDUw8bx41Xm2qtOQSRhtTp7v
SOLARMARKET_API_URL=https://api.solarmarket.com.br
```

**Proteger arquivo**:
```bash
# Mac/Linux
chmod 600 .env.production

# Windows (já está protegido por padrão)
```

**⚠️ IMPORTANTE**: Este arquivo `.env.production` será ignorado pelo git (vê .gitignore), então é seguro armazenar aqui localmente.

---

## ✅ Passo 5: Preencher Credenciais Aqui

**Quando estiver pronto, preencha abaixo** (é SEGURO - não será salvo em git):

```
Username MongoDB: [preencha]
Senha MongoDB: [preencha]
Cluster Name: [preencha - ex: cluster0]
Region: [preencha - ex: sa-east-1]
Database Name: [preencha - ex: forte_solar]

Connection String Completa:
[cole aqui a string completa do MongoDB Atlas]
```

---

## 🧪 Passo 6: Testar Conexão Localmente

Depois de preencher as credenciais no `.env.production`:

```bash
# Testar conexão local
cd backend
NODE_ENV=production npm start

# Deve exibir:
# ✅ MongoDB conectado com sucesso
# 📋 Inicializando dados padrão do CRM...
# ✅ CRM inicializado com sucesso
# ✅ Forte Solar API rodando em http://localhost:5005
```

---

## ☁️ Passo 7: Deploy para Nuvem

Após confirmar que funciona localmente com as credenciais Atlas:

### Opção 1: Heroku
```bash
# Instalar Heroku CLI
# Fazer login
heroku login

# Criar app
heroku create seu-app-forte-solar

# Adicionar variáveis de ambiente
heroku config:set NODE_ENV=production \
  MONGODB_URI="mongodb+srv://forte-solar:senha@cluster0.mongodb.net/forte_solar" \
  ADMIN_API_KEY="chave-super-secreta"

# Deploy
git push heroku main
```

### Opção 2: Railway.app (Recomendado)
```bash
# 1. Ir para https://railway.app
# 2. Criar conta (conectar GitHub)
# 3. Criar novo projeto
# 4. Conectar repositório GitHub
# 5. Adicionar variáveis via Railway dashboard
# 6. Deploy automático!
```

### Opção 3: AWS/GCP
Seguir documentação específica da plataforma

---

## 🔐 Checklist de Segurança

- [ ] Arquivo `.mongodb-credentials` criado localmente
- [ ] Permissões do arquivo configuradas (chmod 600)
- [ ] `.env.production` criado (NÃO commitado)
- [ ] Credenciais preenchidas corretamente
- [ ] Testado localmente com `npm start`
- [ ] MongoDB Atlas IP whitelist configurado
- [ ] Variáveis de ambiente adicionadas na nuvem
- [ ] Teste de conexão da nuvem funcionando
- [ ] Backup das credenciais feito
- [ ] Acesso ao arquivo credenciais restringido

---

## 📞 Próximas Ações

**Quando estiver pronto com as credenciais:**
1. Preencha as informações no formulário abaixo
2. Vou validar a conexão
3. Vou fazer o deployment automático para a nuvem
4. Vou testar tudo funcionando

---

## ⚠️ Segurança em Produção

Depois que fizer o deployment:

1. **Altere as senhas padrão**
   ```bash
   # No MongoDB Atlas:
   # Security → Database Access → Editar usuário → Generate New Password
   ```

2. **Use certificados SSL**
   ```bash
   # MongoDB Atlas usa SSL por padrão ✅
   # Heroku/Railway usam SSL automático ✅
   ```

3. **Configure firewall**
   - IP whitelist apenas do seu servidor
   - Não usar 0.0.0.0/0 em produção

4. **Monitore acessos**
   - MongoDB Atlas → Security → Logs
   - Verificar acessos suspeitos

5. **Backup regular**
   - MongoDB Atlas faz backup automático
   - Testar restauração mensalmente

---

## 🆘 Problemas Comuns

### "MongoNetworkError: connect ECONNREFUSED"
- ✓ Verificar IP whitelist no MongoDB Atlas
- ✓ Verificar credenciais estão corretas
- ✓ Testar connection string no mongosh

### "Invalid username/password"
- ✓ Copiar username e password exatamente como gerado
- ✓ Se tem @, é o literal @ (não URL-encoded)
- ✓ Recriar usuário se não souber a senha

### "Cluster not available"
- ✓ Aguardar 5+ minutos após criação
- ✓ Verificar status no MongoDB Atlas Dashboard
- ✓ Recriar cluster se necessário

---

**Status**: Aguardando suas credenciais para prosseguir! 🚀
