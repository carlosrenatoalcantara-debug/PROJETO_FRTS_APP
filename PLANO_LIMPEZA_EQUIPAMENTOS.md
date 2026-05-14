# 📋 PLANO DE LIMPEZA E ATUALIZAÇÃO DO BANCO DE EQUIPAMENTOS

**Data:** 14 de Maio de 2026  
**Status:** ✅ Pronto para execução  
**Autorização:** Autonomia Completa no Projeto Forte Solar  

---

## 🎯 OBJETIVO

Identificar, corrigir e deletar equipamentos cadastrados como "Desconhecido" ou com dados incompletos no banco de dados MongoDB da Forte Solar, deixando o banco mais completo e confiável.

---

## 📊 SITUAÇÃO ATUAL

### Problema Identificado
- ❌ Alguns equipamentos (principalmente carregadores EV) estão cadastrados como "Desconhecido"
- ❌ Ocorre quando o sistema não consegue ler corretamente datasheets em PDF
- ❌ Resulta em registros incompletos com preços zerados ou fabricante/modelo inválidos

### Arquivos Envolvidos
```
/backend/src/
├── controllers/
│   ├── carregadorEVController.js       ← Define "Desconhecido" como fallback
│   └── carregadorEVControllerGemini.js ← Idem com Gemini API
├── data/
│   ├── catalogoInversores.js           ← 9 inversores completos
│   ├── catalogoPaineis.js              ← 7 painéis solares completos
│   └── equipamentosDatabase.js         ← Base expandida
├── models/
│   └── Equipamento.js                  ← Schema MongoDB
└── seeds/
    └── equipamentosMemory.js           ← Dados de exemplo (completos)
```

### Banco de Dados
- **Produção:** MongoDB Atlas (cluster0.e3d0pph.mongodb.net)
- **Status:** 🔴 Offline (problema IP whitelist)
- **Fallback:** Memory Storage (memory-storage.json)
- **Capacidade:** Suporta módulos, inversores, carregadores EV, baterias, estruturas

---

## 📋 FERRAMENTAS CRIADAS

### 1. Script de Análise
**Arquivo:** `backend/analisar-completo.mjs`  
**O que faz:**
- Lista todos os equipamentos em memória
- Identifica os incompletos/desconhecidos
- Compara com catálogos disponíveis
- Gera relatório com recomendações

**Uso:**
```bash
cd backend
node analisar-completo.mjs
```

**Resultado Esperado:**
```
📊 EQUIPAMENTOS EM MEMÓRIA
✓ Módulos: 3 (completos)
✓ Inversores: 4 (completos)
✓ Carregadores EV: 2 (completos)

🔴 EQUIPAMENTOS COM PROBLEMAS
Encontrados: X equipamentos
```

### 2. Script de Limpeza Completa
**Arquivo:** `backend/limpar-equipamentos-completo.mjs`  
**Modos de Operação:**

#### Mode: `--mode=analysis` (Padrão)
Identifica equipamentos incompletos para correção
```bash
node limpar-equipamentos-completo.mjs --mode=analysis
```

#### Mode: `--mode=update`
Atualiza equipamentos com dados corretos de:
- ✅ Intelbras (EVE 0074C, EVE 0170T)
- ✅ Solplanet (SOL7.4H)
- ✅ Belenergy (BEL-AC7)
- ✅ EMOBI/Evowatt (Boreal Master 7kW)
- ✅ ABB (Terra AC)
- ✅ Wallbox (Pulsar Plus)
- ✅ Módulos solares de principais marcas
- ✅ Inversores de todas as potências

```bash
node limpar-equipamentos-completo.mjs --mode=update
```

#### Mode: `--mode=delete`
Remove registros inválidos:
- Marca/modelo contendo "desconhecido"
- Preço zerado ou não definido
- Campos críticos faltando

```bash
node limpar-equipamentos-completo.mjs --mode=delete
```

#### Mode: `--mode=report`
Gera relatório geral do banco

```bash
node limpar-equipamentos-completo.mjs --mode=report
```

---

## 🔄 FLUXO DE EXECUÇÃO

### FASE 1: ANÁLISE (Já Concluída)
✅ Identificação de arquivos e estrutura  
✅ Criação de ferramentas de diagnóstico  
✅ Levantamento de dados faltantes  

### FASE 2: ATUALIZAÇÃO (Quando MongoDB Fica Disponível)
1. **Verificar conexão MongoDB:**
   ```bash
   node -e "require('dotenv').config(); console.log(process.env.MONGODB_URI)"
   ```

2. **Executar análise:**
   ```bash
   node backend/limpar-equipamentos-completo.mjs --mode=analysis
   ```

3. **Verificar lista de problematicos**

4. **Fazer update:**
   ```bash
   node backend/limpar-equipamentos-completo.mjs --mode=update
   ```

5. **Confirmar atualização:**
   ```bash
   node backend/limpar-equipamentos-completo.mjs --mode=report
   ```

### FASE 3: LIMPEZA
1. **Deletar inválidos:**
   ```bash
   node backend/limpar-equipamentos-completo.mjs --mode=delete
   ```

2. **Verificar resultado:**
   ```bash
   node backend/limpar-equipamentos-completo.mjs --mode=report
   ```

---

## 📦 DADOS DISPONÍVEIS PARA ATUALIZAÇÃO

### Carregadores EV (7 modelos completos)
| Fabricante | Modelo | Potência | Tipo | Preço |
|---|---|---|---|---|
| Intelbras | EVE 0074C | 7.4 kW | AC Mono | R$ 2.800 |
| Intelbras | EVE 0170T | 16.5 kW | AC Tri | R$ 3.900 |
| Solplanet | SOL7.4H | 7.4 kW | AC Mono | R$ 2.500 |
| Belenergy | BEL-AC7 | 7.0 kW | AC Mono | R$ 2.200 |
| EMOBI | Evowatt Boreal Master 7kW | 7.0 kW | AC Mono | R$ 2.900 |
| ABB | ABB Terra AC | 11.0 kW | AC Tri | R$ 5.200 |
| Wallbox | Pulsar Plus | 11.0 kW | AC Tri | R$ 4.500 |

### Módulos Solares (6 modelos)
| Fabricante | Modelo | Potência | Preço |
|---|---|---|---|
| Canadian Solar | CS6W-550MS | 550W | R$ 890 |
| Risen | RSM144-7-550M | 550W | R$ 820 |
| JA Solar | JAM72S30-550MR | 550W | R$ 800 |
| Trina Solar | TSM-610DE21 | 610W | R$ 980 |
| BYD | BYD415H5-54E | 415W | R$ 660 |
| LONGi | LR5-72HPH-450M | 450W | R$ 760 |

### Inversores (6 modelos)
| Fabricante | Modelo | Potência | Preço |
|---|---|---|---|
| Fronius | Primo 5.0-1 | 5.0 kW | R$ 4.200 |
| Growatt | MOD 5000TL3-LV | 5.0 kW | R$ 2.800 |
| Sungrow | SG5.0RS | 5.0 kW | R$ 3.100 |
| Deye | SUN-8K-SG01LP1 | 8.0 kW | R$ 5.500 |
| Sungrow | SG10RS | 10.0 kW | R$ 7.800 |
| Sungrow | SG15RT | 15.0 kW | R$ 11.500 |

---

## ⚡ PRÓXIMOS PASSOS

### Quando MongoDB Ficar Disponível (IP Whitelist)
1. Executar `--mode=analysis` para ter a situação exata
2. Executar `--mode=update` para inserir dados corretos
3. Executar `--mode=delete` para remover inválidos
4. Executar `--mode=report` para confirmar limpeza

### Melhorias Futuras
- [ ] Integrar busca automática na internet (web scraping de datasheets)
- [ ] Webhook para validação de novos equipamentos antes de salvar
- [ ] CI/CD que verifica integridade de equipamentos antes de deploy
- [ ] Dashboard visual mostrando equipamentos com problemas

---

## 🔐 SEGURANÇA E BACKUP

### Antes de Executar Deletions
✅ Fazer backup do MongoDB:
```bash
mongodump --uri="$MONGODB_URI" --out=./backup/pre-limpeza-$(date +%Y%m%d)
```

### Documentação de Mudanças
Cada execução será registrada com:
- Data/hora da execução
- Modo executado
- Número de registros afetados
- Hash de verificação

---

## 📞 REFERÊNCIA

- **MongoDB Connection:** `process.env.MONGODB_URI`
- **Docs Completos:** Ver comentários nos scripts `.mjs`
- **Catálogos:** `/backend/src/data/catalogo*.js`
- **Especificações:** `/backend/src/seeds/equipamentosMemory.js`

---

**Criado por:** Claude Code  
**Versão:** 1.0  
**Última Atualização:** 2026-05-14
