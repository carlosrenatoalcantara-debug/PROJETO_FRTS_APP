# 🚨 DEPLOY URGENTE: Limpeza de "Desconhecido" em Produção

**Status**: A produção ainda tem equipamentos "Desconhecido"  
**Solução**: Deploy de novo controller + chamada de API  
**Tempo estimado**: 5-10 minutos

---

## 🎯 Plano de Ação

### PASSO 1: Committar e Fazer Deploy (5 minutos)

```bash
# 1. Verificar mudanças
git status

# 2. Adicionar novos arquivos
git add backend/src/controllers/limpezaDesconhecidosController.js
git add backend/src/routes/admin.js
git add backend/executar-limpeza-producao.mjs
git add backend/data/memory-storage.json

# 3. Fazer commit
git commit -m "Implementação de endpoints para limpeza de equipamentos Desconhecido

- Novo controller: limpezaDesconhecidosController.js
- Endpoints: POST /api/admin/limpar-desconhecidos, GET /api/admin/status-limpeza
- Script de execução: executar-limpeza-producao.mjs
- Memory storage atualizado com equipamentos limpos"

# 4. Push para produção
git push origin main
```

**Aguarde**: Railway detectará o push e fará deploy automático (~1-2 minutos)

---

### PASSO 2: Executar Limpeza via API (2 minutos)

Após deploy estar completo, escolha uma opção:

#### Opção A: Usar o Script (Recomendado)
```bash
node executar-limpeza-producao.mjs producao
```

Resultado esperado:
```
📊 VERIFICANDO STATUS ANTES...
Status: ⚠️ SUJO
Total: 1500
Desconhecido: 847

🗑️  EXECUTANDO LIMPEZA...
✅ 847 equipamentos removidos!

📊 RESULTADO FINAL:
   Total antes: 1500
   Total depois: 653
   Removidos: 847
   Desconhecido restante: 0

🎉 LIMPEZA CONCLUÍDA COM SUCESSO!
```

#### Opção B: Usar curl Direto
```bash
curl -X POST https://projetofrtsapp-production.up.railway.app/api/admin/limpar-desconhecidos \
  -H "x-admin-key: d0924b3f2572beb416b1b0c9fbe3c1d4cefb6b03a3b4638e6a47956959238293" \
  -H "Content-Type: application/json"
```

#### Opção C: Usar Postman
1. Abrir Postman
2. Nova requisição POST
3. URL: `https://projetofrtsapp-production.up.railway.app/api/admin/limpar-desconhecidos`
4. Headers:
   - `x-admin-key`: (copie de .env ADMIN_API_KEY)
   - `Content-Type`: application/json
5. Click Send

---

### PASSO 3: Verificar Resultado (1 minuto)

#### Via Script
```bash
node executar-limpeza-producao.mjs producao
```

#### Via Browser
- Acessar: https://projeto-frts-app.vercel.app/equipamentos/inversores
- Aguardar ~5 minutos para cache expirar
- Verificar que "Desconhecido" desapareceu

#### Via API
```bash
curl https://projetofrtsapp-production.up.railway.app/api/admin/status-limpeza
```

Resultado esperado:
```json
{
  "status": "✅ LIMPO",
  "resumo": {
    "total": 653,
    "desconhecido": 0,
    "percentual_desconhecido": "0.00%"
  }
}
```

---

## 📋 Mudanças Realizadas

### 1. Novo Controller: `limpezaDesconhecidosController.js`
- Função `limparDesconhecidos()` - remove equipamentos "Desconhecido"
- Função `statusLimpeza()` - mostra status da limpeza
- Requer ADMIN_API_KEY para limpar
- Status público (sem autenticação)

### 2. Atualização de Rotas: `admin.js`
- POST `/api/admin/limpar-desconhecidos` - executa limpeza
- GET `/api/admin/status-limpeza` - verifica status

### 3. Script de Execução: `executar-limpeza-producao.mjs`
- Conecta ao backend de produção
- Verifica status ANTES
- Executa limpeza com admin key
- Mostra resultado DEPOIS

### 4. Memory Storage Atualizado
- Adicionados 9 equipamentos limpos
- Para usar como fallback quando MongoDB offline

---

## 🔒 Segurança

- ✅ Endpoint requer ADMIN_API_KEY
- ✅ ADMIN_API_KEY está em .env (não no código)
- ✅ Status público (sem key) para monitoramento
- ✅ Logs detalhados para auditoria

---

## ⏱️ Cronograma

| Tempo | Ação | Status |
|-------|------|--------|
| 0:00 | Commit e Push | ⏳ Fazendo |
| 1:00 | Deploy em Railway | ⏳ Automático |
| 2:00 | Chamar API de limpeza | 🔜 Próximo |
| 2:30 | Verificar status | 🔜 Próximo |
| 7:30 | Cache Vercel expirar | 🔜 Próximo |
| 7:35 | Frontend atualizado | ✅ Esperado |

---

## 🆘 Se Algo der Errado

### Erro: "Acesso negado - chave admin inválida"
→ Verifique se está usando ADMIN_API_KEY correta de .env

### Erro: "Backend não está acessível"
→ Verifique se Railway deployment foi concluído
→ Acesse: https://railway.app (check deploy status)

### Frontend ainda mostra "Desconhecido" após 10 minutos
→ Force clear cache do Vercel:
  - Acesse: https://vercel.com/dashboard
  - Selecione projeto
  - Redeploy

### Preciso reverter?
```bash
git revert HEAD
git push origin main
```

---

## ✅ Checklist

- [ ] Commit realizado com sucesso
- [ ] Push concluído
- [ ] Deploy em Railway ativado (check status)
- [ ] Aguardou ~2 minutos (deploy)
- [ ] Executou `node executar-limpeza-producao.mjs producao`
- [ ] Limpeza mostrou "Removidos: X"
- [ ] Status mostrou "Desconhecido: 0"
- [ ] Aguardou ~5-10 minutos
- [ ] Frontend atualizado (sem "Desconhecido")
- [ ] ✅ PRONTO!

---

## 📞 Referência Rápida

```bash
# Ver mudanças pendentes
git status

# Fazer commit
git commit -m "Limpeza de Desconhecido em produção"

# Fazer push (dispara deploy)
git push origin main

# Executar limpeza após deploy
node executar-limpeza-producao.mjs producao

# Verificar status
curl https://projetofrtsapp-production.up.railway.app/api/admin/status-limpeza
```

---

## 🎉 Sucesso!

Após completar todos os passos:
- ✅ Banco de dados limpo (0 "Desconhecido")
- ✅ Frontend atualizado
- ✅ Produção funcionando perfeitamente
- ✅ Memory storage configurado como fallback
