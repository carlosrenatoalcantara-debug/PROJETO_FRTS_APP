# 🚀 Como Executar o Setup de Credenciais

## Windows

### Opção 1: Usar Script Batch (Mais Fácil) ⭐
```bash
# Duplo clique em EXECUTE_SETUP.bat
# Ou abra PowerShell e execute:
.\EXECUTE_SETUP.bat
```

### Opção 2: Linha de Comando
```bash
# Abrir PowerShell ou CMD
# Navegar para o diretório do projeto
cd C:\PROJETO_FRTS_APP

# Executar
node setup-credentials.js
```

---

## Mac / Linux

### Opção 1: Usar Script Shell
```bash
# Abrir Terminal
# Navegar para o projeto
cd ~/PROJETO_FRTS_APP

# Executar script
chmod +x execute-setup.sh
./execute-setup.sh
```

### Opção 2: Linha de Comando
```bash
cd ~/PROJETO_FRTS_APP
node setup-credentials.js
```

---

## 📋 O Que o Script Faz

```
1️⃣ Pergunta: MongoDB local ou Atlas (nuvem)?
   └─ Digite: a (Atlas) ou b (Local)

2️⃣ Se escolher Atlas:
   └─ Pede a Connection String do MongoDB Atlas
   └─ Exemplo: mongodb+srv://usuario:senha@cluster.mongodb.net/banco

3️⃣ Pergunta outras variáveis:
   └─ Admin API Key (pressione Enter para padrão)
   └─ Frontend URL (pressione Enter para padrão)

4️⃣ Mostra resumo das configurações
   └─ Confirma: s (sim) ou n (não)

5️⃣ Testa conexão com MongoDB
   └─ Pergunta: Deseja testar? (s/n)
   └─ Conecta ao MongoDB e valida

6️⃣ Cria arquivo .env.production
   └─ Pronto para usar!
```

---

## 🎯 Respostas Sugeridas

### Para Desenvolvimento Local

```
Escolha (a ou b): b
↓
✅ Arquivo será criado para: mongodb://localhost:27017/forte_solar
```

### Para Produção com MongoDB Atlas

```
Escolha (a ou b): a
↓
Você tem a Connection String? (s/n): s
↓
Connection String: mongodb+srv://seu-user:sua-senha@cluster0.abc123.mongodb.net/forte_solar
↓
Admin API Key (Enter para padrão): [Enter]
↓
Frontend URL (Enter para padrão): [Enter]
↓
Confirmar? (s/n): s
↓
Testar conexão? (s/n): s
↓
✅ Pronto!
```

---

## 📋 Obter Connection String do MongoDB Atlas

### Passo 1: Criar Conta (Grátis)
1. Ir para [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Clique "Try Free"
3. Registre com seu email
4. Confirme email

### Passo 2: Criar Cluster
1. Dashboard → "Build a Deployment"
2. Escolha **M0 (Free)**
3. Selecione região: **São Paulo (sa-east-1)**
4. Clique "Create Deployment"
5. Aguarde 3-5 minutos até ficar **RUNNING** (verde)

### Passo 3: Criar Usuário
1. Vá para **Security → Database Access**
2. Clique "Add New Database User"
3. **Username**: `forte-solar`
4. **Password**: Clique "Autogenerate"
5. Copie a senha gerada
6. Clique "Add User"

### Passo 4: IP Whitelist
1. Vá para **Security → Network Access**
2. Clique "Add IP Address"
3. Para desenvolvimento: "Allow Access from Anywhere"
4. Para produção: Seu IP específico
5. Clique "Add Entry"

### Passo 5: Connection String
1. Volte ao cluster, clique **"Connect"**
2. Escolha **"Drivers"**
3. Selecione **Node.js**
4. **Copie a connection string**:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
   ```

### Passo 6: Substituir Placeholders
- `<username>` = `forte-solar`
- `<password>` = A senha que copiou (URL encode se tiver @, !, etc)
- `<cluster>` = Nome do cluster (ex: cluster0)
- `<database>` = `forte_solar`

**Exemplo Final:**
```
mongodb+srv://forte-solar:minhaSenha123@cluster0.abc123.mongodb.net/forte_solar?retryWrites=true&w=majority
```

---

## ✅ Depois do Setup

O script vai criar arquivo: `backend/.env.production`

**Verificar se foi criado:**

Windows:
```bash
dir backend\.env.production
```

Mac/Linux:
```bash
ls -la backend/.env.production
```

**Testar localmente:**
```bash
cd backend
NODE_ENV=production npm start
```

Deve exibir:
```
✅ MongoDB conectado com sucesso
✓ Funis "Vendas" criado
✅ CRM inicializado com sucesso
✅ Tarefas de manutenção agendadas com sucesso
✅ Forte Solar API rodando em http://localhost:5005
```

---

## 🆘 Problemas

### Script não encontra arquivo
```bash
# Certifique-se de estar no diretório correto
pwd  # Mac/Linux
cd   # Windows

# Deve estar em: C:\PROJETO_FRTS_APP ou ~/PROJETO_FRTS_APP
```

### Node.js não encontrado
```bash
# Instalar Node.js em https://nodejs.org/
# Verificar: node --version
```

### MongoDB Atlas não funciona
1. Aguarde 5+ minutos após criar cluster
2. Verifique IP whitelist
3. Verifique username/password corretos
4. Teste com mongosh: `mongosh "seu-connection-string"`

---

## 🎯 Próximo Passo

Depois que o setup estiver completo:

```bash
# Testar localmente
cd backend
NODE_ENV=production npm start

# Se funcionar, fazer deploy
node deploy-cloud.js
```

---

**Status**: 🟢 Pronto para executar!  
**Comando**: `node setup-credentials.js` (ou use o script .bat/.sh)
