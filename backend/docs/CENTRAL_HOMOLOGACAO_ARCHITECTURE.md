# Central de Homologação — Arquitetura Proposta

**Sprint:** P2-CENTRAL-HOMOLOGACAO-FORENSICS-01 · **Modelo:** Sonnet
**Tipo:** PROPOSTA ARQUITETURAL — SEM IMPLEMENTAÇÃO
**Revisão Gemini:** OBRIGATÓRIA E PENDENTE

> Arquitetura de **apoio operacional** — sem automação de portais, sem Selenium,
> sem login em sistemas externos, sem integração direta com concessionárias.
> Objetivo: centralizar, organizar e facilitar o copy/paste do operador nos portais das concessionárias.

---

## Premissas

- Toda interação com o portal da concessionária é **manual** (o operador faz o upload/preenchimento)
- O sistema fornece **dados prontos para cópia** e **documentos gerados** para reduzir o esforço manual
- Não substituir os portais das concessionárias — complementar o fluxo operacional
- Aproveitar máximo do que já existe (≈65% pronto) — a Central é reorganização, não recriação

---

## Onde a Central fica

**Rota:** `/projetos-fv/:id` → aba `Homologação` (já existe em ProjetosFVDetalhes)

A Central substitui o componente atual `Homologacao.jsx` (fv/homologacao) com uma versão expandida.
Mantém integração com snapshot/freeze (P1-HOMOLOGACAO-SNAPSHOT-01 — não regride).

---

## Estrutura de Abas (layout proposto)

```
┌─────────────────────────────────────────────────────────────────┐
│  CENTRAL DE HOMOLOGAÇÃO — [Nome do Projeto]                      │
│  [●] Neoenergia CELPE  |  Status: Em Preparação  |  ✓ 7/12      │
└─────────────────────────────────────────────────────────────────┘

[ Status ] [ Dados ] [ Documentos ] [ Checklist ] [ Histórico ]
```

### Aba 1 — Status (Dashboard)

**Componentes:**
- Card de progresso geral (barra de progresso + %) — já existe em ChecklistDocumentos
- Card de status atual com seletor (7 estados S9.0)
- Card "Próximo passo" derivado do status sugerido automático
- Card "Pendências críticas" (itens de checklist com erro/pendente)
- Campo editável: `numero_protocolo` (novo campo aditivo)
- Campo editável: `data_envio` (já existe no schema, sem UI)
- Alerta de SLA: se enviado há mais de 30 dias úteis, exibe aviso

**APIs existentes usadas:**
- `GET /assistida/checklist` (resumo)
- `GET /status` (status_homologacao)
- `PATCH /assistida/status` (alteração de status)

### Aba 2 — Dados para Submissão (Copy/Paste Central)

**Objetivo:** único local para o operador copiar cada campo necessário no portal da concessionária.

**Cards de dados:**

```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│ 👤 CLIENTE                      │  │ 📍 LOCALIZAÇÃO                   │
│ Nome: João Silva         [📋]   │  │ Endereço: R. das Palmeiras, 123  │
│ CPF:  123.456.789-00     [📋]   │  │ Cidade: Recife/PE        [📋]    │
│ Email: joao@email.com    [📋]   │  │ CEP: 50.000-000          [📋]    │
└─────────────────────────────────┘  │ Lat: -8.0527  Lon: -34.9286 [📋]│
                                     │ [🗺️ Abrir no Maps]              │
┌─────────────────────────────────┐  └─────────────────────────────────┘
│ ⚡ SISTEMA FV                   │
│ Potência: 8.25 kWp       [📋]  │  ┌─────────────────────────────────┐
│ Módulos: 15 × 550Wp      [📋]  │  │ 🔌 BENEFICIÁRIAS / RATEIO        │
│   Modelo: Canadian 550M  [📋]  │  │ UC 1234567-0 | 100%      [📋]   │
│ Inversor: Deye 8K-G03    [📋]  │  │ (ou lista de UCs com rateio)     │
│   Potência: 8 kW         [📋]  │  │ Soma: 100% ✓                    │
│ Concessionária: CELPE    [📋]  │  │ [Gerenciar Beneficiárias ↗]      │
│ Tensão: 220V             [📋]  │  └─────────────────────────────────┘
└─────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 👷 RESPONSÁVEL TÉCNICO                                           │
│ Nome: Eng. Carlos Mendes               CREA-PE 12345-D  [📋]    │
│ Especialidade: Engenharia Elétrica     [🔗 Portal CREA-PE]      │
└─────────────────────────────────────────────────────────────────┘
```

**Botão no topo:** "Copiar Tudo" → clipboard com todos os campos em formato texto

### Aba 3 — Documentos

**Layout em cards por documento:**

```
┌──────────────────────────────────────┐
│ 📄 Memorial Descritivo               │
│ Status: ○ Não gerado                 │
│ [Gerar] [Copiar] [Baixar PDF]        │
│ ✓ Usa snapshot congelado             │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ 📬 Carta à Concessionária            │
│ Status: ✓ Gerado                     │
│ [Ver] [Copiar] [Baixar PDF]          │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ 🏛️ Dados para ART                   │
│ Status: ○ Não obtido                 │
│ [Obter Dados] [Copiar]               │
│ [🔗 Portal CREA-PE]                 │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ 📊 Diagrama Unifilar                 │
│ Status: ✓ Snapshot disponível        │
│ [Ver Unifilar] [Baixar PNG]          │
└──────────────────────────────────────┘
```

**Bug a corrigir antes:** BUG-ART-01 (GET → POST para ART)

### Aba 4 — Checklist

**Estrutura existente mantida** (ChecklistDocumentos.jsx), com extensões:

```
Concessionária: [CELPE ▾]          Progresso: ████████░░ 8/12 (67%)

OBRIGATÓRIOS POR CONCESSIONÁRIA (CELPE/Neoenergia)
  ✓ ART de Projeto (CREA)
  ✗ Laudo de Conformidade          ← PENDENTE
  ✓ Datasheet dos equipamentos
  ✓ Certificado INMETRO — Inversor
  ✗ IEC 62116 (anti-ilhamento)     ← PENDENTE (Neoenergia exige)
  ✓ Memorial Descritivo
  ✓ Carta à Concessionária
  ✗ Formulário ESS-PEH             ← PENDENTE

AUTOMÁTICOS (verificação pelo sistema)
  ✓ RT atribuído ao projeto
  ✓ Rateio soma 100%
  ✓ Equipamentos aprovados
  ✗ Datasheets presentes           ← Goodwe GW8000-DT sem datasheet

[Salvar Checklist]  [Ver Regras da Concessionária]
```

### Aba 5 — Histórico

**Timeline de status:**

```
● 2026-06-18 → Em Preparação         por: renato@fortesolar.com.br
○ 2026-06-15 → Não Iniciado          (início do projeto)

Protocolo concessionária: [            ] [Salvar]
Data envio: [            ]

SLA: Prazo legal 30 dias úteis após envio
```

---

## Detalhamento de Concessionárias

| Concessionária | Formulário específico | Destaque |
|---|---|---|
| **Neoenergia** (COSERN/COELBA/CELPE/ELEKTRO) | ESS-PEH, Anexo III | IEC 62116 obrigatória + laudo conformidade |
| **Equatorial** | Formulário de Acesso | REN 1.000 padrão |
| **Enel** (SP/Rio/CE) | Formulário ENEL por estado | Atenção tensão 127V em partes de SP |
| **Energisa** | — | Padrão |
| **CEMIG** | GD-01 | Portal do Engenheiro |
| **CPFL** | — | Projeto de execução obrigatório + IEC 62116 |
| **COPEL** | Portal GD Online | Layout de telhado obrigatório |

**Observação ENEL:** precisa ser adicionada ao `concessionariaProvider.js` (GAP-10).

---

## Fluxo Operacional Sugerido

```
[Projeto aprovado + congelado]
         ↓
[Central de Homologação]
         ↓
[1] Conferir Dados (aba Dados)
    └─ Corrigir se necessário
         ↓
[2] Gerar Documentos (aba Documentos)
    ├─ Memorial → Copiar
    ├─ Carta → Copiar
    └─ ART → Copiar
         ↓
[3] Marcar Checklist (aba Checklist)
    └─ Itens automáticos + manuais
         ↓
[4] Acessar Portal da Concessionária (link direto por concessionária)
    └─ Colar dados / fazer upload dos documentos
         ↓
[5] Registrar Protocolo + Data de Envio (aba Status)
    └─ Status: Pendente Concessionária
         ↓
[6] Aguardar retorno (30 dias úteis)
    └─ Alerta de SLA se ultrapassar
         ↓
[7] Atualizar Status (Aprovado / Reprovado)
    └─ Histórico registrado
```

---

## Schema Aditivo Necessário (somente adições)

```js
// backend/src/models/ProjetoFV.js — campo homologacao (ADIÇÃO APENAS)
homologacao: {
  // Existentes — manter
  // Novos (aditivos):
  numero_protocolo: { type: String, default: null },       // protocolo da concessionária
  data_envio_real:  { type: Date,   default: null },       // data efetiva de envio
  retorno_previsto: { type: Date,   default: null },       // estimativa SLA
  concessionaria_grupo: { type: String, default: null },   // NEOENERGIA/EQUATORIAL/etc.
}
```

---

## O que NÃO será feito

- **Sem Selenium / automação de portal** — fora do escopo
- **Sem login em sistemas externos** — sem integração direta
- **Sem envio de email/ofício direto** — apenas geração de texto
- **Sem preenchimento automático de formulários** — apenas copy/paste assistido
- **Sem assinatura digital** — apenas geração do conteúdo para assinar externamente

---

## Honestidade

Todos os componentes descritos foram inventariados por leitura de código.
Nenhum código foi alterado nesta sprint.
Contagens de certficações/documentos no Atlas são estimativas (sem MONGODB_URI).
Revisão Gemini obrigatória e pendente.
