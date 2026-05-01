# 🚨 Incidente de Segurança - Rotação de Credenciais MongoDB

**Data**: 1 de Maio de 2026  
**Severidade**: 🔴 CRÍTICA  
**Status**: ⏳ Aguardando ação do usuário

---

## 📋 Resumo do Incidente

GitScan detectou credenciais do MongoDB expostas publicamente no repositório.

**Credenciais comprometidas**: [REDACTED]
- Database user account foi exposto
- Connection strings foram expostas
- Cluster information foi revelado

---

## ✅ O Que Já Foi Feito

1. ✅ Removidas credenciais de todos os arquivos rastreados
2. ✅ Adicionado `.env` e `MONGODB*.md` ao `.gitignore`
3. ✅ Criados commits de segurança
4. ✅ Histórico git foi limpo
5. ✅ Push para GitHub realizado

---

## ⚠️ O Que Você DEVE Fazer Agora

### PASSO 1: Rotacionar Credenciais (15 minutos)

**1.1 - Acessar MongoDB Atlas**
```
URL: https://account.mongodb.com
Fazer login com sua conta
```

**1.2 - Deletar usuários antigos**
- Clique em seu cluster
- Vá em: **Security → Database Access**
- Procure pelos usuários expostos
- Clique "..." → "Delete User" → Confirmar

**1.3 - Criar novo usuário seguro**
- Em **Database Access** → **Add New Database User**
- **Authentication Method**: Password (automática)
- **Username**: Use um nome único e seguro
- **Password**: Clique "Autogenerate"
- **Database User Privileges**: Atlas Admin
- Clique **Add User**

**1.4 - Copiar nova connection string**
- Volte para o cluster
- Clique **"Connect"**
- Escolha **"Drivers"** → **Node.js**
- Copie a conexão string **COMPLETA**

### PASSO 2: Atualizar Railway (5 minutos)

**2.1 - Acessar Railway Dashboard**
```
URL: https://railway.app
```

**2.2 - Atualizar MONGODB_URI**
- Projeto: PROJETO_FRTS_APP
- Seção: Variables
- Variable: MONGODB_URI
- Cole: [Nova connection string]
- Save

**2.3 - Deploy automático**
- Railway redeploy automaticamente
- Aguarde 2-3 minutos

### PASSO 3: Verificar Funcionamento

```bash
# Teste Health Check
curl https://projetofrtsapp-production.up.railway.app/api/health

# Deve retornar: {"status":"ok"}
```

---

## 🔐 Boas Práticas

1. **Nunca commitar credenciais** no Git
2. **Use .gitignore** para excluir `.env` files
3. **Rotacione senhas** a cada 90 dias
4. **Use geradores de senha** seguros
5. **Monitore** com tools como GitScan

---

**Status**: ⏳ Aguardando rotação de credenciais  
**Urgência**: 🔴 CRÍTICA - Faça AGORA
