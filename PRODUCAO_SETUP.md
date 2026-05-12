# 🚀 Guia de Configuração para Produção

## 📋 Pré-requisitos

- ✅ Conta MongoDB Atlas (gratuita)
- ✅ Conta Railway ou Vercel (para deploy)
- ✅ GitHub (repositório já configurado)

---

## 1️⃣ **Configurar MongoDB Atlas**

### 1.1 - Criar Cluster Grátis

1. Acesse: https://www.mongodb.com/cloud/atlas
2. Crie uma conta ou faça login
3. Clique em **"Create a Database"** → **Shared (Gratuito)**
4. Escolha:
   - Cloud Provider: **AWS**
   - Region: **us-east-1** (ou mais próxima do Brasil)
   - Cluster Name: **forte-solar** (ou seu nome)
5. Clique em **"Create Cluster"** (pode levar 2-3 min)

### 1.2 - Criar Usuário de Banco de Dados

1. Na dashboard, vá para **Database Access**
2. Clique em **"Add New Database User"**
3. Escolha **Authentication Method**: Password
4. **Username**: `forte_solar`
5. **Password**: Gere uma senha forte (copie-a!)
6. **Database User Privileges**: Read and write to any database
7. Clique em **"Add User"**

### 1.3 - Configurar IP Whitelist

1. Na dashboard, vá para **Network Access**
2. Clique em **"Add IP Address"**
3. Selecione **"Allow Access from Anywhere"** (0.0.0.0/0)
4. **⚠️ IMPORTANTE**: Isso permite acesso de qualquer IP. Em produção crítica, especifique IPs.
5. Clique em **"Confirm"**

### 1.4 - Obter Connection String

1. Na dashboard, vá para **Databases**
2. Clique em **"Connect"** no seu cluster
3. Escolha **"Drivers"**
4. Selecione **Node.js**
5. Copie a string de conexão (parecida com):
   ```
   mongodb+srv://forte_solar:SENHA@cluster.mongodb.net/forte-solar?retryWrites=true&w=majority
   ```

---

## 2️⃣ **Configurar Variáveis de Ambiente**

### 2.1 - Backend (.env)

Edite o arquivo `backend/.env`:

```env
# SERVIDOR
NODE_ENV=production
PORT=5000

# JWT
JWT_SECRET=gere-uma-chave-forte-com-crypto

# MONGODB
MONGODB_URI=mongodb+srv://forte_solar:SUA_SENHA@cluster.mongodb.net/forte-solar?retryWrites=true&w=majority

# URLs
FRONTEND_URL=https://seu-frontend.vercel.app
BACKEND_URL=https://seu-backend.up.railway.app
```

**Para gerar JWT_SECRET forte:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.2 - Frontend (.env.production)

Edite `frontend/.env.production`:

```env
VITE_API_URL=https://seu-backend.up.railway.app
```

---

## 3️⃣ **Deploy no Railway (Backend)**

### 3.1 - Conectar Repositório

1. Acesse: https://railway.app
2. Faça login com GitHub
3. Clique em **"New Project"**
4. Escolha **"Deploy from GitHub repo"**
5. Selecione **PROJETO_FRTS_APP**
6. Clique em **"Deploy"**

### 3.2 - Configurar Variáveis de Ambiente

1. No dashboard do Railway, acesse seu projeto
2. Vá para **"Services"** → **seu app Node.js**
3. Clique em **"Variables"**
4. Adicione todas as variáveis do `.env`:
   - `NODE_ENV=production`
   - `PORT=5000`
   - `JWT_SECRET=seu-valor`
   - `MONGODB_URI=sua-string`
   - etc.

### 3.3 - Verificar Deploy

1. Vá para **"Deployments"**
2. Aguarde até ficar **"Success"** (verde)
3. Copie a URL do domínio (parecida com `https://projetofrtsapp-production.up.railway.app`)

---

## 4️⃣ **Deploy no Vercel (Frontend)**

### 4.1 - Conectar Repositório

1. Acesse: https://vercel.com
2. Faça login com GitHub
3. Clique em **"Add New..."** → **"Project"**
4. Selecione **PROJETO_FRTS_APP**
5. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend/`
6. Clique em **"Deploy"**

### 4.2 - Configurar Variáveis de Ambiente

1. No dashboard do Vercel, acesse o projeto
2. Vá para **"Settings"** → **"Environment Variables"**
3. Adicione:
   - **Nome**: `VITE_API_URL`
   - **Valor**: `https://seu-backend-railway.up.railway.app`
4. Clique em **"Save"**

### 4.3 - Redeployar

1. Vá para **"Deployments"**
2. Clique no **mais recente** → **"Redeploy"**
3. Aguarde até ficar pronto (verde)

---

## 5️⃣ **Testar em Produção**

### 5.1 - Testar Backend

```bash
curl https://seu-backend.up.railway.app/api/auth/verify \
  -H "Authorization: Bearer seu-token"
```

### 5.2 - Testar Frontend

1. Acesse: https://seu-frontend.vercel.app/login
2. Tente login com: `demo@fortesolar.com.br` / `demo123`
3. Teste "Esqueci a senha"

### 5.3 - Testar Calculadora

1. Acesse: https://seu-frontend.vercel.app/calculadora
2. Preencha os dados
3. Clique em enviar
4. Verifique se o lead foi criado no MongoDB

---

## 🔧 **Solução de Problemas**

### "Erro ao conectar ao servidor"
- ✅ Verificar se `VITE_API_URL` está correto no Vercel
- ✅ Verificar se o Railway está com status "Success"
- ✅ Verificar se `MONGODB_URI` está correto no Railway

### "MongoDB connection refused"
- ✅ Verificar IP whitelist em MongoDB Atlas
- ✅ Verificar credenciais (username/password)
- ✅ Verificar se o cluster está ativo

### "JWT erro"
- ✅ Regenerar `JWT_SECRET` (deve ser igual em todos os ambientes)
- ✅ Limpar localStorage do navegador
- ✅ Fazer login novamente

---

## 📊 **Verificar Dados no MongoDB**

1. Acesse MongoDB Atlas
2. Vá para **"Collections"**
3. Clique em banco de dados **"forte-solar"**
4. Veja as coleções:
   - `leads` - Simulações da calculadora
   - `usuarios` - Usuários do sistema

---

## ✅ **Checklist Final**

- [ ] MongoDB Atlas configurado
- [ ] Connection string testada
- [ ] Backend deployado no Railway
- [ ] Frontend deployado no Vercel
- [ ] Variáveis de ambiente configuradas
- [ ] Login funcionando
- [ ] Calculadora enviando dados
- [ ] Dados aparecendo no MongoDB

---

**Data**: 10 de Maio de 2026  
**Status**: ✅ Pronto para Produção  
**Suporte**: Contate carlosrenatoalcantara@gmail.com

