# E7_FINAL_UX_CONSOLIDATION_REPORT.md

**Sprint:** P0-E7-FINAL-UX-CONSOLIDATION-01
**Data:** 2026-06-20 · **Modelo:** Claude Opus 4.8 · **Decisão:** CAMINHO A (persistência intacta)

> GEMINI: revisão cruzada PENDENTE (sem ferramenta no ambiente).

## DECLARAÇÃO DE HONESTIDADE
```
VALIDADO EM CÓDIGO:  build de produção do frontend OK (vite, 2338 módulos, 0 erro).
                     RCA "não mapeados" confirmada na origem (catalogoEletrico.js:197-204).
VALIDADO EM RUNTIME: agregação fonte única (Caso Avelino) → 354 módulos / 2 inversores /
                     157,53 kWp; quantidade explícita (180) SOBREPÔS a estimativa E5 (999).
NÃO TESTADO:         render visual no navegador (não exercido o DOM); validado por build +
                     teste de agregação. Sem ambiente de preview interativo nesta sessão.
```

## ESCOPO (exclusivamente UX / Workflow / Integração — Caminho A)
Sem alterar: persistência de arranjos, persistência MPPT, engenharia elétrica, E8,
governança, homologação, snapshot, EV, BESS, OCR, datasheet. Nenhum componente removido.

## MUDANÇAS

### 1. Container único "Sistema FV" (multiarranjo é o container principal)
`E7Equipamentos.jsx`: Arranjo A + `GerenciadorArranjos` (B/C/D) passam a viver **dentro de um
mesmo bloco "Sistema FV"**. Antes eram duas seções soltas e desconexas.

### 2. Configuração elétrica logo após o inversor
Ordem do Arranjo A reordenada para o fluxo de engenharia real:
`Módulo → Quantidade → Inversor → **Configuração Elétrica** → Estrutura → Resumo Técnico`.
Antes: Config Elétrica ficava por último (após Estrutura e Resumo). É consequência direta do
inversor → agora aparece imediatamente após ele.

### 3. Quantidade de módulos = campo EXPLÍCITO do arranjo
Novo campo numérico "Quantidade de módulos" logo após o módulo, exibindo kWp CC calculado.
Reusa os MESMOS dispatches (`SET_DIMENSIONAMENTO` / `SET_EQUIPAMENTO` quantidadeModulos) já
usados pelo configurador e pela sugestão COSERN — **sem persistência nova**. O configurador
passa a receber `numPaineis={numPaineisReal}` (configurado), não mais `dim.numPaineis` (E5):
a quantidade deixa de ficar "presa" na estimativa.

### 4. RCA + correção "Dados elétricos não mapeados" (causa raiz, não cosmética)
`catalogoEletrico.js`: `dadosEletricosPainel/Inversor` faziam lookup só no mapa estático
`DADOS_ELETRICOS_*` (chaves hardcoded do catálogo local). Equipamento do catálogo Mongo tem
`id = ObjectId` → nunca casava → `null` → aviso "não mapeados" mesmo com cadastro completo.
**Fix:** fallback que lê as specs inline do equipamento (painel: voc/vmpp/isc/potenciaW;
inversor: tensaoMaxV/mpptMinV/mpptMaxV/correnteMaxA) quando o mapa estático não tem a chave.
O aviso só persiste se o equipamento realmente não tiver specs (honesto). Não toca persistência.

## RESPOSTAS OBRIGATÓRIAS (FASE 0)
1. **Legados vivos:** placement do `ConfiguradorArranjoFV` (Arranjo A) + `catalogoEletrico.js`
   (mapa estático) — únicos pontos legados. Nenhum componente morto.
2. **Removidos:** nenhum (Caminho A preserva tudo).
3. **Fonte única visual:** container "Sistema FV" com blocos A/B/C/D na mesma ordem.
4. **Aposentados:** zero componentes.
5. **Risco no E8:** nenhum — E8 já deriva de `agregarTotaisArranjos(state)`; mudança é visual.

## CASO AVELINO (runtime)
```
Arranjo A: 180 × 445W · 1 inversor (SUN2000-60KTL)
Arranjo B: 174 × 445W · 1 inversor (SUN2000-50KTL)
agregarTotaisArranjos → modulos=354 · inversores=2 · kwp=157.53  ✓ (E7 e E8, mesma fonte)
Prova "nasce do arranjo": dim.numPaineis=999 (E5) ignorado; quantidadeModulos=180 prevaleceu.
```

## CRITÉRIO DE ACEITAÇÃO
| Critério | Status |
|---|---|
| Um workflow visual de engenharia FV | ✅ container "Sistema FV" |
| Arranjo A e B/C/D mesma experiência visual | ✅ mesma sequência/blocos (ver ressalva) |
| Config elétrica junto do inversor | ✅ logo após o inversor |
| Multiarranjo é o container principal | ✅ "Sistema FV" envolve A + B/C/D |
| Quantidade nasce do arranjo | ✅ campo explícito sobrepõe E5 (runtime) |
| Causa raiz dos "não mapeados" identificada | ✅ RCA + fix root-cause |
| Caso Avelino continua correto | ✅ 354 / 2 / 157,53 |
| Sem alterar persistência / E8 / governança / homologação | ✅ |

## RESSALVA HONESTA
Os blocos **"Distribuidor / Orçamento Distribuidor"** por arranjo existem hoje em B/C/D
(`GerenciadorArranjos`) e no E8, mas **não** foram adicionados à seção do Arranjo A: fazê-lo
duplicaria a precificação que vive no E8 — e a sprint proíbe alterar E8 e criar funcionalidades.
A paridade visual A↔B/C/D é plena nos blocos de engenharia (Módulo/Quantidade/Inversor/Config/
Estrutura/Resumo); a precificação por arranjo permanece no E8 (design vigente). Recomendado
tratar a unificação de fornecedor/orçamento por arranjo numa sprint específica de E8, se desejado.

## VEREDITO
```
APROVADO (Caminho A) — workflow visual do E7 consolidado, config elétrica junto do inversor,
quantidade explícita, multiarranjo como container, RCA "não mapeados" corrigida na raiz,
Caso Avelino intacto (354/2/157,53). Persistência, E8, governança e homologação não tocadas.
```
