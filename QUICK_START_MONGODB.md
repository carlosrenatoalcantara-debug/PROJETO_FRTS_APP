# ⚡ Quick Start - MongoDB Forte Solar

**Tempo:** 5 minutos para começar  
**Pré-requisito:** MongoDB instalado OU conta Atlas

---

## 🔥 INICIAR EM 5 MINUTOS

### Step 1: Escolher MongoDB (1 minuto)

#### Opção A: Local (Windows)
```powershell
# Admin PowerShell:
net start MongoDB
```

#### Opção B: Local (macOS)
```bash
brew services start mongodb-community
```

#### Opção C: Cloud (MongoDB Atlas)
1. Acesse: https://www.mongodb.com/cloud/atlas
2. Crie conta gratuita
3. Copie connection string
4. Cole em `backend/.env`:
```
MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/forte_solar
```

### Step 2: Verificar conexão (1 minuto)
```bash
# Local:
mongosh
> db.version()
```

### Step 3: Popular banco (1 minuto)
```bash
cd backend
npm run seed
```

### Step 4: Iniciar backend (1 minuto)
```bash
npm run dev
```

### Step 5: Testar (1 minuto)
```bash
curl http://localhost:5000/api/clientes
# Deve retornar: [{"_id":"...","nome":"João Silva",...}]
```

---

## ✅ PRONTO!

Sistema funcionando com dados persistidos!

---

## 📚 DOCUMENTAÇÃO

- `MONGODB_SETUP.md` - Instalação detalhada
- `MONGODB_IMPLEMENTACAO.md` - Detalhes técnicos
- `IMPLEMENTACAO_MONGODB_RESUMO.md` - Resumo completo

---

## 🆘 PROBLEMAS?

### Erro: "ECONNREFUSED localhost:27017"
→ MongoDB não está rodando. Execute `mongod` ou `net start MongoDB`

### Erro: "Cannot find module mongoose"
→ Execute `npm install mongoose` no backend

### Dados vazios após npm run seed
→ Espere 2-3 segundos, MongoDB é assíncrono

### Frontend mostra erro de ID
→ Mudar `cliente.id` para `cliente._id` no React

---

## 🎯 O QUE FOI IMPLEMENTADO

✅ MongoDB com 6 models  
✅ Controllers atualizados (Clientes, Projetos)  
✅ Seed com dados iniciais  
✅ API 100% compatível  
✅ Documentação completa

**Antes:** Dados perdidos ao reiniciar  
**Depois:** Dados persistidos em MongoDB ✨

---

**Próximo passo:** Atualizar frontend e depois implementar autenticação JWT!
