# Central de Homologação — MVP (Relatório de Implementação)

**Sprint:** P1-CENTRAL-HOMOLOGACAO-MVP · **Modelo:** Opus 4.8
**Branch:** `sprint/p1-bug-art-01` (continuação) → recomenda-se branch própria no merge
**Data:** 2026-06-18
**Revisão Gemini:** OBRIGATÓRIA E PENDENTE (antes de deploy)
**Tipo:** Implementação MVP — reorganização, sem nova arquitetura

> Central **operacional** de apoio: consolida o que já existe na Forte Solar para
> facilitar o preenchimento manual dos portais. **Sem Selenium, sem automação de
> portais, sem login externo, sem integração com concessionárias.**

---

## FASE 1 — Auditoria de Reúso

| Item | Tipo | Responsabilidade | Reaproveitado |
|---|---|---|---|
| `obterEquipamentosEngenharia(projeto)` | função (engenhariaGovernanca.js) | Resolve equipamentos snapshot vs catálogo vivo | ✅ Dados + Equipamentos |
| `getHistoricoTipoConfig(tipo)` | função | Rótulo/ícone de eventos de governança | ✅ Histórico |
| `BeneficiariasPainel` | componente | CRUD + rateio (%/prioridade) de UCs | ✅ aba Beneficiárias (sem duplicação) |
| `ChecklistDocumentos` | componente | Checklist por concessionária + status | ✅ aba Checklist |
| `MemorialDescritivo` | componente | Gera memorial (POST /memorial) | ✅ aba Documentos |
| `CartaConcessionaria` | componente | Gera carta (POST /carta) | ✅ aba Documentos |
| `DadosART` | componente | Dados p/ ART (POST /art — corrigido no BUG-ART-01) | ✅ aba Documentos |
| `GET /beneficiarias/resumo` | endpoint | Lista UCs + rateio | ✅ Dados (UC/CPF/concessionária) |
| `projeto.localizacao` (V3) | dado | lat/lon, cidade, estado, endereço | ✅ Dados |
| `projeto.dimensionamento` (V3) | dado | potencia_kwp | ✅ Dados |
| `projeto.governanca.historico` | dado | eventos do ciclo de vida | ✅ Histórico |
| `projeto.homologacao.historico_status` | dado | timeline S9.0 | ✅ Histórico |
| `Button` (ui) | componente | botões padronizados | ✅ Histórico/Documentos |

**Conclusão:** ~65% reutilizado integralmente. O MVP é reorganização + 4 componentes novos
de apresentação + 1 campo persistido (protocolo).

---

## FASE 2 — Estrutura da Central

`Homologacao.jsx` reescrito como hub de **6 sub-abas**, responsivo (scroll horizontal no
mobile via `overflow-x-auto`):

```
[ Dados ] [ Equipamentos ] [ Beneficiárias ] [ Documentos ] [ Checklist ] [ Histórico ]
```

Banner de cabeçalho mostra concessionária/estado e badge "Orçamento congelado" quando aplicável.

---

## FASE 3 — Aba Dados

Componente novo `CentralDados.jsx`. Seções copiáveis (botão por campo + "Copiar seção" + "Copiar tudo"):

- **Cliente:** Nome, CPF/CNPJ, UC/Conta Contrato (via `/beneficiarias/resumo`)
- **Concessionária:** Concessionária, Status Atual (S9.0 ou legado), Protocolo
- **Localização:** Município, Estado, Latitude, Longitude, Endereço + link Google Maps
- **Sistema FV:** Potência Instalada (kWp), Potência Inversores (kW × qtd), Tipo de Conexão

Objetivo cumprido: facilitar preenchimento manual dos portais.

---

## FASE 4 — Aba Equipamentos

Componente novo `CentralEquipamentos.jsx`. Usa **`obterEquipamentosEngenharia()`** (sem duplicar
lógica). Exibe Módulos e Inversores (fabricante, modelo, potência, quantidade), arranjos
adicionais e itens adicionais. Quando congelado, exibe em destaque:

> **DADOS CONGELADOS DO ORÇAMENTO APROVADO**

Normalizador interno trata as duas formas (snapshot normalizado vs catálogo vivo).

---

## FASE 5 — Aba Beneficiárias

Reutiliza **`BeneficiariasPainel`** diretamente (`projetoId`). Sem duplicação de código.
Exibe percentual/prioridade, UC, titular, CPF/CNPJ — tudo já implementado no componente.

---

## FASE 6 — Aba Documentos

Componente novo `CentralDocumentos.jsx` que **consolida** os 3 geradores existentes em
cartões-seletor (Memorial / Carta / ART). **Não recria geradores** — apenas monta os
componentes existentes. Cada gerador mantém seu próprio estado de "gerado/pendente".

---

## FASE 7 — Aba Checklist

Reutiliza **`ChecklistDocumentos`** (estado, concessionária). Status, pendências e documentos
obrigatórios por concessionária — inalterado.

---

## FASE 8 — Aba Histórico

Componente novo `CentralHistorico.jsx`. Timeline consolidada a partir dos históricos
**já existentes** (`governanca.historico` + `homologacao.historico_status`), ordenada do mais
recente ao mais antigo. **Não cria engine nova de eventos** — apenas lê e apresenta.

---

## FASE 9 — Protocolo

Campo **Protocolo da Concessionária** (opcional) na aba Histórico.

- Schema aditivo em `ProjetoFV.homologacao`: `numero_protocolo`, `protocolo_atualizado_em`, `protocolo_historico[]`
- Endpoint novo: `PATCH /api/projetos-fv/:projetoId/homologacao/protocolo` (persistido no Atlas, auditado)
- UI: input + salvar + histórico de alterações
- Atualização propaga para o estado local da Central (`onAtualizar`)

---

## FASE 10 — Validação

| Cenário | Comportamento esperado | Verificado por |
|---|---|---|
| Projeto novo (não congelado) | Equipamentos do catálogo vivo; banner âmbar | Leitura de código + build |
| Projeto legado (sem localizacao V3) | Campos caem para `projeto.cidade/estado/potencia_kwp`; ausentes = "—" | Defensivo no código |
| Projeto congelado | "DADOS CONGELADOS DO ORÇAMENTO APROVADO"; snapshot usado | `obterEquipamentosEngenharia` |
| Projeto homologado | Idem congelado (freeze_status HOMOLOGADO) | `obterEquipamentosEngenharia` |
| Snapshot | Memorial/Carta/ART usam snapshot (lógica original preservada) | Componentes inalterados |
| Beneficiárias | CRUD e rateio funcionam como antes | Componente reutilizado |
| Memorial/Carta | POST inalterados | Componentes reutilizados |
| ART | POST (corrigido no BUG-ART-01) | Componente reutilizado |

> ⚠️ Validação foi feita por **leitura de código + build Vite**. **Não houve teste de
> integração em ambiente real (Railway/Atlas)** — requer deploy.

---

## Honestidade

- **Build executado:** ✅ Vite `✓ built in 11.72s`, 0 erros (2327 módulos, +5 componentes)
- **Syntax-check backend:** ✅ `node --check` em routes e model — OK
- **Testes automatizados:** ❌ não executados (sem runner configurado para estes componentes)
- **Ambiente real (Railway/Atlas):** ❌ não utilizado — protocolo PATCH não exercido contra DB real
- **Snapshot/Governança/Catálogo/Segurança:** não alterados
- Revisão Gemini **obrigatória antes do deploy**
