# P0-CERTIFICATION-SYSTEM-01 — Auditoria do sistema de certificações (read-only)

> **100% read-only.** Sem alterar Atlas/catálogo/parser/memorial/parecer. Inventário real do
> Atlas (113 equipamentos) + fluxo até os documentos.

## FASE 1 — Onde as certificações são armazenadas

| Local | Estrutura | Lido por |
|---|---|---|
| `Equipamento.certificacao.inmetro` | `{ numero, validade, certificado }` — **estruturado** | checklist `_temCert`, memorial 10.1 |
| `Equipamento.certificacao.normas_iec` | `Mixed []` `[{ norma, laboratorio, validade, modelos }]` — **semiestruturado** | checklist `_temCert`, memorial 10.1 |
| `Equipamento.especificacoes.certificacoes` | **String livre** (ex.: "IEC 62109, IEC 61727, NBR 16149") | **ninguém** (órfão) |
| `concessionariaProvider.normas_obrigatorias` | regras por distribuidora | checklist |

## FASE 2 — Inventário real do Atlas (113 equipamentos)

**Campo estruturado (`certificacao{}`) — o que os validadores leem:**

| Norma | Estruturado | Texto livre (`especificacoes.certificacoes`) |
|---|---|---|
| **INMETRO** | **0** | 2 (menção) |
| IEC 62109 | 0 | 24 |
| IEC 61727 | 0 | 32 |
| IEC 62116 | 0 | 1 |
| NBR 16149 | 0 | 2 |
| NBR 16150 | 0 | 2 |

→ **O campo estruturado está 100% VAZIO (0/113).** Existe dado real, mas só em **texto livre**
(`especificacoes.certificacoes`) em **32/113** equipamentos.

**Por tipo:**

| Tipo | Total | Com texto de certificação |
|---|---|---|
| **inversor** | 41 | **32** (78%) |
| **módulo** | 56 | **0** |
| **carregador_ev** | 16 | **0** |

→ **Módulos (56) e EV (16) = 72 equipamentos sem NENHUM dado de certificação.**

## FASE 3 — Classificação

| Classe | Qtde | |
|---|---|---|
| **Estruturado** | **0** | campo `certificacao{}` populado + normas como objetos |
| **Parcialmente estruturado** | **0** | — |
| **Texto livre** | **32** | inversores com `especificacoes.certificacoes` (string) |
| **Ausente** | **81** | 56 módulos + 16 EV + 9 inversores sem texto |

## FASE 4 — Fluxo Atlas → Projeto → Memorial → Parecer

- **Checklist (`homologacaoAssistida._temCert`):** lê `certificacao.inmetro.numero` +
  `certificacao.normas_iec` → **ambos vazios** → marca **TODOS** os equipamentos como sem a
  certificação obrigatória (INMETRO) → homologação sempre em não-conformidade.
- **Memorial 10.1 (P1-PARECER-ENGINEERING-WIRE):** lê `certificacao{}` → vazio → sempre exibe
  *"Certificações a validar no checklist"*.
- **Texto livre (`especificacoes.certificacoes`)** dos 32 inversores **não é lido** por nenhum
  dos dois → **as certificações reais não chegam aos documentos**.

→ **As certificações NÃO chegam corretamente aos documentos.** O campo que o sistema consome
está vazio; o dado que existe está num campo órfão.

## FASE 5 — Normas exigidas por tipo (código × esperado PRODIST/ABNT)

| Tipo | Exigido no código (`normas_obrigatorias`) | Esperado (ANEEL/PRODIST/ABNT) |
|---|---|---|
| Inversor **monofásico** | INMETRO | INMETRO + NBR 16149 + NBR 16150 + IEC 62116 |
| Inversor **trifásico** | INMETRO (+IEC 62116 em Neoenergia/Energisa) | INMETRO + NBR 16149/16150 + IEC 62109/62116/61727 |
| **Híbrido** | INMETRO | idem trifásico + IEC 62619 (bateria) |
| **Microinversor** | INMETRO | INMETRO + NBR 16149/16150 + IEC 62116 |
| **Carregador EV** | — (sem regra) | INMETRO/Portaria + IEC 61851 |
| **Bateria** | — (tipo inexistente) | IEC 62619 / UN 38.3 |

→ O modelo de exigências do código é **incompleto** (essencialmente só INMETRO + IEC 62116);
EV e bateria não têm regra.

## FASE 6 — Lacunas

| Prioridade | Lacuna |
|---|---|
| **P0** | Campo estruturado `certificacao{}` **100% vazio** → checklist/memorial não funcionam; **INMETRO (obrigatório por lei) ausente em 100%**; módulos (56) e EV (16) sem qualquer dado |
| **P0** | Certificações reais existem só em **texto livre órfão** (32 inversores) — não chegam aos validadores/documentos |
| **P1** | Modelo de `normas_obrigatorias` incompleto (falta NBR 16149/16150, IEC 62109/61727 no checklist; EV/bateria sem regra) |
| **P1** | Sem `registro_inmetro` para nenhum equipamento (nem número, nem validade) |
| **P2** | Sem rastreio de `validade`/`laboratorio`/`modelos` por norma; sem alerta de vencimento |

## FASE 7 — Respostas

1. **Quantos equipamentos possuem certificações completas?** **0** — nenhum tem o conjunto
   estruturado, e nem os 32 com texto livre têm **INMETRO** (a obrigatória).
2. **Quantos estão incompletos?** **113** (todos): 32 com dado parcial em texto livre + 81 ausentes.
3. **Quais fabricantes estão melhores?** **Solplanet** (IEC 62109/61727 + NBR 16149/16150 + 62116
   em texto), **Goodwe** e **Chint** (IEC 62109/61727) — todos **inversores**, mas só em texto livre.
4. **Quais fabricantes estão piores?** Todos os de **módulo** (ZNShine 29, Trina, Risen, Canadian,
   Renesola) e de **EV** (Wallbox, Intelbras, Schneider, Tesla, BYD…) — **0 dado de certificação**.
5. **O parecer usa todas as certificações disponíveis?** **NÃO** — lê apenas o campo estruturado
   (vazio) e **ignora o texto livre** dos 32 inversores. Na prática **não usa nenhuma**.
6. **Qual o maior risco atual?** **INMETRO ausente em 100%** + campo estruturado vazio → o parecer/
   homologação **não conseguem comprovar conformidade legal**; a homologação reprovaria todo
   projeto por falta de INMETRO. **Risco regulatório P0.**
7. **Próxima sprint recomendada?** **P1-CERTIFICATION-BACKFILL-01** — (a) parser/migrador que
   **estrutura** o texto livre `especificacoes.certificacoes` → `certificacao.normas_iec` (read→write
   controlado); (b) campanha de captura de **número INMETRO** (a partir do datasheet/registro INMETRO);
   (c) completar `normas_obrigatorias` (NBR 16149/16150, IEC 62109/61727, regras EV/bateria).

### Conclusão
O **esquema e a lógica** de certificação existem (estruturado + checklist + memorial 10.1), mas o
**dado estruturado está 100% vazio** — INMETRO ausente em todos os 113 equipamentos e as normas
IEC/NBR reais ficam presas em **texto livre órfão** (32 inversores), sem chegar aos validadores/
documentos. **Risco regulatório P0.** Nada foi alterado (read-only).


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Auditoria do Sistema de Certificações

A auditoria é **clara, detalhada e bem estruturada**, cobrindo os pontos cruciais do sistema de certificações. A abordagem "read-only" garante a integridade da análise.

**Avaliação dos Pontos:**

1.  **Distinção Campo Estruturado vs. Texto Livre:** A distinção é **tecnicamente importante e bem feita**. A auditoria demonstra claramente que o sistema *espera* dados em um formato estruturado (`certificacao{}`) para processamento, mas os dados reais estão em um formato não processável (`especificacoes.certificacoes`). A identificação do campo como "órfão" é precisa.

2.  **Conclusão de Risco Regulatório P0 (INMETRO 0%):** A conclusão é **correta e justificada**. A ausência de INMETRO em 100% dos equipamentos, sendo esta a norma obrigatória por lei para todos, representa um risco regulatório gravíssimo (P0). A homologação reprovaria todos os projetos.

3.  **Contagem por Norma/Tipo/Fabricante:** A metodologia de extrair dados do texto livre para realizar a contagem é **sólida e necessária** dada a situação. É a única forma de quantificar a existência de certificações reais, mesmo que em formato inadequado.

4.  **Classificação dos Melhores/Piores:** A classificação é **justa**, refletindo a realidade dos dados encontrados. Os "melhores" (Solplanet, Goodwe, Chint) possuem alguma informação de certificação, ainda que em texto livre. Os "piores" (fabricantes de módulo e EV) não possuem *nenhum* dado, o que é mais crítico.

5.  **Próxima Sprint (Backfill Estruturado):** A próxima sprint proposta é **certamente a certa**. Abordar a estruturação do texto livre, a captura do INMETRO e a correção das regras de `normas_obrigatorias` são passos essenciais para resolver as lacunas identificadas e mitigar o risco P0.

6.  **Algo Deixado Passar?** A auditoria é abrangente. Um ponto adicional a considerar, embora talvez fora do escopo "read-only", seria a **causa raiz** da ausência de dados estruturados e a presença de dados em texto livre. Isso pode indicar falhas no processo de ingestão de dados, na interface de cadastro ou na própria modelagem do sistema. No entanto, para uma auditoria focada no estado atual, o trabalho está completo.

**Veredito:**

**APROVADO COM RESSALVAS**

A auditoria é excelente e identifica um problema crítico com clareza. As ressalvas se referem à gravidade da situação encontrada, que exige ação imediata, e não a falhas na auditoria em si. A recomendação para a próxima sprint é acertada e deve ser priorizada.
