# P0-ASSET-MODEL-01 — Arquitetura do "Gêmeo Digital da Usina"

> Sprint de **modelagem READ-ONLY**. Nenhum código, schema ou Atlas alterado.
> Define a fundação da entidade `AtivoEquipamento` que registra **o que foi efetivamente
> instalado** (as-built), em oposição ao catálogo (Atlas), que registra **o que foi
> especificado** (as-specified).

---

## Princípio arquitetural

| Camada | Pergunta que responde | Onde vive hoje |
|---|---|---|
| **Catálogo** (`Equipamento` / Atlas) | "O que foi especificado?" — modelo, datasheet, specs | coleção `equipamentos` |
| **Projeto** (`ProjetoFV`) | "O que foi proposto/dimensionado?" — arranjos, quantidades | coleção `projetofvs` |
| **Ativo** (`AtivoEquipamento`) ← NOVO | "O que foi efetivamente instalado?" — nº de série, garantia, histórico | coleção `ativos_equipamento` (futura) |

O ativo é uma **unidade física rastreável** (1 documento por equipamento real instalado).
Um catálogo "Helius HMF144T10-570HL" é UM registro; 148 módulos instalados desse modelo são
**148 ativos**, cada um com seu número de série e histórico.

**Decisão-chave — coleção própria, NÃO embutir em `ProjetoFV`:**
1. **Restrição respeitada:** não altera `ProjetoFV`.
2. **Escala:** um projeto pode ter milhares de ativos (módulos serializados). Embutir
   estouraria o limite de 16 MB do documento Mongo.
3. **Ciclo de vida independente:** ativos são substituídos, transferidos e mantidos sem tocar
   no documento do projeto.
4. **Junção barata:** o vínculo é por referência (`projeto_id` + `arranjo_id`), e `arranjo_id`
   reusa o `arranjos[].id` (String) que o `ProjetoFV` **já gera**.

---

## FASE 1 — Modelagem da entidade `AtivoEquipamento`

```jsonc
{
  "_id": "ObjectId",
  // ── Vínculos ──────────────────────────────────────────────────────────────
  "projeto_id":     "ObjectId → ProjetoFV",     // a qual usina pertence
  "arranjo_id":     "String   → ProjetoFV.arranjos[].id",  // a qual bloco (multiarranjo)
  "equipamento_id": "ObjectId → Equipamento (catálogo)",   // o que foi ESPECIFICADO
  "cliente_id":     "ObjectId → Cliente",       // denormalizado p/ ownership/consulta rápida

  // ── Identidade física (as-built — pode divergir do catálogo se houve troca) ─
  "tipo":        "modulo|inversor|microinversor|otimizador|bess|carregador",
  "fabricante":  "String",   // snapshot do que foi instalado
  "modelo":      "String",
  "numero_serie":"String",   // chave única do mundo físico (por unidade)
  "qr_code":     "String",   // código institucional FORTE-xxx (único global, imutável)

  // ── Ciclo de vida ──────────────────────────────────────────────────────────
  "status": "planejado|instalado|operacional|manutencao|substituido|desativado",
  "data_instalacao":      "Date|null",
  "data_comissionamento": "Date|null",

  // ── Garantia ─────────────────────────────────────────────────────────────────
  "garantia_inicio": "Date|null",   // = data_comissionamento por padrão
  "garantia_fim":    "Date|null",

  // ── Conectividade (FASE 5 — por tipo) ───────────────────────────────────────
  "conectividade": {
    "mac_wifi":    "String|null",
    "senha_wifi":  "String|null",   // FUTURO — armazenar criptografado
    "firmware":    "String|null",
    "endereco_ip": "String|null"
  },

  // ── Substituição (cadeia de troca) ──────────────────────────────────────────
  "substitui_ativo_id":      "ObjectId|null",   // este ativo entrou no lugar de…
  "substituido_por_ativo_id":"ObjectId|null",   // …e foi trocado por este

  // ── Físico / livre ───────────────────────────────────────────────────────────
  "localizacao":  "String",   // pano/fileira/posição/string física
  "observacoes":  "String",

  // ── Histórico (FASE 6 — embutido) ───────────────────────────────────────────
  "historico": [ { "tipo": "", "data": "", "usuario": "", "descricao": "" } ],

  // ── Documentos (FASE 7 — RESERVADO, não implementado) ───────────────────────
  "documentos": [ { "tipo": "", "nome": "", "ref": "", "data": "", "hash": "" } ],

  "createdAt": "Date", "updatedAt": "Date"
}
```

**Mapa `tipo` (ativo) → `tipo` (catálogo Atlas):** o ativo é mais granular que o catálogo
porque O&M distingue micro de string e otimizador.

| Ativo (`tipo`) | Catálogo (`Equipamento.tipo`) |
|---|---|
| `modulo` | `modulo` |
| `inversor` / `microinversor` / `otimizador` | `inversor` |
| `bess` | `bateria` |
| `carregador` | `carregador_ev` |

> Por isso o ativo guarda `tipo` próprio + `fabricante`/`modelo` denormalizados: o snapshot
> as-built sobrevive mesmo que o item de catálogo mude ou o equipamento seja substituído por
> outro modelo.

---

## FASE 2 — Relação com Multiarranjo

```
Cliente
  └── ProjetoFV
        └── arranjos[]            (em ProjetoFV — INALTERADO)
              ├── id: "arr_A"     ← chave de junção
              └── id: "arr_B"
        ⇅ (referência por projeto_id + arranjo_id)
   AtivoEquipamento[]             (coleção própria)
        ├── { projeto_id, arranjo_id: "arr_A", numero_serie, ... }
        └── { projeto_id, arranjo_id: "arr_B", numero_serie, ... }
```

**Exemplo — Escola Pinheiro:**

| Arranjo | Inversor | Módulos | Ativos gerados |
|---|---|---|---|
| Arranjo 1 (`id="arr_1"`) | 1× SE33.3 | 74 | 1 ativo inversor + 74 ativos módulo (todos com `arranjo_id="arr_1"`) |
| Arranjo 2 (`id="arr_2"`) | 1× SE33.3 | 64 | 1 ativo inversor + 64 ativos módulo (todos com `arranjo_id="arr_2"`) |

Consulta dos ativos de um arranjo: `AtivoEquipamento.find({ projeto_id, arranjo_id })`.
Consulta de toda a usina: `AtivoEquipamento.find({ projeto_id })`.
**Compatível com microinversor:** cada micro é 1 ativo (`tipo='microinversor'`); o módulo a ele
acoplado é outro ativo — o vínculo físico fica em `localizacao` ou `observacoes` (e numa fase
futura, um campo `ativo_pai_id`). **Compatível com BESS:** 1 ativo `tipo='bess'` por bateria/rack.

---

## FASE 3 — Ciclo de Vida (máquina de estados)

```
                    instalação            comissionamento
   ┌───────────┐ ───────────────▶ ┌───────────┐ ──────────────▶ ┌────────────┐
   │ PLANEJADO │                  │ INSTALADO │                 │ OPERACIONAL│◀────┐
   └─────┬─────┘                  └─────┬─────┘                 └──────┬─────┘     │ reparo
         │ cancelado                    │ cancelado                    │ falha/    │ concluído
         ▼                              ▼                              ▼ inspeção  │
   ┌────────────┐ ◀────────────────────┴──────────────────┐    ┌────────────┐ ────┘
   │ DESATIVADO │ ◀───────────────────────────────────────┼─── │ MANUTENCAO │
   └────────────┘            descomissionamento            │    └──────┬─────┘
                                                           │           │ troca
                                              troca direta │           ▼
                                                           │    ┌─────────────┐
                                                           └──▶ │ SUBSTITUIDO │ (terminal)
                                                                └─────────────┘
```

**Transições válidas:**

| De → Para | Evento | Gera registro `historico` |
|---|---|---|
| PLANEJADO → INSTALADO | instalação | `instalacao` |
| PLANEJADO → DESATIVADO | cancelado antes de instalar | `mudanca_status` |
| INSTALADO → OPERACIONAL | comissionamento | `comissionamento` |
| INSTALADO → DESATIVADO | cancelado pós-instalação | `mudanca_status` |
| OPERACIONAL → MANUTENCAO | falha / inspeção | `falha` ou `inspecao` |
| MANUTENCAO → OPERACIONAL | reparo concluído | `manutencao` |
| MANUTENCAO → SUBSTITUIDO | troca | `troca` |
| OPERACIONAL → SUBSTITUIDO | troca direta | `troca` |
| OPERACIONAL → DESATIVADO | descomissionamento da usina | `mudanca_status` |

**Estados terminais:** `SUBSTITUIDO` e `DESATIVADO` (não retornam). `SUBSTITUIDO` preserva o
histórico e linka ao novo ativo (`substituido_por_ativo_id`).
**Transições inválidas (devem ser rejeitadas pela máquina de estado):** qualquer salto que
pule INSTALADO antes de OPERACIONAL; reativar SUBSTITUIDO/DESATIVADO; OPERACIONAL→INSTALADO.

---

## FASE 4 — Padrão de QR Code institucional

| Aspecto | Definição |
|---|---|
| **Formato** | `FORTE-<TIPO3>-<SEQ6>` — prefixo fixo + código do tipo + sequência de 6 dígitos com zero-padding |
| **Códigos de tipo** | `MOD` (módulo), `INV` (inversor), `MICRO` (microinversor), `OTIM` (otimizador), `BESS`, `CARR` (carregador) |
| **Exemplos** | `FORTE-MOD-000001`, `FORTE-INV-000001`, `FORTE-MICRO-000001`, `FORTE-BESS-000001` |
| **Unicidade** | **Global** (não por projeto). Índice **unique** em `qr_code`. Sequência **por tipo** via coleção atômica `contadores` (`findOneAndUpdate $inc` — NUNCA `Math.random`, evita colisão sob concorrência) |
| **Geração** | Server-side, na criação do ativo (status `planejado`). **Imutável** após atribuído |
| **Rastreabilidade** | O QR codifica a URL `https://app.fortesolar.com.br/ativo/<qr_code>`; o `<qr_code>` resolve para 1 `AtivoEquipamento` via índice. É a ponte para as fases Mobile/O&M |

> Esta sprint **define** o padrão; **não gera** QR nem implementa leitura (restrição).
> O campo `qr_code` e o índice único já fazem parte do design → a fase P1-ASSET-QR-CODE-01
> apenas preenche/renderiza, **sem refatorar**.

---

## FASE 5 — Política de Serial Number / Conectividade (por tipo)

| Campo | modulo | inversor | microinversor | otimizador | bess | carregador |
|---|---|---|---|---|---|---|
| `numero_serie` | **obrigatório** | **obrigatório** | **obrigatório** | **obrigatório** | **obrigatório** | **obrigatório** |
| `mac_wifi` | — (n/a) | opcional* | opcional* | — | opcional* | opcional* |
| `senha_wifi` | — | **futuro** | **futuro** | — | **futuro** | **futuro** |
| `firmware` | — | opcional | opcional | opcional | opcional | opcional |
| `endereco_ip` | — | opcional | — (via gateway) | — | opcional | opcional |

\* **opcional agora → obrigatório quando o monitoramento for ativado** (fase O&M).

- **Módulo:** equipamento passivo → só `numero_serie`. Sem conectividade.
- **Inversor / micro / bess / carregador:** `numero_serie` obrigatório; conectividade opcional
  até a fase de monitoramento.
- **`senha_wifi` = futuro:** campo sensível — quando implementado, **armazenar criptografado**
  (AES-256-GCM, padrão já existente no módulo de segurança do projeto), nunca em texto.

---

## FASE 6 — Estrutura de Histórico (embutido)

```jsonc
"historico": [
  {
    "tipo":      "instalacao|troca|garantia|manutencao|comissionamento|falha|inspecao|criacao|mudanca_status",
    "data":      "Date",
    "usuario":   "String (id/email do responsável)",
    "descricao": "String",
    // opcionais úteis (aditivos, sem quebrar o mínimo pedido):
    "status_de":   "String|null",
    "status_para": "String|null",
    "anexo_ref":   "String|null"
  }
]
```

Histórico **embutido** no ativo (não em coleção externa): a cardinalidade por ativo é baixa
(dezenas de eventos no ciclo de vida), e a leitura "linha do tempo do ativo" é sempre junto
do ativo — embutir é mais simples e performático. Eventos cobertos: instalação, troca,
garantia, manutenção, comissionamento, falha, inspeção (+ criação e mudança de status).

---

## FASE 7 — Documentos (planejamento, sem implementar)

`documentos[]` **reservado** no schema (não implementado nesta sprint):

```jsonc
"documentos": [
  { "tipo": "manual|datasheet|certificado|nota_fiscal|foto_instalacao|laudo",
    "nome": "", "ref": "", "data": "", "hash": "" }
]
```

Reusa o padrão já existente em `Equipamento.documentos_tecnicos`
(`tipo: datasheet|manual|inmetro|iec|declaracao|garantia`), estendido com `nota_fiscal`,
`foto_instalacao` e `laudo`. O **upload** (armazenamento, otimização de imagem) fica para a
fase Mobile/O&M — aqui só se **reserva o contrato**.

---

## FASE 8 — Impacto (respostas obrigatórias)

**1. Quantas entidades novas serão necessárias?**
**2 coleções:** `AtivoEquipamento` (principal) + `Contador` (sequência atômica para QR/serial).
Histórico e documentos ficam **embutidos** no ativo (não viram coleção). Opcionalmente, no
futuro, um `AtivoEvento` externo só se o volume de eventos crescer muito — não recomendado agora.

**2. Quais schemas serão alterados?**
**Nenhum nesta sprint** (design read-only). Na implementação (P1-ASSET-QR-CODE-01): criar
`models/AtivoEquipamento.js` + `models/Contador.js`. **Zero alteração** em schemas existentes.

**3. Qual impacto no `ProjetoFV`?**
**Zero estrutural.** O vínculo é por referência (`ativo.projeto_id` + `ativo.arranjo_id` →
`ProjetoFV.arranjos[].id`). O `arranjos[].id` (String) que já geramos é a chave de junção.
Opcional futuro: um *virtual populate* read-only para listar ativos — sem mudar o schema.

**4. Qual impacto no catálogo (Atlas)?**
**Zero.** O ativo **referencia** o catálogo (`equipamento_id` = "o que foi especificado"), mas é
independente. O catálogo permanece a fonte as-specified; o ativo é o as-built. Atlas intocado.

**5. Qual impacto no multiarranjo?**
**Zero — totalmente compatível.** `arranjo_id` é o `arranjos[].id` existente. Em **ampliação**,
o novo arranjo (`tipo='ampliacao'`) recebe novos ativos com o `arranjo_id` dele; os ativos do
arranjo congelado (`tipo='existente'`) permanecem ligados ao id original. Nada a refatorar.

**6. O QR Code pode ser implementado sem refatoração futura?**
**Sim.** `qr_code` já está no design, com índice único e imutabilidade. A fase QR só **gera e
renderiza**; Mobile/O&M só **leem por `qr_code`** (resolução O(1) via índice). Nenhuma mudança
estrutural será necessária.

---

## Critérios de Aceite

| Critério | Status | Como o design garante |
|---|---|---|
| Compatível com multiarranjo | ✅ | `arranjo_id` = `ProjetoFV.arranjos[].id`; consulta por projeto/arranjo |
| Compatível com microinversor | ✅ | `tipo='microinversor'` distinto; 1 ativo por micro |
| Compatível com BESS | ✅ | `tipo='bess'`; mapeia p/ catálogo `bateria` |
| Compatível com ampliações | ✅ | novos ativos no `arranjo_id` da ampliação; existentes intactos |
| Compatível com substituição | ✅ | estado `SUBSTITUIDO` + cadeia `substitui_/substituido_por_ativo_id` |
| READ-ONLY (sem código/Atlas/ProjetoFV) | ✅ | só documentos `.md` |
| Revisão LLM obrigatória | ✅ | inline abaixo |
| Commit separado | ✅ | (pendente) |

---

## Revisão Gemini (Inline)

> Veredito: **APROVADO**

**1. A separação as-specified vs as-built está correta?** Sim. Catálogo = molde; ativo =
instância física com serial. Denormalizar `tipo/fabricante/modelo` no ativo é a escolha certa:
preserva o registro histórico mesmo se o item de catálogo for editado ou o equipamento trocado.

**2. Coleção própria vs embutir em `ProjetoFV`?** Coleção própria é a única opção viável:
respeita a restrição de não alterar `ProjetoFV`, escala para milhares de módulos (limite de
16 MB) e dá ciclo de vida independente. A junção por `projeto_id + arranjo_id` é barata e usa o
`arranjos[].id` que já existe.

**3. A máquina de estados é completa?** Sim — cobre os 6 estados pedidos, transições válidas
documentadas, terminais explícitos (SUBSTITUIDO/DESATIVADO) e a cadeia de substituição linkada.
Recomenda-se que a implementação valide as transições server-side (rejeitar saltos inválidos).

**4. QR/serial à prova de refatoração?** Sim. `qr_code` único+imutável e sequência atômica via
`Contador` (não `Math.random` — lição herdada dos sprints de catálogo sobre hashing/idempotência)
garantem que QR-CODE-01, MOBILE-01 e OM-01 apenas consumam o que já está modelado.

**5. Pontos de atenção para a implementação.** (a) `senha_wifi` deve ser criptografada
(AES-256-GCM já disponível no projeto). (b) Índices recomendados: `qr_code` (unique),
`numero_serie` (unique parcial — só quando presente), `{projeto_id, arranjo_id}`, `status`.
(c) O acoplamento físico micro↔módulo pode pedir um `ativo_pai_id` na fase O&M — já previsto
como evolução aditiva, sem refatorar.

---

## Entregáveis desta sprint

| Arquivo | Conteúdo |
|---|---|
| `ASSET_MODEL_ARCHITECTURE_REPORT.md` | este relatório (8 fases + impacto + revisão) |
| `ASSET_MODEL_ENTITY_DIAGRAM.md` | schema completo, diagrama ER e máquina de estados |
| `ASSET_MODEL_ROADMAP.md` | roteiro P1-ASSET-QR-CODE-01 → MOBILE-01 → OM-01 |
