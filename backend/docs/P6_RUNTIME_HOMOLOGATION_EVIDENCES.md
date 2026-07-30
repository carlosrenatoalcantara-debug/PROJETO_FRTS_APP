# P6_RUNTIME_HOMOLOGATION_EVIDENCES.md

**Sprint:** P6-RUNTIME-HOMOLOGATION-01
**Data:** 2026-06-19

Registro das evidências obtidas em execução real. Todas as afirmações abaixo
derivam de execução real no ambiente Railway + Vercel + Atlas.

---

## EVIDÊNCIA 1 — Railway Health Check

**URL:** https://projetofrtsapp-production.up.railway.app/api/health
**Resultado:**
```json
{"status":"ok","servico":"Forte Solar API","mongodb":"conectado","mongodbState":1}
```
**Confirmado:** Railway ONLINE, Atlas CONECTADO.

---

## EVIDÊNCIA 2 — Versão em produção (PRÉ-FIX)

O commit `e9c1ff7` está no branch `sprint/p1-bug-art-01` (pushed ao GitHub).
O branch `main` está no commit `127f7f5` (PRÉ-FIX).
Vercel e Railway fazem deploy automático somente do branch `main`.

---

## EVIDÊNCIA 3 — Wizard novo com clienteId pré-preenchido

**URL acessada:** `https://projeto-frts-app.vercel.app/projetos-fv/novo?clienteId=6a3588caf3fada9effa61ce6`

**Dados do cliente recuperados da API:**
- Nome: COMERCIAL OLIVEIRA E AVELINO LTDA
- Consumo: 17045 kWh/mês
- Distribuidora: COSERN
- Classificação: B3
- Subgrupo: Comercial
- Tipo ligação: Trifásico 380V
- Valor kWh: 1.03198
- Cidade: NATAL, RN

**Comportamento observado em PRÉ-FIX:**
- E1 (Fatura) exibida com campo de upload ← BUG-P0-02 PRESENTE
- Consumo mensal: vazio ← BUG-P0-03 PRESENTE
- Tipo ligação: Monofásico ← BUG-P0-04 PRESENTE
- Beneficiárias: "Nenhuma beneficiária adicionada" ← BUG-P1-05 PRESENTE

---

## EVIDÊNCIA 4 — Irradiância Natal

**Geocodagem executada:** "RUA LAUDELINO BENIGNO 32"
**Resultado geocodagem:** "Natal - Rio Grande do Norte", Lat: -5.749150, Lon: -35.248693

**NASA POWER consultada (execução real):**
- Irradiância Média Anual: **5.77 kWh/m²/dia**
- Fonte: ALLSKY_SFC_SW_DWN

**INPE/CRESESB (PRÉ-FIX):**
- Info text: "INPE/CRESESB — média territorial do estado (5.9 kWh/m²/dia)"
- cidadeEstado = "Natal - Rio Grande do Norte"
- .split(',')[0] retorna string inteira → obterIrradianciaCity("Natal - Rio Grande do Norte", "RN")
- Valor exibido: **5.9** (estado RN) ← BUG-P1-01 INDÍCIO
- Esperado após fix (.split(/[,\-]/)[0]): **5.42** (cidade Natal)

---

## EVIDÊNCIA 5 — Inversores ~25 un.

**Etapa:** "Projeto · Equipamentos" (E7)
**Texto observado:** "Inversores ~25 un. (estimativa E5)"
**Cálculo PRÉ-FIX:** `capInv = state.equipamentos?.inversor?.potenciaKW || 5`
- potenciaKWp = 123.09 kWp
- numInversores = Math.ceil(123.09 / 5) = **25** ← BUG-P0-06 PRESENTE
**Cálculo pós-fix:** `|| 20` → Math.ceil(123.09 / 20) = **7**

---

## EVIDÊNCIA 6 — Preços R$0/un no catálogo

**Observado em E7 (Seleção de Equipamentos):**
- A maioria dos painéis mostra "≈ R$ 0/un"
- Canadian Solar CS3K-400MS: ≈ R$ 1.150/un (tem precoUnitario)
- Neosolar NS400W: ≈ R$ 1.200/un (tem precoUnitario)
- Neosolar NS550W: ≈ R$ 1.600/un (tem precoUnitario)

**Interpretação:** Fix BUG-P0-07 usa `painel?.precoUnitario || 0`.
Painéis sem precoUnitario mostram R$0. Comportamento correto.
(PRÉ-FIX tinha hardcoded R$620/painel, R$4.000/inversor, R$130/estrutura)

---

## EVIDÊNCIA 7 — Diagrama Unifilar (Mercado Avelino)

**Projeto:** Mercado Avelino (6a35954ff3fada9effa61d09)
**Status homologação:** HOMOLOGADO (badge verde visível)
**Aba Unifilar:** Carregou com sucesso

**Dados do diagrama renderizado:**
- Título: "DIAGRAMA UNIFI[LAR] — Mercado Avelino"
- Módulo: Talesun TP6L72M(H)-445W, Pmpp: 550W, Voc: 49.4V, Vmpp: 40.7V, Isc: 11.47A
- Inversor: Huawei SUN2000-60KTL-M0, 60kW, 1 MPPT, Saída: 1Ø 220V, Iac: 287.1A
- Temp. projeto: Tmin=14°C / Tmax=38°C (RN)
- "A partir do snapshot congelado ✓"
- Botões: ⬇ SVG, ⬇ PNG disponíveis
- MPPT 1: 225 módulos, Voc_max: 11469.6V, Vmpp_min: 8015.6V

**Nota:** Diagrama usa dados do projeto (snapshot), não lista de ativos.
BUG-P4-UNIFILAR-01 afeta `setAtivos()` — seção de ativos não verificada.

---

## EVIDÊNCIA 8 — Aba Governança (crash)

**Projeto:** Mercado Avelino (6a35954ff3fada9effa61d09)
**Status:** Badge HOMOLOGADO visível — projeto correto para testar BUG-P2-03

**Erro ao clicar aba Governança:**
```
Minified React error #31
Objects are not valid as a React child
Found: object with keys {imax, secao, disj}
```

**Natureza do erro:** Bug pré-existente em componente de proteção elétrica
(imax = corrente máxima, secao = seção do cabo, disj = disjuntor).
Não é introduzido pelo commit e9c1ff7.

**Impacto:** Testes T15 (BUG-P2-01/02) e T16 (BUG-P2-03) INCONCLUSIVOS.
O botão "Abrir Documentação Homologada" não pode ser verificado em runtime.

---

## EVIDÊNCIA 9 — Lista de projetos (API)

**Endpoint:** `https://projetofrtsapp-production.up.railway.app/api/projetos-fv?limit=5`

**Projetos encontrados (primeiros 2):**
```
6a35d5cdf3fada9effa61fa4  Sistema FV 131.29 kWp  proposta
6a35954ff3fada9effa61d09  Mercado Avelino         proposta
```

**Nota:** Status "proposta" é o workflow_status. O badge "HOMOLOGADO" vem de
`status_homologacao` (campo separado). O GovernancaPainel.jsx usa este campo.

---

## NOTA SOBRE TESTES NÃO EXECUTADOS

Os testes T6-T9 (import de datasheets via OCR) não foram executados porque
requerem upload de arquivos PDF que não estavam disponíveis no ambiente de teste.
Estes testes validariam BUG-P1-02/03/04 (AssistenteDatasheet.jsx + datasheetController.js).

O teste T10 (letras dos arranjos) não foi executado porque a página E7 tem
uma lista de ~150 painéis que impede scroll até o botão "Adicionar Novo Arranjo"
dentro do fluxo de teste automatizado.
