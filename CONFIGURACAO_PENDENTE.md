# ⚠️ Configuração Pendente - ANTHROPIC_API_KEY

**Data**: 11 de Maio de 2026  
**Status**: ⏳ AGUARDANDO AÇÃO DO USUÁRIO  
**Prioridade**: 🔴 CRÍTICA

---

## 🔴 PROBLEMA

Os uploads de datasheets não estão funcionando porque **falta a chave ANTHROPIC_API_KEY**.

### Onde o Problema Aparece

1. ❌ **Equipamentos → Carregadores EV** (arrastar PDF)
2. ❌ **Cliente → Projeto EV → Etapa 2** (upload datasheet)
3. ❌ **Qualquer lugar que use Claude Vision**

### Por Que Falha?

O backend tenta chamar Claude Vision API mas não tem credenciais:

```javascript
// backend/src/controllers/carregadorEVController.js linha 82
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,  // ← UNDEFINED! ❌
})
```

---

## ✅ SOLUÇÃO

### Passo 1: Obter Chave Claude

1. Acesse: **https://console.anthropic.com/api_keys**
2. Faça login (email, Google, ou GitHub)
3. Clique em **"Create Key"**
4. Copie a chave (começa com `sk-ant-`)

### Passo 2: Configurar Localmente

Execute o script setup:

```bash
cd "C:\Users\Forte Solar\PROJETO_FRTS_APP"
node setup-anthropic-key.js
```

Será perguntado:
- Opção 1: Já tenho a chave → Cole aqui
- Opção 2: Preciso obter → Vai te redirecionar
- Opção 3: Como obter → Mostra instruções

### Passo 3: Configurar em Produção (Railway)

O script perguntará se quer configurar no Railway também.

**OU faça manualmente:**

1. Acesse: https://railway.app/dashboard
2. Selecione projeto **"projetofrtsapp-production"**
3. Abra aba **"Variables"**
4. Clique em **"Add Variable"**
5. Nome: `ANTHROPIC_API_KEY`
6. Valor: `sk-ant-...` (sua chave)
7. Clique em **"Deploy"**

---

## 📊 Após Configurar

### Local (Desenvolvimento)
```bash
cd backend
npm run dev

# Teste em http://localhost:5000/api/carregadores-ev/upload-datasheet
```

### Produção (Railway)
- Aguarde ~2-3 minutos para rebuild
- Teste em https://fortesolar.com.br
- Vá para Equipamentos → Carregadores EV
- Arraste um PDF

---

## 🧪 Como Testar

### Teste Local
```bash
# 1. Backend rodando
npm run dev

# 2. Via curl
curl -X POST http://localhost:5000/api/carregadores-ev/upload-datasheet \
  -H "Content-Type: application/json" \
  -d '{
    "pdfBase64": "JVBERi0xLjQKJeLj..."  # base64 de um PDF
  }'

# Resposta esperada:
{
  "sucesso": true,
  "carregador": {
    "marca": "ABB",
    "modelo": "Terra DC",
    "potencia_kw": 60,
    ...
  },
  "msg": "✅ Carregador extraído e adicionado com sucesso"
}
```

### Teste em Produção
1. Acesse https://fortesolar.com.br
2. Equipamentos → Carregadores EV
3. Arraste um PDF
4. Espere ~30-40 segundos
5. Veja o resultado em "Fila de processamento"

---

## 🔧 Troubleshooting

### ❌ "ANTHROPIC_API_KEY não definida"
```
→ .env não foi atualizado corretamente
→ Verifique: backend/.env tem ANTHROPIC_API_KEY=sk-ant-...?
→ Reinicie o servidor (npm run dev)
```

### ❌ "Erro 401: Invalid API Key"
```
→ Chave está inválida ou expirada
→ Gere uma nova em https://console.anthropic.com/api_keys
→ Verifique que começa com "sk-ant-"
```

### ❌ "Timeout - Claude Vision demorando muito"
```
→ Espere mais tempo (até 3 minutos para PDFs grandes)
→ Alguns PDFs criptografados não funcionam
→ Tente outro PDF como teste
```

### ❌ "Seu plano Claude não tem crédito"
```
→ Verifique em https://console.anthropic.com/account/billing/overview
→ A conta precisa ter créditos ou ser uma conta paga
→ Adicione um método de pagamento
```

---

## 📋 Checklist Final

- [ ] Obtive chave ANTHROPIC_API_KEY (sk-ant-...)
- [ ] Executei `node setup-anthropic-key.js`
- [ ] Configurei em .env local
- [ ] Configurei em Railway (produção)
- [ ] Reiniciei servidor local (npm run dev)
- [ ] Aguardei Railway deploy (~2-3 min)
- [ ] Testei upload em Equipamentos → Carregadores EV
- [ ] Testei upload em Cliente → Projeto EV → Etapa 2
- [ ] Dados foram extraídos e salvos no MongoDB
- [ ] Carregador aparece na lista de disponíveis

---

## 📞 Suporte

Se ainda não funcionar após configurar a chave:

1. Verifique logs do backend:
   ```bash
   # Terminal rodando npm run dev
   Procure por: "[EV Upload]" ou "Erro ao processar"
   ```

2. Verifique Railway logs:
   ```bash
   railway logs
   ```

3. Teste conexão com Claude:
   ```bash
   node backend/test-claude-vision.js ./seu-datasheet.pdf
   ```

---

**Status**: ⏳ Aguardando sua ação  
**Próxima revisão**: Após configurar chave e testar
