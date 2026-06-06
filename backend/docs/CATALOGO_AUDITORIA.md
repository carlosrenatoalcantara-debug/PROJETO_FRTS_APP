# CATÁLOGO — Relatório de Auditoria (P1-CATALOG-AUDIT-01)

> Gerado em 2026-06-06T17:08:29.049Z · **100% read-only** (zero escrita no banco).

## 1. Inventário

- Equipamentos (total): **9** — inversores 4, módulos 3, carregadores EV 2
- Fabricantes de inversores distintos: **3**
- Completude global média (inversores): **37.5%**

## 2. Estado real do schema

- `Equipamento.especificacoes` é `Mixed` (livre) — campos técnicos não são tipados no schema.
- `tipo_topologia` e `entradas_por_mppt` **não existem no schema**; são DERIVADOS em leitura pelo SSOT `lerInversor` (mapeia dialetos legados como `vpv_max→tensao_max_entrada`).

## 3. Estado real do banco

- Fonte auditada: **memory-storage.json** — _USE_MEMORY_STORAGE=true → memory-storage (fonte de runtime atual)_
- Verificação obrigatória (persistência) sobre 4 inversores:
  - `tipo_topologia` persistido: **0**
  - `entradas_por_mppt` persistido: **0**
  - `strings_por_mppt` persistido: **0**
  - Mistura de formatos: **NÃO**
  - Conclusão: Nenhum dos três é persistido — tipo_topologia e entradas_por_mppt são DERIVADOS em leitura (SSOT lerInversor). Sem mistura, nada a migrar.

## 4. Completude por fabricante

| Fabricante | Modelos | Completude média | Outliers | Imp. comercial | Prioridade |
|---|---|---|---|---|---|
| Solis | 1 | 37.5% | 1 | 5/5 | P0 |
| Deye | 1 | 37.5% | 1 | 5/5 | P0 |
| Growatt | 2 | 37.5% | 2 | 4/5 | P0 |

_Pesos do score:_ CRÍTICO×3 (potência, MPPT, strings/entradas, corrente MPPT) · ALTO×2 (Isc, tensão máx CC, faixa MPPT, tensão de partida) · OPERACIONAL×1 (eficiência, peso, dimensões, IP).

## 5. Ranking de prioridades

- **P0**: Solis, Deye, Growatt
- **P1**: —
- **P2**: —
- **P3**: —

_Critério: importância comercial (prior de mercado BR) + nº de modelos + lacuna de completude + outliers. Baseado nos dados reais encontrados._

## 6. Outliers

| Fabricante | Modelo | Regra | Campo | Justificativa |
|---|---|---|---|---|
| Growatt | MIC 5000TL-X | R5 | n_mppts+strings_entradas | Campo(s) CRÍTICO(s) nulo(s): n_mppts, strings_entradas |
| Growatt | MIC 10000TL-X | R5 | n_mppts+strings_entradas | Campo(s) CRÍTICO(s) nulo(s): n_mppts, strings_entradas |
| Solis | RHI-5K-48ES-5G | R5 | n_mppts+strings_entradas | Campo(s) CRÍTICO(s) nulo(s): n_mppts, strings_entradas |
| Deye | SUN-8K-G04 | R5 | n_mppts+strings_entradas | Campo(s) CRÍTICO(s) nulo(s): n_mppts, strings_entradas |

## 7. Riscos

- **Fonte de dados de produção (Atlas) inacessível** no ambiente atual (`querySrv ECONNREFUSED`) e `USE_MEMORY_STORAGE=true`: a auditoria reflete o store local de runtime, não o catálogo completo de produção. Reexecutar com Atlas acessível para números de produção.
- **Dados legados esparsos**: inversores seed só têm `potencia_kw, vpv_max, ipv_max, eficiencia` — campos CRÍTICOS (MPPT, strings/entradas) e ALTOS (Isc, faixa MPPT, tensão de partida) ausentes → baixa completude.
- **Campos derivados não persistidos**: topologia/entradas dependem do SSOT em leitura; consumidores que leem `especificacoes` cru (sem `lerInversor`) não enxergam esses campos.

## 8. Próximas ações (sugestões — NÃO executadas nesta sprint)

1. Reexecutar a auditoria com MongoDB Atlas acessível (números de produção).
2. Reprocessar via datasheet os fabricantes P0/P1 com baixa completude (preencher CRÍTICOS/ALTOS) — fora do escopo read-only.
3. Avaliar persistência opcional de `n_mppts`/`entradas_por_mppt` para consumidores que não passam pelo SSOT (decisão de schema — fora do escopo).
4. Tratar outliers detectados caso a caso na origem (datasheet), sem auto-correção.


## 9. Revisão Gemini (obrigatória)

> Revisão automatizada via API do Gemini (modelo `gemini-2.5-flash-lite`), executada ao final da sprint sobre `auditCatalog.js`, seu teste e o relatório gerado. Chave fornecida pelo operador e usada de forma transitória (não persistida no repositório).

## Revisão da Sprint AUDITORIA (P1-CATALOG-AUDIT-01)

**1) Conformidade READ-ONLY:** **APROVADO**. O código demonstra explicitamente a intenção de ser 100% read-only. A lógica de fallback para `memory-storage.json` é síncrona no carregamento inicial e a tentativa de conexão ao MongoDB é feita de forma assíncrona com timeouts curtos, garantindo que não haja bloqueios ou escritas. A meta-informação `escreveu_no_banco: false` confirma essa conformidade. A escrita em arquivos de documentação (`.json`, `.csv`, `.md`) é esperada e realizada corretamente.

**2) Corretude do score de completude e regras de outliers:** **APROVADO**.
*   **Score de Completude:** Os pesos (CRÍTICO×3, ALTO×2, OPERACIONAL×1) são aplicados corretamente na função `scoreDe`. A lógica para calcular o score percentual e identificar campos faltantes parece robusta. O teste `registro completo → score 100%` e `vazio → score 0%` validam a base.
*   **Regras de Outliers:** As regras (R1-R5) implementadas em `outliersDe` cobrem os cenários descritos. A heurística para a razão kW/A (R4) é razoável para detecção de incompatibilidade. A regra R5 para campos CRÍTICOS nulos é um bom complemento. Os testes unitários validam a detecção e a presença de justificativas.

**3) Robustez da adaptação ao formato real:** **APROVADO COM RESSALVAS**.
*   **Derivados vs. Persistidos:** A auditoria corretamente identifica que `tipo_topologia` e `entradas_por_mppt` são derivados em tempo de leitura pelo `lerInversor` e não persistem no schema. A função `verificarTopologia` é crucial para essa análise e detecta a ausência de persistência desses campos.
*   **Mistura:** A detecção de "mistura de formatos" (campos derivados e persistidos coexistindo) é importante. O relatório indica que não há mistura neste caso específico, o que simplifica a análise. O código está preparado para registrar essa mistura caso ocorra.

**4) Riscos, bugs ou edge cases:**
*   **Risco de Fonte de Dados:** O principal risco é a indisponibilidade do MongoDB Atlas, forçando o uso do `memory-storage.json`. Isso limita a auditoria aos dados presentes no runtime, não ao catálogo completo de produção. O relatório destaca isso claramente.
*   **Dados Legados Esparsos:** A auditoria identifica corretamente a baixa completude devido a dados legados incompletos, o que impacta diretamente o score.
*   **Campos Derivados:** O risco de consumidores que não utilizam o `lerInversor` não enxergarem os campos derivados é bem apontado.
*   **Edge Case de `strings_por_mppt` vs `entradas_por_mppt`:** A função `temEntradas` trata corretamente a presença de `entradas_por_mppt` (mesmo que vazio) ou `strings_por_mppt` como satisfatório para o campo crítico `strings_entradas`.

**5) Veredito Final:** **APROVADO COM RESSALVAS**.

**Justificativa:** A sprint cumpre rigorosamente o requisito READ-ONLY e implementa de forma correta o cálculo de score e a detecção de outliers. A análise da adaptação ao formato real, especialmente a distinção entre campos derivados e persistidos, é um ponto forte. As ressalvas se devem principalmente ao risco inerente à dependência de uma fonte de dados de produção (MongoDB Atlas) que pode estar indisponível, limitando a auditoria aos dados locais de runtime. A baixa completude geral, embora detectada corretamente, aponta para a necessidade de ações futuras (fora do escopo desta sprint) para enriquecer o catálogo.

**Observações Adicionais:**
*   A estrutura do código é clara, com fases bem definidas (score, outliers, ranking).
*   Os testes unitários (`auditCatalog.test.js`) são abrangentes e cobrem os principais aspectos do score, outliers e a conformidade read-only.
*   A geração de relatórios em múltiplos formatos (`.json`, `.csv`, `.md`) é excelente para a usabilidade.
*   A função `verificarTopologia` é um excelente complemento para entender o estado real do schema em relação aos campos derivados.
