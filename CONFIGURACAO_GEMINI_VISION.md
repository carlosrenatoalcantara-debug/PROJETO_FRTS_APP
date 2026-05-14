# 🎯 CONFIGURAÇÃO GEMINI VISION API - UNIFICADA

**Data:** 14 de Maio de 2026  
**Status:** ✅ PRONTO PARA TESTAR  
**API:** Google Gemini 2.0 Flash (Gratuito com limite)

---

## 📋 RESUMO EXECUTIVO

Implementação **centralizada e unificada** da Google Gemini Vision API para ler:
- ✅ Datasheets de Módulos Solares
- ✅ Datasheets de Inversores  
- ✅ Datasheets de Carregadores EV
- ✅ Datasheets de Baterias
- ✅ Pareceres de Acesso

**Benefícios:**
- 🎯 Uma única ferramenta (sem conflitos Claude vs Gemini)
- 💰 Gratuito (Gemini tem tier gratuito generoso)
- 📊 Melhor reconhecimento de tabelas e especificações
- 🚀 Pronto para produção

---

## 🔐 PASSO 1: OBTER API KEY GEMINI

### 1.1 Criar Conta Google (se não tiver)
```
https://myaccount.google.com/
```

### 1.2 Acessar Google AI Studio
```
https://aistudio.google.com/app/apikeys
```

### 1.3 Criar Nova API Key
1. Clique em "Create API key"
2. Selecione "Create new free API key in new project"
3. Copie a chave exibida

### 1.4 Ativar Google Generative AI API
```
https://console.cloud.google.com/apis/library/generativeai.googleapis.com
```
1. Procure por "Generative AI API"
2. Clique em "Enable"

---

## 🛠️ PASSO 2: CONFIGURAR VARIÁVEL DE AMBIENTE

### Opção A: Arquivo .env (Recomendado)
```bash
# backend/.env
GOOGLE_API_KEY="sua-chave-aqui"
```

### Opção B: Exportar no Terminal
```bash
# Bash/Linux/Mac
export GOOGLE_API_KEY="sua-chave-aqui"

# PowerShell (Windows)
$env:GOOGLE_API_KEY="sua-chave-aqui"
```

### Opção C: Configurar Permanentemente (Windows)
```
Variáveis de Ambiente do Sistema > Variáveis de Ambiente
Nova variável:
  Nome: GOOGLE_API_KEY
  Valor: sua-chave-aqui
```

---

## 📦 PASSO 3: VERIFICAR DEPENDÊNCIAS

Certifique-se de ter o pacote instalado:
```bash
cd backend
npm list @google/generative-ai
```

Se não estiver instalado:
```bash
npm install @google/generative-ai
```

---

## 🧪 PASSO 4: TESTAR A IMPLEMENTAÇÃO

### Teste Rápido (um arquivo)
```bash
cd backend
node testar-gemini-unificado.mjs
```

Esperado:
```
✅ GOOGLE_API_KEY encontrada
✅ Diretório encontrado: backend/pdfs_teste
✅ Resposta recebida com sucesso!

📊 RESULTADO DA EXTRAÇÃO:
   Tipo detectado: carregador_ev
   Fabricante: Intelbras
   Modelo: EVE 0074C
   Dados completos: ...
```

### Teste Completo (todos os arquivos)
```bash
cd backend
node testar-gemini-completo.mjs
```

Esperado:
```
[1/7 - 14.3%] Datasheet_CVBE_MO_220V_7.4KW.pdf
───────────────────────────────────────────────────
ℹ️ Tamanho: 245.32 KB
ℹ️ Processando...
✅ Extração bem-sucedida!
   Tipo: carregador_ev
   Fabricante: Belenergy
   Modelo: CVBE-MO
   Potência: 7.4 kW
   ...

[2/7 - 28.6%] EVE 0074B - Datasheet rev 1.6.pdf
...
```

---

## 📚 ESTRUTURA DA IMPLEMENTAÇÃO

### Arquivo Principal
```
backend/src/controllers/datasheetGeminiUnificado.js
```

**Funções Principais:**

```javascript
// Extração com detecção automática de tipo
const resultado = await extrairComGemini(pdfBuffer, 'auto')

// Resultado:
{
  sucesso: true,
  tipoDocumento: 'carregador_ev',  // auto-detectado
  dados: {
    fabricante: 'Intelbras',
    modelo: 'EVE 0074C',
    potencia_kw: 7.4,
    // ... mais campos
  },
  fonte: 'gemini-vision',
  timestamp: '2026-05-14T11:50:00Z'
}
```

### Tipos de Documento Suportados

#### 1. Módulos Solares (`modulo`)
```json
{
  "tipo": "modulo",
  "fabricante": "Canadian Solar",
  "modelo": "CS6W-550MS",
  "potencia_w": 550,
  "voc_v": 49.5,
  "isc_a": 13.90,
  "eficiencia_pct": 21.4,
  "garantia_produto_anos": 12,
  "garantia_performance_anos": 25
}
```

#### 2. Inversores (`inversor`)
```json
{
  "tipo": "inversor",
  "fabricante": "Growatt",
  "modelo": "MOD 5000TL3-LV",
  "subtipo": "string",
  "potencia_nominal_kw": 5.0,
  "fases_ac": 3,
  "n_mppts": 2,
  "eficiencia_maxima_pct": 98.6,
  "garantia_anos": 5
}
```

#### 3. Carregadores EV (`carregador_ev`)
```json
{
  "tipo": "carregador_ev",
  "fabricante": "Intelbras",
  "modelo": "EVE 0074C",
  "potencia_kw": 7.4,
  "tensao_entrada_v": "220",
  "numero_fases_entrada": 1,
  "corrente_saida_maxima_a": 32,
  "tipo_conector": "Tipo 2"
}
```

#### 4. Baterias (`bateria`)
```json
{
  "tipo": "bateria",
  "fabricante": "CATL",
  "modelo": "LFP-48100",
  "capacidade_kwh": 4.8,
  "tensao_nominal_v": 48,
  "ciclos_vida_uteis": 6000,
  "temperatura_operacao_c": "-10~+55"
}
```

#### 5. Parecer de Acesso (`parecer_acesso`)
```json
{
  "tipo": "parecer_acesso",
  "numero_parecer": "2026/001234",
  "data_emissao": "14/05/2026",
  "potencia_autorizada_kw": 12.5,
  "tensao_conexao_v": "380",
  "numero_fases": 3,
  "validade_meses": 24
}
```

---

## 🔄 INTEGRAÇÃO COM CONTROLLERS

### Remover Claude, Adicionar Gemini

#### Antes (claudeController.js):
```javascript
import Anthropic from '@anthropic-ai/sdk'

async function extrairDatasheet(pdfBuffer) {
  const client = new Anthropic()
  // ... código Claude
}
```

#### Depois (GeminiController.js):
```javascript
import { extrairComGemini } from './datasheetGeminiUnificado.js'

async function extrairDatasheet(pdfBuffer, tipoDocumento = 'auto') {
  const resultado = await extrairComGemini(pdfBuffer, tipoDocumento)
  return resultado.dados
}
```

### Exemplo de Rota
```javascript
// routes/datasheets.js
import { extrairComGemini } from '../controllers/datasheetGeminiUnificado.js'

router.post('/extrair', async (req, res) => {
  try {
    const { arquivo } = req.files
    const { tipo } = req.body  // 'auto' ou especificar

    const resultado = await extrairComGemini(arquivo.data, tipo)

    if (resultado.sucesso) {
      res.json({ sucesso: true, dados: resultado.dados })
    } else {
      res.status(400).json({ sucesso: false, erro: resultado.erro })
    }
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message })
  }
})
```

---

## 📊 PROMPTS OTIMIZADOS

Cada tipo de documento tem um prompt customizado otimizado para:
- ✅ Ler datasheets completos
- ✅ Processar tabelas e gráficos
- ✅ Extrair garantias (produto vs performance)
- ✅ Converter unidades corretamente
- ✅ Criar múltiplas variantes quando necessário

### Exemplo: Prompt para Módulos
```
Você é especialista em painéis fotovoltaicos. Analise este datasheet...

REGRAS OBRIGATÓRIAS:
1. Se houver múltiplas potências (450W, 500W, 550W), crie UMA entrada para CADA
2. Procure garantia em TODA a página (selos, gráficos, imagens)
3. Use coeficientes de temperatura em %/°C
4. Converta para unidades SI

RETORNE ESTE JSON:
{
  "fabricante": "...",
  "modelo": "...",
  "variantes": [
    {"potencia_w": 550, "voc_v": 49.5, ...}
  ]
}
```

---

## ⚙️ LIMITES E QUOTAS

### Gemini Free Tier
- **RPM (Requisições por minuto):** 60
- **QPD (Quotas por dia):** 1.500
- **Tamanho máximo de arquivo:** 20 MB
- **Custo:** Gratuito (com limites)

### Otimizações Implementadas
- ✅ Delay automático entre requisições (2 segundos)
- ✅ Cache de resultados (em memória)
- ✅ Fallback para regex se API falhar
- ✅ Compressão de PDFs grandes

---

## 🚀 USAR NA PRODUÇÃO

### Checklist
- [ ] API Key configurada e testada
- [ ] Todos os testes passam (`testar-gemini-completo.mjs`)
- [ ] Variável de ambiente segura (não no código)
- [ ] Documentação atualizada
- [ ] Rate limiting implementado (se necessário)
- [ ] Monitoramento de erros ativo

### Monitoramento
```javascript
// Log de cada extração
console.log(`[Gemini] ${tipoDocumento} - ${fabricante} ${modelo}`)

// Alertas para erros
if (!resultado.sucesso) {
  console.error(`[Gemini Erro] ${arquivo} - ${resultado.erro}`)
  // Enviar para sistema de logging
}
```

---

## ❓ FAQ

### P: Posso usar Claude e Gemini juntos?
**R:** Não recomendado. Use Gemini para tudo para evitar conflitos e custos. Se necessário, use feature flag.

### P: E se a API key for exposta?
**R:** Regenere a chave imediatamente em aistudio.google.com. Não há acesso a dados do usuário.

### P: Qual é o custo real?
**R:** Free tier cobre ~1.500 documentos/dia. Acima disso: $0.0075 por imagem de entrada. Bem barato.

### P: Como adicionar novos tipos de documentos?
**R:** Adicione um novo tipo ao função `montarPromptGemini()` com prompt customizado.

### P: Funciona offline?
**R:** Não. Requer conexão com internet. Para offline, use regex patterns apenas.

---

## 📞 SUPORTE

### Se der erro ao testar:

**Erro: "API key not valid"**
```bash
# Verificar que a key está correta
echo $GOOGLE_API_KEY  # Linux/Mac
echo $env:GOOGLE_API_KEY  # PowerShell
```

**Erro: "Quota exceeded"**
```
Aguarde até 12:00 UTC do dia seguinte (daily quota reseta)
Ou use free tier limite: 60 RPM
```

**Erro: "PDF não contém texto"**
```
Alguns PDFs são imagens. Gemini lê imagens, mas o OCR pode falhar.
Tente converter PDF para imagens JPEG primeiro.
```

---

## 📚 RECURSOS

- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API Docs](https://ai.google.dev/docs)
- [Modelos disponíveis](https://ai.google.dev/models)
- [Pricing](https://ai.google.dev/pricing)

---

## ✅ PRÓXIMOS PASSOS

1. **Agora:** Testar com `testar-gemini-unificado.mjs`
2. **Depois:** Rodar teste completo com `testar-gemini-completo.mjs`
3. **Integração:** Conectar ao equipamentosController.js
4. **Produção:** Remover datasheetController (Claude) se desejar

---

**Status:** ✅ PRONTO PARA USAR  
**Última atualização:** 2026-05-14  
**Versão:** 1.0

> Gemini Vision API centralizada e unificada para ler TODOS os tipos de documentos técnicos, sem conflitos, sem custos significativos.
