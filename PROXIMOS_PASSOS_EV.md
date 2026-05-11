# 🚀 Próximos Passos - Sistema EV

**Você terminou a implementação. Agora siga estas etapas para testar e fazer deploy.**

---

## 1️⃣ Teste Local (30 min)

### Iniciar Backend
```bash
cd backend
npm start
# Aguarde até ver: "✅ Forte Solar API rodando em http://localhost:5001"
```

### Inicializar Banco de Carregadores
```bash
curl -X POST http://localhost:5001/api/carregadores-ev/seed/inicializar
# Resposta esperada: { "msg": "Banco inicializado com sucesso", "total": 13 }
```

### Iniciar Frontend (outro terminal)
```bash
cd frontend
npm run dev
# Acesse: http://localhost:5173 (ou outra porta indicada)
```

### Testar Fluxo
1. Faça login: `demo@fortesolar.com.br` / `demo123`
2. Vá para: **Projetos → Elétrico-Veicular**
3. Clique: **Novo Projeto EV**
4. Siga as 4 etapas:
   - **Etapa 1:** Preencha dados do projeto
   - **Etapa 2:** Selecione 1-3 carregadores
   - **Etapa 3:** Veja cálculos NBR 5410 automáticos
   - **Etapa 4:** Visualize unifilar
5. Baixe unifilar em PNG

---

## 2️⃣ Configurar MongoDB Atlas (5 min)

Siga os 4 passos em **AMANHA_COMECE_AQUI.md**:

1. Abra https://www.mongodb.com/cloud/atlas
2. Crie cluster gratuito "forte-solar"
3. Crie usuário `forte_solar` com senha forte
4. Copie connection string

### Exemplo:
```
mongodb+srv://forte_solar:sua_senha@cluster0.xyz.mongodb.net/forte-solar?retryWrites=true&w=majority
```

---

## 3️⃣ Deploy Backend no Railway (10 min)

### Pré-requisitos
- Conta Railway.app
- GitHub conectado

### Passos
1. Acesse https://railway.app
2. Clique: **New Project → Deploy from GitHub repo**
3. Selecione: **PROJETO_FRTS_APP**
4. Configure variáveis de ambiente:

```env
NODE_ENV=production
PORT=5000
JWT_SECRET=gere-com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
MONGODB_URI=sua_string_mongodb
FRONTEND_URL=https://seu-projeto.vercel.app
```

5. Deploy automático!
6. Copie URL do Railway: `https://projetofrtsapp-production.up.railway.app`

### Testar
```bash
curl https://seu-backend.up.railway.app/api/health
# Resposta: {"status":"ok","servico":"Forte Solar API", ...}
```

---

## 4️⃣ Deploy Frontend no Vercel (5 min)

### Pré-requisitos
- Conta Vercel
- GitHub conectado

### Passos
1. Acesse https://vercel.com
2. Clique: **Add New → Project**
3. Selecione: **PROJETO_FRTS_APP**
4. Configure:
   - **Framework:** Vite
   - **Root Directory:** `frontend/`
5. Variáveis de ambiente:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://seu-backend.up.railway.app`
6. Deploy automático!

### Testar
```
https://seu-projeto.vercel.app/projetos-ev
```

---

## 5️⃣ Testar em Produção (10 min)

### 1. Testar Login
- Acesse: `https://seu-projeto.vercel.app/login`
- Login: `demo@fortesolar.com.br` / `demo123`
- ✅ Deve entrar no dashboard

### 2. Testar Nova Proposta EV
- Vá para: **Projetos → Elétrico-Veicular**
- Clique: **Novo Projeto EV**
- Preencha 4 etapas:
  - Nome: `Teste Produção`
  - Cliente: `Cliente Teste`
  - Endereço: `Rua Teste, 123`
  - Técnico: `Seu Nome`
  - CREA: `SP 123456/D`
- ✅ Deve gerar unifilar

### 3. Testar Cálculos
- Etapa 2: Selecione 1 carregador
  - Ex: ABB Terra AC 22kW (AC Trifásico)
- Etapa 3: Clique "Calcular Parâmetros NBR 5410"
- ✅ Deve mostrar 6 valores calculados

### 4. Testar Unifilar
- Etapa 4: Visualize SVG
- ✅ Deve mostrar diagrama + especificações
- Clique: **Baixar Unifilar**
- ✅ Deve fazer download em PNG

### 5. Verificar Banco de Dados
1. Acesse MongoDB Atlas
2. Vá para: **Collections → forte-solar**
3. Procure collection: **projetos_ev**
4. ✅ Deve ter seu projeto salvo

---

## 🔧 Troubleshooting

### "Erro ao conectar ao servidor"
**Causa:** VITE_API_URL incorreta no Vercel
**Solução:** 
1. Vai para Vercel Dashboard
2. Settings → Environment Variables
3. Verifique URL do Railway
4. Redeploy frontend

### "Carregadores não aparecem"
**Causa:** Seed não foi executado
**Solução:**
```bash
curl -X POST https://seu-backend.up.railway.app/api/carregadores-ev/seed/inicializar
```

### "MongoDB connection refused"
**Causa:** IP não está whitelistado ou conexão inválida
**Solução:**
1. MongoDB Atlas → Network Access
2. Adicione: **Allow Access from Anywhere** (0.0.0.0/0)
3. Ou especifique IPs de Railway

### Unifilar não gera
**Causa:** Cálculos falharam
**Solução:**
1. Abra DevTools (F12)
2. Veja Console para erros
3. Recalcule

---

## 📊 Checklist Final

Antes de considerar pronto:

- [ ] MongoDB Atlas criado e conectando
- [ ] Railway backend deployado e respondendo
- [ ] Vercel frontend deployado e acessível
- [ ] Carregadores inicializados (13 no total)
- [ ] Login funcionando em produção
- [ ] Nova Proposta EV acessível
- [ ] Cálculos NBR 5410 automáticos
- [ ] Unifilar gerado com sucesso
- [ ] Projeto salvo no MongoDB
- [ ] Download de unifilar funciona

---

## 🎉 Pronto!

Quando todos os itens estiverem marcados, seu **Sistema EV está 100% em produção** e pronto para usar!

---

## 💡 Dicas Importantes

1. **Senha Forte MongoDB:**
   - Use: `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"`
   - Mínimo 8 caracteres, 1 uppercase, 1 number, 1 special char

2. **JWT Secret:**
   - Use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Deve ser igual em todos os ambientes

3. **Variáveis de Ambiente:**
   - Nunca commitar .env em produção
   - Usar secrets no Railway/Vercel

4. **Segurança:**
   - Trocar demo@fortesolar.com.br antes do cliente usar
   - Implementar rate limiting
   - Usar HTTPS (Railway/Vercel já fazem isso)

5. **Testes:**
   - Testar em múltiplos navegadores
   - Testar com diferentes carregadores
   - Validar cálculos com engenheiro

---

## 📞 Suporte

Se algo não funcionar:
1. Verificar logs no Railway: Dashboard → Deployments → View Logs
2. Verificar console do navegador (F12)
3. Verificar Network (F12 → Network)
4. Ler AMANHA_COMECE_AQUI.md e PRODUCAO_SETUP.md

---

**Tempo total estimado: 1 hora**

**Resultado: Sistema EV 100% em produção pronto para clientes!** 🚀
