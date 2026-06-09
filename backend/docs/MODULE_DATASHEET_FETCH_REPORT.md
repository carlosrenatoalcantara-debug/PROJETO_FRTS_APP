# P1-MODULE-DATASHEET-FETCH-01 — Download de datasheets de módulos (piloto)

> Objetivo: construir a **biblioteca documental** (download de datasheets oficiais) para destravar
> o enriquecimento. **Sem enriquecer, sem alterar Atlas, sem alterar parser.** Downloads salvos em
> `datasheets/Modulo/` (biblioteca local, fora do Atlas/repo). Cada PDF é **validado** (modelo +
> fabricante presentes no texto) antes de ser mantido.

## FASE 1–2 — Inventário e priorização

Base: `MODULE_DATASHEET_SOURCING_INVENTORY.json` (A=17, B=86, C=58). Priorizados os Tier-1 de maior
volume e melhor documentação pública (Jinko, JA Solar, Canadian, Longi, Trina, Sunova…). Este
**piloto** mira **6 modelos** representativos para **provar o pipeline fetch→validação→biblioteca**.

## FASE 3–4 — Fetch + validação (DoH + https; validação obrigatória)

Pipeline: resolver DNS via DoH → baixar PDF → extrair texto → **exigir modelo + fabricante no
texto** → salvar só se confirmado.

| Fabricante | Modelo | Fonte | Bytes | Parser | Classe |
|---|---|---|---|---|---|
| **Jinko** | JKM530M-72HL4-TV | jinkosolar.com.au (oficial) | 2,67 MB | 7/9 | **A — confirmado** ✅ |
| **JA Solar** | JAM72S30-550/MR | jasolar.com (oficial) | 9,44 MB | 1/9 ⚠ | **A — confirmado** (PDF-imagem → Vision) |
| **Canadian** | CS6W-550MS (HiKu6) | csisolar.com (oficial) | 0,67 MB | 5/9 | **A — confirmado** ✅ |
| **Sunova** | SS-550-72MDH | solartex.cl (revendedor) | 0,88 MB | 8/9 | **A — confirmado** ✅ |
| JA Solar | JAM66D45-600/LB | e-solar.co.jp | 1,34 MB | 0/9 | **C — rejeitado** (PDF-imagem, tokens ausentes) |
| Longi | LR5-72HPH-545M | solar-europe.co.za | — | — | **C — rejeitado** (HTTP 502) |

**Obtidos e validados: 4** (todos classe A — modelo + fabricante confirmados no PDF).
**Rejeitados: 2** (1 PDF-imagem não-validável; 1 falha de servidor 502). Nada inválido foi mantido.

## FASE 5 — Auditoria

1. **Datasheets obtidos:** **4** (de 6 alvos do piloto; 8 tentativas com fontes alternativas).
2. **Modelos cobertos:** **4 exatos**; por serem **datasheets de série**, cobrem
   **potencialmente até ~10** módulos do catálogo (seleção de coluna por potência) — **a confirmar**
   na sprint de enriquecimento (alguns são variantes distintas, ex.: Jinko JKM565**N** é N-type e
   **não** é coberto pelo datasheet P-type 530–550M).
3. **Permanecem sem documento:** a maioria — o piloto mirou 6 dos ~144 pendentes (B+C).
4. **Cobertura por fabricante (após piloto):** Jinko, Canadian, Sunova → datasheet **text-parseável**
   ✅; JA Solar JAM72S30 → obtido mas **PDF-imagem** (depende de Vision); Longi / JA JAM66D45 →
   pendentes (502 / imagem).
5. **Ganho potencial:** **3 datasheets text-parseáveis** (Jinko/Canadian/Sunova) habilitam
   enriquecimento seguro imediato de ~6–8 módulos de série; +1 (JA JAM72S30) via Vision (P2).

### Cobertura potencial no catálogo (a revalidar no enrich)
Jinko 72HL4 P-type (JKM530M/540M/550M) · Canadian CS6W (545M/550MS/540MB-AG) · Sunova SS 72MDH
(550/555) · JA JAM72S30-550/MR (via Vision). ⚠ Exclui variantes de outra tecnologia (ex.: N-type).

## FASE 6 — Segurança

✅ **Nenhuma alteração no Atlas** (não conectado para escrita). · ✅ **Nenhum enriquecimento
executado.** · ✅ **Nenhum parser alterado** (parser apenas usado em modo leitura para validar). ·
✅ **Nenhum registro criado.** · Downloads gravados **somente** em `datasheets/Modulo/` (biblioteca
local), com validação modelo+fabricante. Manifesto: `MODULE_DATASHEET_FETCH_MANIFEST.json`.

### Conclusão
O **pipeline fetch→validação→biblioteca está provado e seguro**: download via DoH, **validação
obrigatória (modelo + fabricante no PDF)** e descarte de PDFs-imagem/não-validáveis. **4 datasheets
oficiais** adicionados (3 text-parseáveis + 1 imagem), cobrindo potencialmente ~8–10 módulos.
**Próximos passos:** (1) **continuar a campanha** de fetch para os demais Tier-1 (Jinko outros,
Trina, Astronergy, Risen, ZNShine, DAH, Leapton, Honor, Hanersun) e tratar 404/502/TLS com fontes
alternativas; (2) re-rodar **P1-MODULE-ENRICH-EXEC** sobre a biblioteca ampliada; (3)
**P2-MODULE-VISION-01** para os PDF-imagem (JA JAM72S30, JAM66D45 etc.). Casos manuais persistem:
Neosolar/Sirius (rebrand BR), Minasol/Topsola (regionais).

### Fontes (WebSearch — oficiais)
- [JA Solar JAM72S30 525-550/MR (oficial)](https://www.jasolar.com/uploadfile/2021/0706/20210706053524693.pdf)
- [Canadian Solar HiKu6 CS6W-MS (oficial csisolar)](https://static.csisolar.com/wp-content/uploads/sites/3/2022/02/14153254/CS-Datasheet-HiKu6_CS6W-MS_v2.0_F50_J1_NA.pdf)
- [Jinko Tiger Pro JKM530-550M-72HL4-TV (oficial AU)](https://jinkosolar.com.au/wp-content/uploads/2023/09/JKM530-550M-72HL4-TV-F3C6-EN.pdf)
- [ENF Solar — diretório global de datasheets](https://www.enfsolar.com/pv/panel)


## Revisão Gemini (obrigatória)

> Via API Gemini (`gemini-2.5-flash-lite`), chave do operador, uso transitório (não persistida).

## Revisão da Sprint P1-MODULE-DATASHEET-FETCH-01

A sprint P1-MODULE-DATASHEET-FETCH-01 teve como objetivo inicial a construção de uma biblioteca documental de datasheets de módulos, focando em um piloto de 6 modelos Tier-1, sem alterar o Atlas ou o parser existente. O pipeline implementado incluiu DNS via DoH, download de PDFs, extração de texto e validação obrigatória de modelo e fabricante antes do salvamento.

**Avaliação:**

1.  **Validação obrigatória (modelo+fabricante):** Sim, este é o controle de qualidade correto para garantir que o documento baixado é de fato o datasheet do módulo pretendido. A exigência de ambos os campos no texto extraído minimiza o risco de salvar informações irrelevantes ou incorretas.

2.  **Rejeitar PDF-imagem/502:** Sim, foi a decisão correta. Manter PDFs de imagem sem tokens extraíveis ou lidar com erros de servidor (502) resultaria em "lixo" na biblioteca, comprometendo a utilidade futura. A priorização de dados parseáveis é fundamental.

3.  **Preferir fontes oficiais e marcar revendedor:** Adequado. A distinção entre fontes oficiais e revendedores é importante para a confiabilidade e para futuras ações de enriquecimento. Marcar o revendedor permite uma análise posterior da qualidade da fonte.

4.  **Honestidade na distinção 'obtido'/'enriquecível' e cobertura:** Sim, foi honesto e transparente. Distinguir o que foi obtido e validado (mesmo que imagem) do que é imediatamente enriquecível (texto parseável) é crucial. O alerta sobre a cobertura potencial e a necessidade de revalidação para variantes (como N-type) demonstra uma compreensão clara das limitações e próximos passos.

5.  **Segurança garantida:** Sim, a segurança parece garantida. A ausência de alterações no Atlas, nenhum enriquecimento executado, nenhum parser alterado e o salvamento local dos PDFs em uma pasta designada cumprem os requisitos de segurança estabelecidos.

6.  **Piloto válido e plano de continuação:** Sim, o piloto (4/6 obtidos e validados) é uma contribuição válida e demonstra a eficácia do pipeline. O plano de continuar a campanha para os demais módulos e tratar os casos pendentes (PDF-imagem, erros de servidor) é o próximo passo lógico e correto.

**Veredito:**

**APROVADO COM RESSALVAS**

**Ressalvas:**
*   Apesar de 4/6 terem sido obtidos, a qualidade da extração de texto varia significativamente (7/9, 1/9, 5/9, 8/9), indicando que a fase de enriquecimento precisará de atenção especial para lidar com diferentes níveis de parseabilidade.
*   A necessidade de "Vision" para o datasheet da JA Solar JAM72S30, embora identificada, representa um gargalo para o enriquecimento imediato deste modelo específico.

A sprint foi bem-sucedida em provar o pipeline de fetch e validação de forma segura e honesta. Os resultados do piloto fornecem uma base sólida para a continuação da construção da biblioteca documental.
