# PROJETO_DOCUMENTOS_EXTERNOS_REPORT.md

**Sprint:** P5-PROJETO-DOCUMENTOS-EXTERNOS-01
**Modelo:** Sonnet
**Data:** 2026-06-19
**Revisão Gemini:** Opcional

---

## OBJETIVO

Permitir que cada projeto Forte Solar referencie sua pasta documental externa (OneDrive, Google Drive, SharePoint, Dropbox ou equivalente), sem armazenar arquivos dentro da plataforma.

A Forte Solar funciona como índice e ponto de acesso — o processo de documentação no OneDrive permanece inalterado.

---

## FASE 1 — FORENSE

### Onde armazenar o link

**Decisão: campo no ProjetoFV (não em AtivoEquipamento, não em Homologação)**

Justificativa:
- O link representa a pasta do **projeto** (Forte Solar/Projeto/Ano/Mês/Cliente)
- AtivoEquipamento é por equipamento instalado — não por projeto
- Homologação é um subfluxo do projeto — o link da pasta é mais abrangente
- ProjetoFV já possui PATCH genérico (`atualizarProjetoFV`) que aceita qualquer campo do schema
- CRM e Governança são subseções de ProjetoFV — o campo novo fica no nível raiz

### Ponto de acesso UI

**Decisão: aba "Documentos" existente em `ProjetosFVDetalhes`**

A aba `documentos` já existe e exibe `DocumentCenter` (documentos técnicos/comerciais do projeto). O componente novo `DocumentosExternos` foi adicionado abaixo do `DocumentCenter` na mesma aba — sem criar nova aba.

---

## FASE 2 — MODELAGEM

### Campo adicionado a `backend/src/models/ProjetoFV.js`

```js
// P5-PROJETO-DOCUMENTOS-EXTERNOS-01 (additive)
// NÃO armazena arquivos. Apenas links (OneDrive, Google Drive, SharePoint, Dropbox...).
// Projetos legados lêem null sem nenhum erro.
documentacao_externa: {
  pasta_principal:   { type: String, default: null },
  pasta_fotos:       { type: String, default: null },
  pasta_homologacao: { type: String, default: null },
  pasta_garantia:    { type: String, default: null },
  pasta_medicoes:    { type: String, default: null },
  observacoes:       { type: String, default: null },
},
```

**Compatibilidade total:**
- Projetos v2 e v3 existentes retornam `null` para este campo — sem erro
- Nenhuma migração necessária
- Sem `{ _id: false }` — o Mongoose usa o padrão (subdoc embutido sem _id próprio é OK aqui pois é `{ type: String }` flat, não um schema próprio com `new Schema`)
- O PATCH genérico `findByIdAndUpdate(id, req.body, {new: true})` persiste automaticamente

---

## FASE 3 — UI

### Componente: `frontend/src/components/fv/DocumentosExternos.jsx`

Campos:
- 📁 Pasta Principal
- 📷 Fotos
- 📋 Homologação
- 🛡 Garantia
- 📊 Medições
- Observações (textarea livre)

**Modo leitura** (sem links): card com instrução vazia  
**Modo leitura** (com links): botões de abertura por pasta  
**Modo edição**: inputs type="url" + textarea + salvar/cancelar

---

## FASE 4 — ABERTURA

Todos os botões usam:
```js
window.open(url, '_blank', 'noopener,noreferrer')
```

Compatível com OneDrive share links, Google Drive share links, SharePoint, Dropbox e qualquer URL HTTP(S).

---

## FASE 5 — GÊMEO DIGITAL

**AtivoEquipamento NÃO foi alterado.**

O link de acesso à pasta do projeto foi adicionado à página `AtivoQR.jsx` (campo mobile):

```jsx
{dados.projeto?.documentacao_externa?.pasta_principal && (
  <a href={...} target="_blank" rel="noopener noreferrer" ...>
    📁 Abrir Pasta do Projeto
  </a>
)}
```

Para que esse dado chegue ao AtivoQR, foi necessário:
1. Adicionar `documentacao_externa` à projeção do `ProjetoFV.findById` no controller (`ativosController.js` linha 71)
2. Incluir `documentacao_externa` na resposta da rota `GET /api/ativos/qr/:qr`

**O vínculo Ativo → Projeto já existia** — apenas o dado novo foi exposto.

---

## FASE 6 — UX CONDICIONAL

| Situação | Exibição |
|---|---|
| Sem links | Card vazio com instrução |
| Apenas `pasta_principal` | Único botão `📁 Abrir Pasta Cliente` |
| `pasta_principal` + qualquer outra | Botão separado por pasta preenchida |
| Com observações | Texto de observação abaixo dos botões |

---

## FASE 7 — COMPATIBILIDADE COM PROJETOS

| Cenário | Comportamento |
|---|---|
| Projeto novo | `documentacao_externa` = null → card vazio |
| Projeto legado (sem campo) | `null` coalescido no frontend → card vazio |
| Projeto congelado | Links editáveis (metadado operacional, não governa snapshot) |
| Projeto homologado | Links editáveis — documentação externa não afeta snapshots técnicos |

---

## FASE 8 — REGRESSÃO

| Área | Status |
|---|---|
| Comercial (PropostaEnterprise, CRM) | Intacto — campo aditivo não toca fluxo comercial |
| Engenharia (UnifilarFV, motor FV) | Intacto |
| Homologação | Intacto |
| Snapshot / Governança | Intacto — `documentacao_externa` não é snapshot |
| Ativos / QR / Comissionamento | Intacto — AtivoEquipamento não alterado |
| ProjetoEV | Não tocado |
| Build frontend | ✓ 2330 módulos, 0 erros |

---

## ARQUIVOS ALTERADOS

| Arquivo | Tipo | Descrição |
|---|---|---|
| `backend/src/models/ProjetoFV.js` | MODIFICADO | Campo `documentacao_externa` adicionado |
| `backend/src/controllers/ativosController.js` | MODIFICADO | Projection e response QR expostos |
| `frontend/src/components/fv/DocumentosExternos.jsx` | CRIADO | Componente de índice documental |
| `frontend/src/pages/ProjetosFVDetalhes.jsx` | MODIFICADO | Import + aba documentos com DocumentosExternos |
| `frontend/src/pages/AtivoQR.jsx` | MODIFICADO | Link condicional à pasta do projeto |

---

## RESPOSTAS ÀS 7 QUESTÕES

1. **Arquivos alterados:** 4 modificados + 1 criado (ver tabela acima)

2. **Campo criado:** `ProjetoFV.documentacao_externa` com 6 subcampos String (todos default null)

3. **Compatibilidade com projetos antigos:** Total — campo ausente/null → UI mostra card vazio; nenhuma migração necessária

4. **Funcionamento da abertura de links:** `window.open(url, '_blank', 'noopener,noreferrer')` — abre em nova aba, funciona com qualquer URL (OneDrive, Drive, SharePoint, Dropbox)

5. **Integração com Ativos:** Via exposição de `documentacao_externa` na rota `GET /api/ativos/qr/:qr`; AtivoEquipamento inalterado; o técnico em campo vê "📁 Abrir Pasta do Projeto" na página AtivoQR

6. **Regressões encontradas:** Zero — campo aditivo, sem tocar modelo de Ativos, QR, Comissionamento, Homologação, Snapshot ou Governança

7. **Commit:** Build validado — pronto para commit

---

## VALIDAÇÃO

| Teste | Executado | Resultado |
|---|---|---|
| Build de produção | ✓ | 2330 módulos, 0 erros |
| Retrocompatibilidade (leitura de código) | ✓ | Campo null coalescido — zero quebra |
| Abertura de link real (OneDrive) | ✗ | Não testado sem ambiente real |
| Device móvel (AtivoQR) | ✗ | Não testado |
| Atlas ativo (persistência) | ✗ | Sem conexão Atlas disponível |

---

## NÃO IMPLEMENTADO (conforme restrições)

- Upload de arquivos
- Sincronização automática de pastas
- API Microsoft (Graph/OneDrive)
- API Google Drive
- API Dropbox / SharePoint
- Azure Blob / S3 / GCS
- Preview de arquivos dentro da plataforma
- Contagem de arquivos na pasta referenciada
