# ⚡ CLAUDE VISION - ÚLTIMO PASSO (Setup Final)

## 📊 Status Atual

✅ **Carregadores EV**: 56 cadastrados funcionando perfeitamente  
✅ **API Backend**: Deploy em produção no Railway  
✅ **Frontend**: Deploy em produção no Vercel  
✅ **Claude Vision**: Código implementado, funcionando localmente  
⏳ **PENDENTE**: Configurar chave API no Railway (2 minutos)

---

## 🎯 O QUE FALTA?

Adicionar uma única variável de ambiente no Railway:

```
ANTHROPIC_API_KEY=sk-ant-seu-valor-aqui
```

(A chave está no arquivo `.env` local - não compartilhe publicamente!)

Isso ativará a análise visual de datasheets com Claude Vision.

---

## 📝 COMO FAZER (3 OPÇÕES)

### OPÇÃO 1: Via Dashboard (Mais Fácil - Recomendado) ⭐

1. **Abrir Dashboard do Railway**
   - URL: https://railway.app/dashboard
   - Fazer login com GitHub se pedido

2. **Encontrar o Projeto**
   - Você verá seus projetos na tela
   - Procure por "accomplished-achievement" ou "Forte Solar"
   - Clique nele

3. **Abrir Variables**
   - Na barra lateral, procure por "Variables" ou "Settings → Variables"
   - Ou clique na aba "Variables" no topo

4. **Adicionar Nova Variável**
   - Clique em "+ Add" ou "+ New Variable"
   - **Campo Nome**: `ANTHROPIC_API_KEY`
   - **Campo Valor**: Cole a chave (ver arquivo `.env` local ou arquivo de credenciais salvo)

5. **Salvar e Deploy**
   - Clique "Deploy" ou "Save & Deploy"
   - Aguarde o rebuild (2-5 minutos)

---

### OPÇÃO 2: Via Railway CLI

```powershell
# Abrir PowerShell no diretório do projeto
cd "C:\Users\Forte Solar\PROJETO_FRTS_APP"

# Fazer login
railway login

# Configurar a variável (use a chave do arquivo .env local)
railway variables set ANTHROPIC_API_KEY=sk-ant-seu-valor-aqui

# Fazer deploy
railway up
```

---

### OPÇÃO 3: Via Script Python

```powershell
# Se tiver Python instalado:
cd "C:\Users\Forte Solar\PROJETO_FRTS_APP"

# Configurar tokens como variáveis de ambiente:
set RAILWAY_TOKEN=<seu_token>
set RAILWAY_PROJECT_ID=<seu_project_id>

# Executar script:
python scripts/configure_claude_vision.py
```

**Nota**: Você precisa obter `RAILWAY_TOKEN` e `RAILWAY_PROJECT_ID` primeiro.

---

## ✅ COMO VERIFICAR SE FUNCIONOU

### 1. Health Check da API

```bash
curl https://projetofrtsapp-production.up.railway.app/api/health
```

**Esperado**:
```json
{
  "status": "ok",
  "servico": "Forte Solar API",
  "mongodb": "conectando",
  "mongodbState": 1
}
```

### 2. Testar Claude Vision

Faça upload de um datasheet via interface:
1. Abra: https://projeto-frts-app.vercel.app/equipamentos/carregadores-ev
2. Clique "Upload Datasheet"
3. Selecione um PDF
4. Observe a resposta da API

**Esperado no console** (F12 → Network):
```json
{
  "modelo": "...",
  "fabricante": "...",
  "garantia_anos": 25,
  "analiseVisao": {
    "garantia_produto": 25,
    "garantia_performance": "80%...",
    "certificacoes": ["IEC 61215"],
    "confianca": "alta"
  },
  "_debug": {
    "analiseVisaoUsada": true
  }
}
```

---

## 🔍 SE ALGO DER ERRADO

### Problema: "ANTHROPIC_API_KEY não definida"
- **Solução**: Conferir se a variável foi adicionada corretamente
- Ir em Variables e verificar se `ANTHROPIC_API_KEY` está lá
- Tentar adicionar de novo se necessário

### Problema: "Erro 401 Invalid API Key"
- **Solução**: A chave pode estar errada
- Copiar a chave exata de `.env` local
- Verificar se não há espaços extras

### Problema: API continua retornando erro
- **Solução**: Aguardar rebuild
- Railway leva 2-5 minutos para fazer deploy
- Se > 10 minutos, tentar fazer deploy novamente

### Problema: Railway Dashboard congelado
- **Solução**: Usar Railway CLI ou Script Python
- Ou fechar abas do navegador e tentar novamente

---

## 📋 CHECKLIST FINAL

- [ ] Chave `ANTHROPIC_API_KEY` adicionada no Railway
- [ ] Deploy/Rebuild concluído (verde em Railway)
- [ ] Health check retorna `status: ok`
- [ ] Teste de upload de datasheet feito
- [ ] `analiseVisao` preenchido na resposta
- [ ] Selos/certificações sendo extraídas

---

## 🎉 SUCESSO!

Uma vez concluído, você terá:

✅ **56 Carregadores EV** catalogados  
✅ **Extração automática** de especificações por regex  
✅ **Claude Vision** analisando imagens de datasheets  
✅ **Garantias extraídas** de selos visuais  
✅ **Certificações** identificadas automaticamente  

---

## 📞 REFERÊNCIAS

- Railway Dashboard: https://railway.app/dashboard
- Railway Docs: https://docs.railway.app/
- Anthropic API: https://console.anthropic.com/
- Projeto em Produção: https://projeto-frts-app.vercel.app

---

**Tempo estimado para completar**: 5-10 minutos  
**Dificuldade**: ⭐ Muito Fácil (apenas adicionar uma variável)

Após isso, o sistema estará 100% operacional com:
- ✅ 56 carregadores EV
- ✅ Extração automática de especificações
- ✅ Análise visual com Claude Vision
- ✅ Interface web sincronizada
- ✅ API em produção
