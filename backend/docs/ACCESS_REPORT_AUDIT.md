# P0-ACCESS-REPORT-AUDIT-01 — Auditoria do Parecer de Acesso (read-only)

> **100% read-only.** Nenhuma alteração de código/Atlas/templates/documentos. Auditoria
> ponta-a-ponta do módulo de Parecer/Homologação e seu consumo de Atlas/SSOT/engenharia.

## FASE 1 — Mapeamento

**Dois fluxos distintos:**

- **ENTRADA** (`pareceracessoController.js` · `POST /api/parecer-acesso/extrair`): recebe um PDF
  de **parecer da distribuidora**, extrai dados via Gemini e **cria um `ProjetoFV`** com **cópia
  (snapshot)** de marca/modelo/potência do equipamento.
- **SAÍDA** (geração de documentos):
  - `memorialDescritivoService.js` → `gerarMemorialDescritivo` / `gerarCartaConcessionaria` /
    `gerarDadosART` / `gerarChecklistDocumentos` — **templates de texto** a partir do `projeto`.
  - `homologacaoAssistida.js` → `gerarChecklist` / `validarDocumentos` / `montarPacoteDocumental`
    — **data-driven**, carrega Atlas **vivo** e valida certificações/rateio/regras da concessionária.

**Endpoints:** `/api/parecer-acesso/extrair`, `/api/parecer-acesso/:id/unifilar`,
`/…/homologacao/assistida/{checklist,validacao,pacote}`, `/homologacao/memorial`.
**Modelos Mongoose:** `ProjetoFV`, `Equipamento`, `UnidadeBeneficiaria`.
**Serviços:** memorialDescritivo, homologacaoAssistida, concessionariaProvider, concessionarias/*.

```
Projeto (ProjetoFV)
   ↓  equipamentos.{paineis[],inversor}  → _id refs + SNAPSHOT (marca/modelo/potência)
Dimensionamento (snapshot_tecnico / snapshots congelados)
   ↓
Catálogo (Equipamento @ Atlas)
   ├─►  CHECKLIST  → Equipamento.find({_id:$in}) = ATLAS VIVO  ✅
   └─►  MEMORIAL/CARTA/ART → projeto.equipamentos = SNAPSHOT (cópia)  ⚠
Parecer / Pacote documental
```

## FASE 2 — Dependências de dados (campos consumidos)

| Campo | Classe | Origem |
|---|---|---|
| potência inversor (CA) | **CRÍTICO** | snapshot do projeto (memorial) / Atlas (checklist) |
| potência módulo / kWp | **CRÍTICO** | projeto (`potencia_kwp`) |
| certificação INMETRO | **CRÍTICO** | **Atlas** `certificacao.inmetro` (checklist) |
| rateio / % beneficiárias | **CRÍTICO** | `UnidadeBeneficiaria` |
| concessionária | **CRÍTICO** | `projeto.homologacao.concessionaria` |
| normas IEC/NBR | **IMPORTANTE** | Atlas `certificacao.normas_iec` (parcial) |
| tensão CA / fases | IMPORTANTE | snapshot (memorial **hardcoda** 380/220V por nº de fases) |
| Voc/Isc/MPPT/corrente | IMPORTANTE | snapshot painel (memorial) / Atlas |
| geração esperada (kWh/ano) | OPCIONAL | **hardcode** `kWp × 131.44` |
| valor ART | OPCIONAL | **hardcode** (150/250/400) |

## FASE 3 — Atlas × Parecer (origem real dos dados) + hardcodes

- **Checklist:** vem do **Atlas vivo** (`Equipamento.find` por `_id`). ✅
- **Memorial/Carta/ART:** vêm do **snapshot do projeto** (cópia congelada), não do Atlas. ⚠
- **Hardcodes encontrados:** fator de geração `131.44` kWh/kWp·ano (sem irradiância/local);
  valores de ART `150/250/400`; tensão de saída `380V/220V` derivada de `fases` (não do
  `tensao_ac` do equipamento); mapa de checklist documental só com **CPFL** + default **COSERN**.

## FASE 4 — Consistência (Atlas → Projeto → Parecer)

**Há cópia intermediária.** O `ProjetoFV` guarda um **snapshot** de marca/modelo/potência (criado
na extração). Logo:
- **Checklist:** um dado alterado no catálogo **chega automaticamente** (lê Atlas por `_id`). ✅
- **Memorial/Carta:** um dado alterado no catálogo **NÃO chega** — usa o snapshot congelado. ⚠
- **🔴 Inconsistência de dialeto:** o memorial lê `inversor?.potenciaKW` (**camelCase**), mas o
  `ProjetoFV` persiste `inversor.potencia_kw` (**snake_case**) → **"N/A"** na potência do inversor
  quando o caller passa o projeto cru (`gerarMemorial` usa `req.body.projeto`). Risco real de
  campos "N/A" no documento gerado.

## FASE 5 — Beneficiárias

`UnidadeBeneficiaria` { `ucId`, `tipoRateio` (percentual|prioridade), `valor`, `titular`,
`cpf_cnpj`, `concessionaria`, `ativa` }.
- **Checklist:** `_rateioOk` valida soma = **100%** para rateio percentual; carregadas por
  `UnidadeBeneficiaria.find({projetoId})`. ✅ **UC principal + beneficiárias + rateio entram
  corretamente no checklist.**
- **Memorial/Carta:** **NÃO** incluem beneficiárias/compensação/rateio. ⚠ (lacuna no documento).

## FASE 6 — Engenharia (real vs inferido)

**🔴 O parecer NÃO diferencia valor real de valor inferido.** O `engineeringPresentation`
(`montarPayloadEngenharia`, badges 🟢/🟡/🟠) e o `engineeringFallback` **não são consumidos em
nenhum ponto** do parecer/checklist/memorial (`grep` confirma uso só no próprio arquivo + teste).
→ Um valor de **fallback conservador** aparece **idêntico** a um valor real no parecer. A camada
de proveniência construída nas sprints P1-ENGINEERING-* está **órfã** (não integrada à saída).

## FASE 7 — Homologação (normas)

`_temCert(eq, norma)` valida **INMETRO** + `normas_iec` do equipamento, conforme
`normas_obrigatorias` da concessionária. **Hoje só constam:**
- **INMETRO** (todas as distribuidoras) ✅
- **IEC 62116** (anti-ilhamento — Neoenergia/COSERN, Energisa) ✅
- **🟠 NÃO validados:** **IEC 62109**, **IEC 61727**, **NBR 16149**, **NBR 16150** — não estão em
  `normas_obrigatorias` nem no `_temCert`. O memorial cita apenas "Norma Técnica da Concessionária"
  genericamente. Deveriam ser exigidos no checklist (conjunto PRODIST/ABNT padrão).

## FASE 8 — Concessionárias

**Parametrizado por distribuidora** (não genérico no checklist): `concessionarias/grupos`
(CPFL, Enel, Energisa, Equatorial, Neoenergia) + independentes, com `normas_obrigatorias`,
`aliases`, `padroes_campos`, `padroes_documentais`, `readiness`. `obterRegras(concessionaria)`
alimenta o checklist. **Porém os documentos gerados (memorial/carta) são GENÉRICOS** — usam só o
**nome** da concessionária; `gerarChecklistDocumentos` só mapeia CPFL + default COSERN.
→ **Checklist parametrizado; documentos genéricos.**

## FASE 9 — Resultado

### Classificação: **B — Funciona, mas possui lacunas**
O **checklist de homologação** é sólido (Atlas vivo + regras por concessionária + rateio
validado). As lacunas concentram-se na **geração de documentos** (memorial/carta) e na
**não-integração da camada de engenharia/proveniência**.

### Respostas
1. **O parecer usa os dados corretos do Atlas?** **Parcialmente.** O *checklist* lê o **Atlas
   vivo** (correto); o *memorial/carta* usa o **snapshot** do projeto e tem **inconsistência de
   dialeto** (`potenciaKW`×`potencia_kw`) que pode gerar "N/A".
2. **Existe risco de divergência catálogo↔parecer?** **Sim, no memorial** (snapshot congelado —
   alteração no Atlas não chega). No checklist, **não** (lê Atlas por `_id`).
3. **Beneficiárias estão corretas?** **No checklist, sim** (rateio = 100% validado). **No
   memorial/carta, não aparecem.**
4. **Certificações entram no parecer?** **Parcial:** INMETRO + IEC 62116 (checklist). **Faltam
   IEC 62109/61727 e NBR 16149/16150.**
5. **O parecer é dependente de preenchimento manual?** **Sim, em parte:** o memorial depende dos
   dados enviados no `req.body` e exibe "N/A" para specs ausentes/de dialeto divergente; não puxa
   automaticamente do Atlas.
6. **Qual o maior risco atual?** **(1) Ausência de diferenciação real×inferido** (fallback
   aparece como dado real) + **(2) inconsistência de dialeto** que zera a potência do inversor no
   memorial + **(3) snapshot divergente** do Atlas.
7. **Próxima sprint recomendada?** **P1-PARECER-ENGINEERING-WIRE-01** — integrar
   `engineeringPresentation` ao parecer/memorial (badge real/inferido), corrigir o dialeto
   `potenciaKW→potencia_kw`, incluir **beneficiárias/rateio** e o **conjunto de normas
   PRODIST/ABNT** (62109/61727/16149/16150) no documento, e ler o **Atlas vivo** (ou snapshot
   versionado explícito) no memorial.

### Conclusão
O motor de **homologação assistida** (checklist) está em bom estado e usa o Atlas corretamente;
o **documento de parecer/memorial** está em **nível B**: funcional, porém com snapshot
divergente, inconsistência de dialeto, ausência de beneficiárias e da camada de engenharia
(real×inferido), e conjunto de normas incompleto. Nenhuma alteração foi feita (read-only).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Auditoria do Módulo de Parecer de Acesso/Homologação

A auditoria realizada é **sólida e abrangente**, cobrindo os principais aspectos do módulo de Parecer de Acesso/Homologação. A metodologia de mapeamento de fluxo, distinção entre Atlas-vivo e snapshot, e a análise de uso (grep) são adequadas para identificar as lacunas.

A **classificação B é justa**. O módulo funciona para a geração do checklist de homologação, que é a parte mais crítica e bem implementada. No entanto, as lacunas significativas na geração de documentos (memorial/carta) e na integração da camada de engenharia justificam a classificação, que se situa entre a produção pronta (A) e a necessidade de correções substanciais (C).

A **priorização do maior risco** (real vs. inferido, dialeto, snapshot) está correta. Estes são os pontos que podem levar a informações incorretas ou incompletas nos documentos gerados, impactando diretamente a qualidade e a confiabilidade do parecer.

**Pontos importantes que a auditoria pode ter deixado passar (ou que merecem reforço):**

*   **Tratamento de erros e validações:** Embora a auditoria mencione inconsistências, seria útil detalhar como o sistema lida com campos "N/A" ou dados ausentes. Há feedback para o usuário? O sistema falha ou gera um documento incompleto?
*   **Performance:** Para um módulo que lê o Atlas "vivo", a performance pode ser um fator a ser considerado em auditorias futuras, especialmente com o crescimento da base de dados.
*   **Segurança:** Embora seja um módulo "read-only", a auditoria poderia, em um contexto mais amplo, verificar se as permissões de acesso estão corretamente configuradas para evitar qualquer acesso indevido a dados sensíveis.
*   **Documentação:** A auditoria foca no código e nos dados. Uma análise sobre a documentação existente do módulo (se houver) e sua clareza também seria valiosa.

A **próxima sprint recomendada é adequada e prioriza os pontos mais críticos**. A integração da camada de engenharia, a correção do dialeto, a inclusão de beneficiárias/rateio e normas, e a leitura do Atlas vivo no memorial são passos essenciais para elevar a classificação do módulo.

---

### Veredito: **APROVADO COM RESSALVAS**

O módulo de Parecer de Acesso/Homologação demonstra uma base funcional sólida, especialmente na geração do checklist de homologação. No entanto, as lacunas identificadas na geração de documentos (memorial/carta) e na integração de funcionalidades cruciais como a camada de engenharia e a consistência de dados (dialeto, snapshot) exigem atenção e correções. A classificação B reflete precisamente essa situação: funcional, mas com margens claras para melhoria e mitigação de riscos. A aprovação com ressalvas reconhece o trabalho realizado, mas enfatiza a necessidade de implementar as recomendações para atingir um nível de qualidade superior.
