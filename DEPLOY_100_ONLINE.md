# 🚀 FORTE SOLAR - DEPLOY 100% ONLINE

## STATUS ATUAL ✅
```
Backend Local:   http://localhost:3000 ✅ RODANDO
Frontend Local:  http://localhost:5173 ✅ RODANDO
Sistema:         PRONTO PARA DEPLOY NA NUVEM
```

---

## 🎯 OPÇÃO RECOMENDADA: Railway.app (Mais Rápido)

Railway.app é a forma **mais rápida e fácil** para colocar seu sistema 100% online!

### ⏱️ Tempo Total: ~10 minutos

### Passo 1: Preparar GitHub (5 minutos)

```bash
# Se ainda não tem GitHub, crie em https://github.com/signup

# Inicialize git no projeto (se não estiver)
cd C:\Users\Forte Solar\PROJETO_FRTS_APP
git init
git add .
git commit -m "Forte Solar - Ready for production deployment"

# Se não tem repo remoto, crie em GitHub:
# 1. Vá para https://github.com/new
# 2. Nome: "Forte-Solar-App"
# 3. Privado (recomendado)
# 4. Clique "Create repository"
# 5. Siga as instruções para conectar seu repo local

git remote add origin https://github.com/SEU_USUARIO/Forte-Solar-App.git
git branch -M main
git push -u origin main
```

### Passo 2: Deploy em Railway (5 minutos)

1. **Acesse:** https://railway.app
2. **Clique em:** "Login" → "Login with GitHub"
3. **Autorize** o acesso ao Railway
4. **Clique em:** "New Project"
5. **Selecione:** "Deploy from GitHub repo"
6. **Escolha:** seu repositório "Forte-Solar-App"
7. **Railway faz deploy automático** 🎉

### Passo 3: Configurar Variáveis de Ambiente

Após o deploy inicial (pode falhar sem as variáveis):

1. **No Railway Dashboard:**
   - Vá para seu projeto
   - Clique na aba "Variables"
   - Adicione as seguintes variáveis:

```
NODE_ENV = production
PORT = 3000
ENCRYPTION_KEY = (copie de backend/.env)
JWT_SECRET = (copie de backend/.env)
JWT_REFRESH_SECRET = (copie de backend/.env)
MONGODB_URI = (sua URI do MongoDB Atlas)
FRONTEND_URL = https://seu-app.railway.app
```

2. **Clique em:** "Deploy" → esperará o redeploy automático

### Passo 4: Acessar Seu App Online

Railway vai gerar uma URL automáticamente:
```
https://seu-app-xxxxx.railway.app
```

Você verá no Dashboard uma URL como: `https://seu-projeto-xxxxx.railway.app`

**Acesse e veja seu Forte Solar 100% ONLINE!** 🌍

---

## 🔐 Configurar MongoDB Atlas para Produção

MongoDB Atlas precisa de acesso de rede:

1. **Vá para:** https://cloud.mongodb.com
2. **Seu Cluster** → "Network Access"
3. **Clique em:** "Add IP Address"
4. **Selecione:** "Allow access from anywhere" (0.0.0.0/0)
5. **Confirme**

⚠️ **SEGURANÇA:** Em produção, use IP whitelist específicos ao invés de "anywhere"

---

## 📊 URLs Após Deploy

Depois que estiver online em Railway:

| Serviço | URL |
|---------|-----|
| **Aplicação Completa** | https://seu-app-xxxxx.railway.app |
| **API Backend** | https://seu-app-xxxxx.railway.app/api |
| **Health Check** | https://seu-app-xxxxx.railway.app/api/health |
| **Login** | https://seu-app-xxxxx.railway.app/api/auth/login |
| **Integrações** | https://seu-app-xxxxx.railway.app/api/integrations |

---

## 🧪 Testar Após Deploy

```bash
# Verificar que está online
curl https://seu-app-xxxxx.railway.app/api/health

# Fazer login
curl -X POST https://seu-app-xxxxx.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@fortesolar.com.br",
    "password": "DemoPass123!"
  }'

# Listar chaves de API
curl https://seu-app-xxxxx.railway.app/api/integrations/keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🆘 Se Não Funcionar

**Verificar Logs do Railway:**
1. Vá para seu projeto no Railway
2. Clique na aba "Logs"
3. Procure por erros (vermelho)
4. Erro comum: "Cannot find module" → execute `npm install` no projeto local e faça push

**Redeploy Manual:**
1. Vá para "Deployments"
2. Clique no botão "Trigger Deploy" no topo

---

## 💡 Próximos Passos

Agora que está online:

1. **Domínio Personalizado** (opcional)
   - Railway permite conectar domínios próprios
   - Vá para "Settings" → "Domains"

2. **CI/CD Automático**
   - Cada push para GitHub dispara novo deploy
   - Sem necessidade de ações manuais

3. **Monitoramento**
   - Railway mostra logs e métricas
   - Configure alertas para erros

---

## 🎉 Pronto!

Seu Forte Solar agora está **100% ONLINE** e acessível para qualquer pessoa no mundo! 🌍

**URL:** https://seu-app-xxxxx.railway.app

---

**Alternativas se Railway não funcionar:**

### Render.com
```
Vá para https://render.com
- New Web Service
- Conecte GitHub
- Build: npm install
- Start: node backend/src/server.js
- Deploy!
```

### Vercel + Railway (Separado)
```
Frontend em Vercel (https://vercel.com):
- Deploy só a pasta frontend/dist
- Grátis e muito rápido

Backend em Railway:
- Deploy conforme acima
- Configure CORS para frontend Vercel
```

---

**Última atualização:** 2026-05-15  
**Status:** 🚀 PRONTO PARA DEPLOY
