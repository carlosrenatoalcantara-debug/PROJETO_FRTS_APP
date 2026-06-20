# WIZARD_PERSISTENCE_RCA.md

**Sprint:** P0-FV-WIZARD-PERSISTENCE-RCA-01
**Data:** 2026-06-20
**Modelo:** Claude Opus 4.8
**Tipo:** Root Cause Analysis (READ-ONLY — nenhuma correção aplicada)

---

## ⚠️ GEMINI

Sprint marca **GEMINI: Obrigatória**. Não há ferramenta Gemini neste ambiente.
RCA por Claude Opus 4.8 (leitura de código + 1 sonda de runtime). **Revisão Gemini: PENDENTE.**

---

## RESULTADO

```
P0 CONFIRMADO (não é falso positivo) — e MAIS grave que a auditoria supôs
```

A auditoria disse que as etapas anteriores "dependeriam de localStorage". A RCA prova que **o localStorage é write-only**: é gravado continuamente mas **nunca é lido para restaurar**, e é **apagado no mount** de um projeto novo. A única reidratação real vem do **banco via `?id=`** — que só existe após o save da etapa 8. Logo, a "rede de segurança do navegador" anunciada na UI **não protege** um projeto novo.

---

## TIPO DE EVIDÊNCIA

```
VALIDADO EM CÓDIGO:   SIM (fluxo E1–E8, reducer, mount, autosave, LS)
VALIDADO EM RUNTIME:  PARCIAL — POST /api/projetos-fv exige clienteId+nome (400 sem eles)
                      Cenários A–D deduzidos da lógica de mount (não exercidos em browser)
```

---

## FASE 1 — MAPEAMENTO

| Arquivo | Papel |
|---|---|
| `pages/ProjetosFVNovo.jsx` | Orquestra o wizard; mount decide hidratar (DB via `?id=`) ou resetar |
| `contexts/ProjetoFVContext.jsx` | Estado (useReducer) + escrita em localStorage a cada mudança |
| `services/projetoFVApi.js` | `criarProjeto` (POST), `salvarEtapa` (PUT /etapa), `salvarTodosSlices` |
| `components/fv/etapas/E8Orcamento.jsx` | **Único** ponto que cria o projeto e salva todos os slices |
| `backend/.../projetosFVController.js` | `criarProjetoFV` (POST), `salvarEtapaProjetoFV` (PUT /etapa) |

### Rota oficial
`/projetos-fv/novo` → `ProjetosFVNovo`. (`NovaProposta`/funilv2 = `DEPRECATED_DO_NOT_USE`, App.jsx:54.)

### Mecânica do localStorage (chave `forte_solar_wizard_fv_v3`)
- **Escrita:** `ProjetoFVContext.jsx:163` — `localStorage.setItem(...)` em todo `state` (exceto `arquivo`).
- **Remoção:** `Context:180` (resetar) e `ProjetosFVNovo:204` (fallback).
- **Leitura:** **NENHUMA.** Não existe `localStorage.getItem(LS_KEY)` em todo o frontend.
- **HIDRATAR:** disparado só em `ProjetosFVNovo:107`, **dentro do `if (idParam)`** — usa dados do **banco**, não do LS.

### Mount (ProjetosFVNovo, useEffect)
```
?id=        → buscarProjeto(id) → HIDRATAR (do banco)
?clienteId= → resetar() + pré-preenche dados básicos do cliente
sem nada    → resetar()  → localStorage.removeItem + RESETAR
```
Comentário do próprio código (linha 53): *"NUNCA restaurar de localStorage sem ?id= explícito"*.

### Autosave (ProjetosFVNovo:283-304)
```js
if (etapaAtual > etapaAnterior && state.projetoId) { salvarEtapa(...) }
```
Dispara **somente** se `state.projetoId` existir. Em projeto novo, `projetoId` é `null` até a etapa 8 → **o autosave nunca dispara em E1–E7**. Só funciona em modo retomada (`?id=`).

---

## FASE 2 — PERSISTÊNCIA POR ETAPA (projeto novo)

| Etapa | Conteúdo | Mongo? | localStorage? | Memória? | Observação |
|---|---|---|---|---|---|
| E1 Upload | cliente + arquivo fatura | ❌ | ⚠️ parcial | ✅ | `arquivo` (File) é memória-pura (excluído do LS) |
| E2 Consumo | consumo, concessionária, tensão | ❌ | ⚠️ write-only | ✅ | |
| E2.5 Beneficiárias | array `beneficiarias` | ❌ | ⚠️ write-only | ✅ | só vai ao DB em E8 (lote) |
| E3 Localização | endereço, lat/lon | ❌ | ⚠️ write-only | ✅ | |
| E4 Irradiância | irradiância NASA/CRESESB | ❌ | ⚠️ write-only | ✅ | |
| E5 Dimensionamento | kWp, nº painéis | ❌ | ⚠️ write-only | ✅ | |
| E6 Área/Layout | panos, área | ❌ | ⚠️ write-only | ✅ | |
| E7 Equipamentos | painel/inversor/estrutura/arranjos | ❌ | ⚠️ write-only | ✅ | |
| **E8 Orçamento** | **cria projeto + salva TODOS os slices** | ✅ | — | — | POST + 7×PUT + beneficiárias lote |

> **⚠️ "write-only":** o LS é gravado, mas nunca lido de volta e é apagado no próximo mount sem `?id=`. Na prática, **não protege** o projeto novo.

**E1–E7: 0% persistido no Mongo. E8: 100% (ponto único).**

---

## FASE 3 — CENÁRIOS

### Cenário A — fecha o navegador em E3
- Context (memória) destruído. LS foi gravado, mas ao reabrir `/projetos-fv/novo` (sem `?id=`) o mount chama `resetar()` → apaga LS + reset.
- **Perde:** TUDO (E1–E3). O projeto nunca existiu no banco.

### Cenário B — F5 em E6
- Remonta o componente. Sem `?id=` → `resetar()` → LS apagado + estado volta a E1 em branco.
- **Perde:** TUDO (E1–E6). O LS não restaura (é write-only e ainda é apagado no mount).
- A mensagem da UI "Dados salvos no navegador… localStorage protege do refresh" (ProjetosFVNovo:398-405) é **enganosa** neste caso.

### Cenário C — troca de computador
- localStorage é local ao navegador/máquina. O projeto não está no banco.
- **Perde:** TUDO. Nada disponível no novo computador.

### Cenário D — Railway reinicia
- E1–E7 **não tocam o servidor** → não há estado de servidor a perder.
- Após E8, os dados estão no Mongo (duráveis) → restart não afeta.
- **Perde:** NADA atribuível ao wizard. (Diferente do NEW-01, o wizard não mantém estado em memória no servidor.)

---

## FASE 4 — BACKEND

| Operação | Quando ocorre | Persistente |
|---|---|---|
| `POST /api/projetos-fv` | **Apenas em E8** (`E8Orcamento.jsx:354`). Exige `clienteId`+`nome` (runtime: 400 sem eles). | ✅ cria doc Mongo |
| `PUT /api/projetos-fv/:id/etapa` | Em E8 (`salvarTodosSlices`, 7 slices) e no autosave **só se já houver `projetoId`** | ✅ |
| `PATCH` | Não usado no fluxo de criação do wizard (PATCH existe em homologação/protocolo) | — |

**Existe autosave?**
**Tecnicamente SIM, mas MORTO para projeto novo.** O hook existe (ProjetosFVNovo:283) porém condicionado a `state.projetoId`, que só é setado em E8. Em E1–E7 de um projeto novo, **nenhum autosave dispara**. Só vale em retomada (`?id=`).

---

## FASE 5 — GRAVIDADE

```
GRAVIDADE REAL: ALTA
```

| Fator | Avaliação |
|---|---|
| Dado persistido (committed) perdido? | NÃO — só trabalho em andamento (não salvo) |
| Quanto se perde num F5/fechar | TODO o preenchimento E1–E7 (cliente, consumo, beneficiárias, local, dimensionamento, área, equipamentos) |
| Rede de segurança (localStorage) | INEXISTENTE na prática (write-only + apagada no mount) |
| UI engana o usuário? | SIM — anuncia "salvo no navegador / protege do refresh" |
| Após E8 | Durável no Mongo; retomada por `?id=` funciona |
| Railway restart | Sem impacto no wizard |

**Por que ALTA (e não MÉDIA):** uma única tecla F5 acidental, fechar a aba ou crash do browser apaga 100% de uma sessão de entrada de dados que pode levar 15–30 min — e a UI afirma o contrário. É atrito operacional severo e recorrente.
**Por que não CRÍTICA:** nenhum dado de negócio já comprometido/persistido é perdido ou corrompido; é recuperável por re-digitação; pós-E8 é durável.

> Mais grave que o NEW-01 (homologação, MÉDIA), porque lá o núcleo já persistia em Mongo; aqui **7 de 8 etapas não têm qualquer persistência server-side** e o fallback de browser é morto.

---

## FASE 6 — CORREÇÃO RECOMENDADA (sem implementar)

### Opção 1 (recomendada) — Projeto rascunho precoce + autosave existente
- Criar o `ProjetoFV` como `status: 'rascunho'` ao concluir **E2** (consumo) ou **E3** (cliente + localização resolvidos), assim que houver `clienteId`.
- `dispatch(SET_PROJETO_ID)` → o **autosave por slice já existente** passa a disparar automaticamente em E3–E7.
- Em E8, detectar `projetoId` existente e **não duplicar** (a lógica já trata isso: `if (!projetoIdAtual) criarProjeto`).
- **Vantagem:** reusa toda a infraestrutura atual (`criarProjeto`, `salvarEtapa`, `salvarTodosSlices`); mudança cirúrgica.

### Opção 2 (complementar) — Restaurar de localStorage no mount
- No mount sem `?id=`, **antes** de `resetar()`, oferecer recuperação do rascunho local (ler `LS_KEY`, perguntar "retomar rascunho?"). Corrige o write-only e o cenário B mesmo antes do projeto nascer no banco.
- Cuidado com a contaminação entre clientes (motivo do reset atual) — vincular o rascunho LS ao `clienteId`.

### Opção 3 (mínima/imediata) — Corrigir a UI enganosa
- Enquanto não houver `projetoId`, deixar claro: "Rascunho não salvo — conclua a etapa 8 para persistir." Remover a afirmação de que o localStorage protege do refresh.

### Arquitetura-alvo
```
E2/E3 → POST /projetos-fv (rascunho) → projetoId no Context
E3..E7 → PUT /etapa (autosave já existe, agora ativo)
E8 → reusa projetoId; salvarTodosSlices garante consistência final
```
Checkpoint incremental por etapa = fonte única no Mongo; localStorage vira só cache opcional de retomada.

---

## RESPOSTAS OBRIGATÓRIAS

1. **Quando o projeto nasce no banco:** apenas na **etapa 8** (`E8Orcamento.jsx:354` → POST `/api/projetos-fv`).
2. **Quando ocorre o primeiro save real:** logo após a criação em E8, via `salvarTodosSlices` (7×PUT `/etapa` + beneficiárias em lote).
3. **O que fica só em memória:** o `arquivo` (File da fatura, excluído do LS) e todo o estado vivo do Context durante a sessão.
4. **O que fica só em localStorage:** o `state` serializável (tudo menos `arquivo`) — porém **write-only**: nunca é lido para restaurar e é apagado no mount sem `?id=`.
5. **O que é perdido ao fechar o navegador:** todo o preenchimento E1–E7 de um projeto não salvo (reabrir reseta).
6. **O que é perdido ao trocar de computador:** tudo — localStorage é local; o projeto não está no banco até E8.
7. **Existe autosave?** Hook existe, mas **morto para projeto novo** (condicionado a `projetoId`, que só nasce em E8). Ativo apenas em retomada (`?id=`).
8. **Gravidade real:** **ALTA**.
9. **Correção recomendada:** criar projeto rascunho em E2/E3 para ativar o autosave por slice já existente (Opção 1); complementar com restauração de LS e correção da UI enganosa.
10. **Commit gerado:** ver rodapé.

---

## VEREDITO

```
P0 CONFIRMADO — gravidade ALTA.
7 de 8 etapas sem persistência server-side; localStorage write-only (morto) e UI enganosa.
Sem perda de dado committed; recuperável por re-digitação. Correção não implementada (RCA).
```
