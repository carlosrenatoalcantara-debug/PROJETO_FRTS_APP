# 🌅 Bom dia! Comece por aqui

## Você voltou! 👋

Tudo está pronto. Basta seguir estes 4 passos simples (25 minutos):

---

## 📍 **PASSO 1: MongoDB Atlas (5 min)**

### Instruções rápidas:

1. Abra: https://www.mongodb.com/cloud/atlas
2. Clique **"Try Free"** (ou login se já tem conta)
3. **"Create a Database"** → **Shared (FREE)**
4. Escolha:
   - Cloud: AWS
   - Region: us-east-1
   - Name: forte-solar
5. **"Create Cluster"** (aguarde 2-3 min)
6. **Database Access**:
   - Add User: `forte_solar`
   - Password: `gere-uma-senha-forte`
   - Create User
7. **Network Access**:
   - Add IP Address
   - Allow From Anywhere
8. **Connect**:
   - Drivers
   - Copy Connection String
   - Substitua SENHA pela que você criou

**Cole aqui sua connection string:**
```
mongodb+srv://forte_solar:SENHA@cluster.mongodb.net/forte-solar?retryWrites=true&w=majority
```

---

## 📍 **PASSO 2: Railway Backend (10 min)**

### Instruções rápidas:

1. Abra: https://railway.app
2. Login com **GitHub**
3. **New Project**
4. **Deploy from GitHub repo**
5. Selecione: **PROJETO_FRTS_APP**
6. Clique **"Deploy"** (aguarde...)
7. Quando pronto, vá para **Variables**
8. Adicione:

```
NODE_ENV=production
PORT=5000
JWT_SECRET=gere-algo-assim: $(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
MONGODB_URI=cole-sua-string-aqui
FRONTEND_URL=sua-url-vercel-aqui
```

9. Copie a URL do seu app Railway (tipo: `https://projetofrtsapp-production.up.railway.app`)

**Sua URL Railway:**
```
https://projetofrtsapp-production.up.railway.app
```

---

## 📍 **PASSO 3: Vercel Frontend (5 min)**

### Instruções rápidas:

1. Abra: https://vercel.com
2. Login com **GitHub**
3. **Add New** → **Project**
4. Selecione: **PROJETO_FRTS_APP**
5. Configure:
   - Framework: Vite
   - Root Directory: `frontend/`
6. **Deploy** (aguarde...)
7. Quando pronto, vá para **Settings** → **Environment Variables**
8. Adicione:
   - **Name**: `VITE_API_URL`
   - **Value**: `sua-url-railway`
9. Vá para **Deployments**
10. Clique no último deploy → **Redeploy**

**Sua URL Vercel:**
```
https://seu-projeto.vercel.app
```

---

## 📍 **PASSO 4: Testar (5 min)**

### ✅ Teste 1: Login

1. Acesse: **https://seu-projeto.vercel.app/login**
2. Email: `demo@fortesolar.com.br`
3. Senha: `demo123`
4. Clique **"Entrar no Sistema"**
5. ✅ Deve entrar no dashboard

### ✅ Teste 2: Reset de Senha

1. Volte para login
2. Clique **"Esqueci a senha?"**
3. Digite um email
4. Clique **"Enviar Link de Reset"**
5. ✅ Deve mostrar mensagem verde

### ✅ Teste 3: Calculadora

1. Acesse: **https://seu-projeto.vercel.app/calculadora**
2. Preencha:
   - Nome: João Silva
   - Email: joao@email.com
   - Telefone: (84) 99999-9999
   - Consumo: 250 kWh
3. Clique **"Calcular e Enviar"**
4. ✅ Deve aparecer resultado

### ✅ Teste 4: MongoDB

1. Acesse MongoDB Atlas
2. Vá para **Collections**
3. Clique em **forte-solar**
4. Veja se há uma coleção chamada **leads**
5. ✅ Deve ter o registro do teste

---

## 🎉 **PRONTO!**

Se tudo passou nos testes, seu sistema está **100% FUNCIONANDO** em produção!

---

## ❌ **Se algo não funcionar...**

### Login diz "Erro ao conectar"
- [ ] Verifique `VITE_API_URL` no Vercel
- [ ] Verifique se Railway está com status verde
- [ ] Aguarde 1-2 min e recarregue

### MongoDB não conecta
- [ ] Verifique IP whitelist em MongoDB Atlas
- [ ] Verifique credenciais em Railway Variables
- [ ] Copie a connection string novamente

### Calculadora não envia
- [ ] Verifique console do navegador (F12)
- [ ] Verifique se Railway está online
- [ ] Tente novamente após 30 segundos

**HELP:** Leia `PRODUCAO_SETUP.md` para troubleshooting completo

---

## 📞 **Links Úteis**

- 🗄️ MongoDB Atlas: https://www.mongodb.com/cloud/atlas
- 🚀 Railway: https://railway.app
- ▲ Vercel: https://vercel.com
- 📖 Documentação: `PRODUCAO_SETUP.md`
- 📊 Status: `RESUMO_STATUS_MAIO_2026.md`
- 💻 GitHub: https://github.com/carlosrenatoalcantara-debug/PROJETO_FRTS_APP

---

**Tempo esperado: 25 minutos**  
**Dificuldade: ⭐ Muito Fácil**  
**Resultado: Sistema 100% ONLINE** 🚀

Boa sorte! 💪

