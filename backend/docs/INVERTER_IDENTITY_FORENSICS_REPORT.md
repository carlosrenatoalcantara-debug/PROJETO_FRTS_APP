# P0-INVERTER-IDENTITY-FORENSICS-01 — Identidade real dos inversores SUN2000

> **READ ONLY.** Nenhuma alteração em catálogo ou projetos. Nenhuma busca de datasheet.
> - **Data:** 2026-06-14 · **Executor:** Sonnet (Claude Code)
> - **Revisão Gemini:** ⚠️ OBRIGATÓRIA e PENDENTE

## VEREDITO

**O usuário está correto. Os `SUN2000G3-US-220` / `SUN2000G-US-220` são Deye em TODOS os dados.**
A "hipótese Huawei" levantada na sprint anterior foi **interpretação minha do relatório, não um dado** —
e a evidência a **refuta**. Existe Huawei no catálogo, mas em **outros 6 modelos** (`SUN2000-…KTL`),
de origem desconhecida, **com 0 projetos**, sem nenhuma relação com os projetos do usuário.

> 🔴 **Correção explícita do meu relatório anterior (P1-INVERTER-DATASHEET-ENRICH-01):**
> Eu escrevi que `Deye SUN2000G3-US-220` "provavelmente era Huawei mal rotulado". **Isso estava errado.**
> O dado bruto do SolarMarket grava literalmente `"DEYE SUN2000G3-US-220"`, o catálogo guarda
> `fabricante=Deye` / `fabricante_normalizado=DEYE`, e 146 projetos fazem bind para **Deye**. Não há
> Huawei algum nesses registros. Peço desculpas pelo ruído — esta sprint corrige o rumo.

---

## FASE 1 — Inventário de registros com SUN2000 (catálogo)

8 registros `Equipamento` contêm "SUN2000":

| Fabricante armazenado | Modelo | Origem | Nível | Projetos |
|---|---|---|---|---|
| **Deye** | **SUN2000G3-US-220** | `import_solarmarket` | invalido | **110** |
| **Deye** | **SUN2000G-US-220** | `import_solarmarket` | invalido | **36** |
| Huawei | SUN2000-30KTL-M3 | `desconhecido` | incompleto | 0 |
| Huawei | SUN2000-36KTL-M3 | `desconhecido` | incompleto | 0 |
| Huawei | SUN2000-40KTL-M3 | `desconhecido` | incompleto | 0 |
| Huawei | SUN2000-100KTL-M | `desconhecido` | incompleto | 0 |
| Huawei | SUN2000-100KTL-M2 | `desconhecido` | incompleto | 0 |
| Huawei | SUN2000-100KTL | `desconhecido` | suspeito | 0 |

São **dois conjuntos distintos**: os `*-US-220` (Deye, com projetos) e os `*-…KTL` (Huawei, sem projetos).

---

## FASE 2 — Fabricante por contexto (onde cada dado mora)

| Pergunta | Resposta | Evidência |
|---|---|---|
| 1. Fabricante **armazenado** (catálogo)? | **Deye** para os `*-US-220`; Huawei só para os `*-KTL` | `Equipamento.fabricante` / `identificacao.fabricante_normalizado=DEYE` |
| 2. Fabricante vindo do **SolarMarket**? | **DEYE** | `proposta_sm.equipamentos[].item` = `"DEYE SUN2000G3-US-220"` (110×), `"DEYE SUN2000G-US-220"` (45×) |
| 3. Fabricante em **proposta_sm**? | **DEYE** (string crua) | idem acima — amostra: `{categoria:"Inversor", item:"DEYE SUN2000G3-US-220"}` |
| 4. Fabricante em **pricingTable**? | Não existe campo `pricingTable` próprio; os itens de preço da proposta SM ficam em `proposta_sm.equipamentos[]`, onde lê-se **DEYE** | varredura de `proposta_sm` |
| 5. Fabricante em **observações**? | **Nenhuma menção a Huawei**; SUN2000 só aparece como Deye | varredura `observacoes/observacao` |

**Bind de inversor nos projetos:** 146 projetos referenciam `fabricante=Deye` para SUN2000. **0** para Huawei.

---

## FASE 3 — De onde veio "Huawei"?

| Hipótese | Conclusão |
|---|---|
| Huawei foi **inferido pelo matcher** (nos projetos do usuário) | ❌ **Não.** O matcher manteve **Deye**; o bind dos 146 projetos é Deye. |
| Huawei **veio da origem** (SolarMarket) | ❌ **Não.** `proposta_sm` traz **DEYE**; 0 ocorrências de Huawei em SM. |
| Huawei **não existe nos dados do usuário e foi só interpretação do relatório** | ✅ **SIM, para os `*-US-220`.** Huawei foi conclusão textual minha, não dado. |
| Huawei existe como **catálogo independente** | ✅ Sim: 6 modelos `SUN2000-…KTL` (origem `desconhecido`, 0 projetos) — nomes **genuinamente** Huawei, mas alheios aos projetos do usuário. |

**Presença de "Huawei" em todo o banco:** 7 registros — **todos** na coleção `Equipamento` (6 `SUN2000-…KTL` + 1 outro). **0** em `proposta_sm`, **0** em binds de projeto, **0** em observações.

---

## FASE 4 — Tabela Modelo × Fabricante × Projetos

| Modelo | Fabricante armazenado | Fabricante original (fonte) | Projetos afetados |
|---|---|---|---|
| SUN2000G3-US-220 | Deye | **DEYE** (proposta_sm SolarMarket) | **110** |
| SUN2000G-US-220 | Deye | **DEYE** (proposta_sm SolarMarket; 45 linhas SM, 36 projetos únicos) | **36** |
| SUN2000-30KTL-M3 | Huawei | — (origem `desconhecido`, sem SM) | 0 |
| SUN2000-36KTL-M3 | Huawei | — | 0 |
| SUN2000-40KTL-M3 | Huawei | — | 0 |
| SUN2000-100KTL-M | Huawei | — | 0 |
| SUN2000-100KTL-M2 | Huawei | — | 0 |
| SUN2000-100KTL | Huawei | — | 0 |

---

## FASE 5 — Respostas

1. **Quantos registros são realmente Deye?** → **2 modelos** (`SUN2000G3-US-220`, `SUN2000G-US-220`), confirmados por catálogo + normalização + proposta_sm + 146 binds = **146 projetos**.
2. **Quantos são realmente Huawei?** → **6 modelos** `SUN2000-…KTL` (+1 outro registro Huawei no catálogo). Nomes Huawei legítimos, **origem desconhecida**, **0 projetos** — não pertencem aos projetos do usuário.
3. **Quantos estão ambíguos?** → **0.** A identidade é inequívoca dos dois lados: `*-US-220` = Deye; `*-KTL` = Huawei.
4. **Quantos projetos seriam recuperados corrigindo APENAS essa classificação?** → **0.** Não há classificação errada a corrigir: os Deye **já estão** como Deye. O que bloqueia os **146 projetos** é `SEM_ESPECIFICACOES` (faltam specs), **não** fabricante incorreto. → A recuperação dos 146 depende de **enriquecimento por datasheet do Deye SUN2000G3-US-220 / SUN2000G-US-220**, não de reclassificação.

---

## Implicação para o enriquecimento (próximo passo)

- Tratar `SUN2000G3-US-220` e `SUN2000G-US-220` como **Deye** (confirmado por dado + usuário). Buscar o **datasheet Deye** correspondente — **não** procurar datasheet Huawei.
- Os 6 `SUN2000-…KTL` Huawei são **fora de escopo** (0 projetos); podem ser tratados depois ou arquivados.
- ROI real do par Deye US-220 = **146 projetos** (o maior alvo único do catálogo de inversores).
- ⚠️ Observação técnica (não bloqueia esta sprint): o nome "SUN2000G3-US-220" é atípico para a nomenclatura Deye usual (`SUN-xK-G…`). Como dado e usuário convergem em **Deye**, seguimos com Deye; convém confirmar o **SKU/datasheet exato** na hora do enriquecimento.

## Critério de aceite

| Critério | Status |
|---|---|
| Read only | ✅ |
| Sem alterar catálogo | ✅ |
| Sem alterar projetos | ✅ |
| Sem buscar datasheets ainda | ✅ |
| Revisão Gemini | ⚠️ PENDENTE |

## Entregável
- `INVERTER_IDENTITY_FORENSICS_REPORT.md` (este) · dados: `backend/reports/inverter-identity/IDENTITY_FORENSICS.json`
