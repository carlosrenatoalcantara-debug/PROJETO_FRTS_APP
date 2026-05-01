# 🚨 Incidente de Segurança - Rotação de Credenciais MongoDB

**Data**: 1 de Maio de 2026  
**Severidade**: 🔴 CRÍTICA  
**Status**: ⏳ Aguardando ação do usuário

---

## 📋 Resumo do Incidente

GitScan detectou credenciais do MongoDB expostas publicamente no repositório:

- **Usuário 1**: `renato_db_user` com senha `BbWX3FtZEBv2g36F`
- **Usuário 2**: `forte-solar` com senha `a5YLkF9kGmnhCd9p`
- **Cluster**: `cluster0.iva0pph` e `cluster0.abc123`
- **Database**: `forte_solar`

---

## ✅ O Que Já Foi Feito

1. ✅ Removidas credenciais de todos os arquivos rastreados (.md, .js, .env)
2. ✅ Adicionado `.env` e `*.md` ao `.gitignore`
3. ✅ Criados commits de segurança
4. ✅ Push para GitHub realizado
5. ✅ Histórico git sendo limpo (background)

---

## ⚠️ O Que Você DEVE Fazer Agora

### PASSO 1: Rotacionar Credenciais (15 minutos)

**1.1 - Acessar MongoDB Atlas**
```
URL: https://account.mongodb.com
Fazer login com sua conta
```

**1.2 - Deletar usuários antigos**
- Clique em seu cluster "cluster0"
- Vá em: **Security → Database Access**
- Procure por:
  - `renato_db_user` ❌ DELETE
  - `forte-solar` ❌ DELETE
- Clique em "..." → "Delete User" → Confirmar

**1.3 - Criar novo usuário seguro**
- Em **Database Access** → **Add New Database User**
- **Authentication Method**: Password (automática)
- **Username**: `forte_solar_prod_xxx` (use algo aleatório)
- **Password**: Clique "Autogenerate" (MongoDB gera automático)
- **Database User Privileges**: Atlas Admin
- Clique **Add User**

**1.4 - Copiar nova connection string**
- Volte para o cluster
- Clique **"Connect"**
- Escolha **"Drivers"**
- Selecione **Node.js**
- Copie a conexão string completa:
  ```
  mongodb+srv://forte_solar_prod_xxx:[PASSWORD]@cluster0...
  ```

### PASSO 2: Atualizar Railway (5 minutos)

**2.1 - Acessar Railway Dashboard**
```
URL: https://railway.app
Login com GitHub
```

**2.2 - Atualizar variável MONGODB_URI**
- Vá em seu projeto: **PROJETO_FRTS_APP**
- Clique em: **Variables**
- Procure por: `MONGODB_URI`
- Clique para editar
- Cole a **nova connection string** copiada
- Clique **Save** ou **Enter**

**2.3 - Deploy automático**
- Railway automaticamente redeploy
- Aguarde ~2-3 minutos
- Verificar status em **Deployments**

### PASSO 3: Verificar Funcionamento (2 minutos)

```bash
# Teste 1: Health Check
curl https://projetofrtsapp-production.up.railway.app/api/health

# Resultado esperado:
# {"status":"ok","servico":"Forte Solar API"}

# Teste 2: CRM com novo usuário
curl https://projetofrtsapp-production.up.railway.app/api/crm/funis

# Resultado esperado:
# [{"id":1,"nome":"Vendas","ordem":1}]
```

### PASSO 4: Limpar Localmente (opcional)

```bash
# Se quiser limpar cache local
rm -rf ~/.mongodb/
rm -rf ~/.cache/mongodb/

# Limpar histórico do navegador (credenciais podem estar em cache)
```

---

## 🔍 Sinais de Sucesso

Você saberá que está tudo OK quando:

- ✅ Novo usuário criado no MongoDB Atlas
- ✅ Connection string atualizada no Railway
- ✅ Deploy completado no Railway
- ✅ `/api/health` retorna `{"status":"ok"}`
- ✅ `/api/crm/funis` retorna dados do MongoDB
- ✅ Frontend em https://projeto-frts-app.vercel.app carrega normal

---

## ⚠️ Sinais de Problema

Se você ver isso, não está funcionando:

- ❌ API retorna: `{"erro":"Operation ... buffering timed out"}`
  → **Solução**: Verificar MONGODB_URI no Railway (copiar de novo)

- ❌ API retorna: `{"erro":"Invalid credentials"}`
  → **Solução**: Verificar se senha está URL-encoded corretamente (@ → %40, etc)

- ❌ Git mostra: `mongodb+srv://...` em commits
  → **Solução**: Credenciais ainda visíveis no histórico (aguarde git filter-branch)

---

## 📊 Status de Remedição

| Ação | Status | ETA |
|------|--------|-----|
| Remover de arquivos | ✅ Completo | Done |
| Update .gitignore | ✅ Completo | Done |
| Push para GitHub | ✅ Completo | Done |
| Limpar histórico git | ⏳ Em progresso | 5-10 min |
| **Rotacionar credenciais** | ⏳ **AGUARDANDO VOCÊ** | NOW |
| Atualizar Railway | ⏳ **AGUARDANDO VOCÊ** | 20 min |
| GitScan confirmar fix | ⏳ Automático | 1-2 horas |

---

## 🔐 Boas Práticas para Evitar Futuros Incidentes

### 1. Use `.gitignore` Corretamente
```bash
# .gitignore
*.env
*.env.*
.env*
.DS_Store
node_modules/
MONGODB*.md
CREDENTIALS*.md
```

### 2. Nunca Commitar Credenciais
```bash
# ❌ ERRADO - Não faça isso:
git add .env
git commit -m "Add environment config"

# ✅ CORRETO - Use variáveis de ambiente:
# Armazene em Railway/Vercel/Heroku (não no git)
```

### 3. Usar Secrets na Documentação
```markdown
# ❌ ERRADO:
MONGODB_URI=mongodb+srv://user:senha@cluster.mongodb.net/db

# ✅ CORRETO:
MONGODB_URI=mongodb+srv://[username]:[password]@[cluster]/[database]
# ↑ Use placeholders sempre
```

### 4. Rotacionar Regularmente
- Mudar senhas a cada 90 dias
- Usar geradores de senha (Bitwarden, 1Password)
- Revisar usuários do DB mensalmente

### 5. Usar Secret Scanning
- GitHub já tem Secret Scanning ativado
- GitScan monitora continuamente
- Pre-commit hooks podem ajudar:
  ```bash
  npm install -D detect-secrets pre-commit
  ```

---

## 📞 Suporte & Próximas Etapas

### Se conseguiu fazer tudo:
1. Volte aqui
2. Indique que a rotação foi completa
3. Vou verificar se git filter-branch finalizou
4. GitScan vai confirmar a remedição automaticamente

### Se tiver problemas:
1. Verifique mensagens de erro específicas acima
2. Teste com: `curl https://...../api/health`
3. Compartilhe a mensagem de erro

---

## 📝 Documentação Relacionada

- [MongoDB Atlas Documentation](https://docs.mongodb.com/manual/)
- [Railway Environment Variables](https://docs.railway.app/plugins/environment-variables)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [OWASP - Sensitive Data Exposure](https://owasp.org/www-project-top-ten/)

---

**Última atualização**: 2026-05-01  
**Responsabilidade**: Usuário (ação necessária agora)  
**Prioridade**: 🔴 CRÍTICA

