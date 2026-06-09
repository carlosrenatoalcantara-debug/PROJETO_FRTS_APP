# P1-MODULE-DATASHEET-FETCH-02 — Expansão da biblioteca de datasheets

> Objetivo: **maximizar a cobertura documental** dos módulos antes do próximo enriquecimento.
> **Sem alterar Atlas, sem enriquecer, sem alterar parser, sem Vision.** PDFs salvos só em
> `datasheets/Modulo/`, com **validação obrigatória** (fabricante + modelo no texto); **salva só
> classe A**.

## FASE 1–3 — Pendentes priorizados

Base: `MODULE_DATASHEET_SOURCING_INVENTORY.json` + `MODULE_DATASHEET_FETCH_MANIFEST.json` (4 já
obtidos no fetch-01). **101 modelos únicos pendentes** nos fabricantes prioritários — muitos são
**variantes da mesma família** (1 datasheet de série cobre várias potências por seleção de coluna).
Mirados os de **maior cobertura por arquivo**.

## FASE 4–5 — Fetch + validação (preferência: oficial → ENFSolar → distribuidor)

| Fabricante | Família / Modelo | Fonte | Bytes | Parser | Classe |
|---|---|---|---|---|---|
| **Trina** | TallmaxM **TSM-DE18** 540–560W | trinasolar.com (oficial) | 0,98 MB | 4/9 | **A ✅** |
| **DAH** | **DHM72X10** 540–555W | souenergy.com.br (distribuidor) | 0,65 MB | 5/9 | **A ✅** |
| **Canadian** | HiKu **CS3W-MS** 430–455W | canadiansolar.com (oficial) | 1,50 MB | 8/9 | **A ✅** |
| **Jinko** | **JKM540-560M-72HL4-V** | jinkosolar cdn (oficial) | 2,13 MB | 6/9 | **A ✅** |
| Astronergy | ASTRO N7 CHSM66RN 600-620 | astronergy.com | — | — | **C** (HTTP 403 hotlink) |
| Jinko | JKM530-550M-72HL4-(V) | jinkosolar.com | — | — | **C** (timeout — coberto pelo 540-560M-V) |

**Novos obtidos e validados: 4** (todos classe A — fabricante + modelo confirmados no PDF).
Nada inválido foi salvo. Rejeitados por **infra** (403/timeout), não por validação.

## FASE 6 — Estatísticas

1. **Novos datasheets obtidos:** **4** (Trina DE18, DAH DHM72X10, Canadian CS3W, Jinko 540-560M-V).
2. **Módulos agora com cobertura documental:** **49 / 161 (30%)** (repo + 8 datasheets FETCH).
3. **Cobertura acumulada:** **30%** — biblioteca FETCH passou de **4 → 8** datasheets; a cobertura
   subiu de ~22% (só repo+fetch-01) para **30%** (Trina +5, DAH +4, Canadian CS3W +2, Jinko -V +2).
4. **Fabricantes (quase) totalmente cobertos:** Resun (2/2), DMEGC (1/1), Topsola (1/1); **parciais
   fortes:** DAH 8/13, ZNShine 12/45, Risen 5/9, Canadian 5/9, Trina 5/10, Jinko 4/9, Sunova 2/3.
5. **Fabricantes ainda bloqueados:** **Leapton (0/10)**, **Honor (0/8)**, **Hanersun (0/3)**,
   **Maxeon (0/2)**, **Astronergy (0/2 — 403)**, **Longi (0/1)**, **Tongwei (0/1)**, + rebrands BR
   **Neosolar (0/4)**, **Sirius (0/2)**, **Minasol (0/1)**.

### Cobertura potencial por família (a confirmar no enrich)
Trina TSM-DE18 → 540/545/550/555/560 · DAH DHM72X10 → 550/555/FS · Canadian CS3W → 455MS/410P ·
Jinko 72HL4-V → JKM540M/550M · (+ fetch-01: Jinko-TV, JA JAM72S30, Canadian CS6W, Sunova SS).

## FASE 7 — Segurança e artefatos

✅ **Nenhuma alteração no Atlas.** · ✅ **Nenhum enriquecimento.** · ✅ **Nenhum parser alterado**
(usado só em leitura para validar). · ✅ **Nenhum registro criado.** Manifesto atualizado:
`MODULE_DATASHEET_FETCH_MANIFEST.json` (fetch-01 + fetch-02). PDFs em `datasheets/Modulo/`
(não versionados).

### Conclusão
Biblioteca documental **dobrada** (4 → **8** datasheets oficiais validados), elevando a cobertura
do catálogo de módulos para **~30% (49/161)**. As famílias de maior volume (Trina DE18, DAH
DHM72X10, Canadian CS3W/CS6W, Jinko 72HL4) estão cobertas e prontas para enriquecimento seguro com
**seleção de coluna por potência**. **Próximos passos:** (1) **continuar a campanha** para Leapton,
Honor, Hanersun, Astronergy (via fonte sem hotlink), Longi, ZNShine (modelos restantes); (2) re-rodar
**P1-MODULE-ENRICH-EXEC** sobre a biblioteca de 8 datasheets (ganho esperado de ~5 → ~25-30 módulos
enriquecíveis); (3) **P2-MODULE-VISION** para PDF-imagem; manual para rebrands BR (Neosolar/Sirius).

### Fontes (oficiais — WebSearch)
- [Trina TallmaxM TSM-DE18 (oficial)](https://static.trinasolar.com/sites/default/files/DT-M-0022%20C%20Datasheet_TallmaxM_DE18_EN_2024_A.pdf)
- [Canadian Solar HiKu CS3W-MS (oficial)](https://www.canadiansolar.com/wp-content/uploads/2019/12/Canadian_Solar-Datasheet-HiKu_CS3W-MS_EN.pdf)
- [Jinko Tiger Pro JKM540-560M-72HL4-(V) (oficial cdn)](https://jinkosolarcdn.shwebspace.com/uploads/63da19e2/JKM540-560M-72HL4-(V)-F3-EN.pdf)


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-MODULE-DATASHEET-FETCH-02

A sprint P1-MODULE-DATASHEET-FETCH-02 teve como objetivo expandir a biblioteca local de datasheets de módulos, focando em maximizar a cobertura documental sem alterar sistemas centrais. A abordagem de download, validação de fabricante/modelo e salvamento apenas de classe A foi executada.

**Avaliação:**

1.  **Priorizar famílias de série:** Sim, esta é uma estratégia **correta e eficiente** para maximizar a cobertura. Ao obter um único datasheet que abrange múltiplas potências, o impacto na cobertura total é significativamente maior do que focar em variantes individuais de baixa cobertura.

2.  **Validação fabricante+modelo e salvar só A:** A validação é **adequada e essencial** para garantir a integridade dos dados. Salvar apenas a classe A é uma boa prática para evitar a ingestão de dados de baixa qualidade ou irrelevantes, mantendo o foco na informação útil.

3.  **Rejeitar 403/timeout:** Sim, foi a decisão **certa**. Insistir em requisições que falham por motivos de infraestrutura (bloqueio de hotlink, timeouts) consumiria recursos sem garantia de sucesso e poderia até mesmo prejudicar a reputação do IP. A priorização de fontes acessíveis é mais produtiva.

4.  **Métrica de cobertura 30% com ressalva:** A métrica é **honesta e transparente**. A ressalva de que é aproximada (token match) é crucial, pois reconhece a limitação da validação atual e aponta para a necessidade de um enriquecimento mais aprofundado para confirmação definitiva.

5.  **Plano (continuar campanha + re-enrich + Vision + manual):** O plano é **correto e abrangente**. Ele aborda as lacunas identificadas, propõe a continuação da coleta, o aprimoramento da qualidade dos dados existentes e a exploração de novas fontes (Vision para PDFs imagem, manual para rebrands).

6.  **Algo a melhorar:**
    *   Considerar a implementação de um mecanismo de retry com backoff exponencial para requisições que falham temporariamente (timeout), em vez de rejeitá-las imediatamente, caso a fonte seja considerada de alta prioridade e não haja bloqueio explícito.
    *   Documentar explicitamente os critérios de "classe A" para garantir consistência futura.

7.  **Veredito:** **APROVADO COM RESSALVAS**

A sprint atingiu seus objetivos de forma eficaz, com uma estratégia de priorização inteligente e validação robusta. As ressalvas se referem a pequenas melhorias operacionais e de documentação para otimizar ainda mais o processo. O plano futuro é sólido e demonstra um caminho claro para aprimoramento contínuo.
