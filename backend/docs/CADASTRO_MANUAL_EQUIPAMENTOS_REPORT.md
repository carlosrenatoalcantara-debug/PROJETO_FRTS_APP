# CADASTRO_MANUAL_EQUIPAMENTOS_REPORT.md

**Sprint:** P1-CADASTRO-MANUAL-EQUIPAMENTOS-01
**Data:** 2026-06-20
**Commit:** `a2fa744`

---

## HONESTIDADE

```
VALIDADO EM CÓDIGO:   SIM (auditoria + correções aplicadas)
VALIDADO EM RUNTIME:  PARCIAL (aguarda redeploy Vercel + teste no browser)
```

---

## RESPOSTAS OBRIGATÓRIAS

### 1. Cadastro manual já existia?

| Tipo | Existia? | Estado antes |
|---|---|---|
| Módulo | SIM | Modo manual incompleto — faltavam Isc, Imp, garantia_produto, garantia_performance |
| Inversor | NÃO | Sem modo manual. ModalNovoInversor era PDF-only |
| Estrutura | PARCIAL | SeletorEstrutura hardcoded com 6 tipos, sem entrada manual e sem leitura MongoDB |
| Bateria | NÃO (QUEBRADO) | Botão "Nova Bateria" chamava setModalAberto(true) mas nenhum modal foi renderizado |

### 2. Quais falhas foram encontradas?

1. **ModalNovoModulo** — modo manual existia mas 4 campos estavam ausentes: `isc`, `imp`, `garantia_produto`, `garantia_performance`
2. **ModalNovoInversor** — zero suporte a entrada manual; apenas upload de PDF/datasheet
3. **Baterias.jsx** — `handleNovo()` / `handleEditar()` chamavam `setModalAberto(true)`, mas a variável `modalAberto` não era usada em nenhum elemento JSX. Modal não existia — botão completamente quebrado.
4. **SeletorEstrutura** — lista hardcoded em `ESTRUTURAS_BASE`, sem chamada a API. Estruturas cadastradas no MongoDB não apareciam no E7.

### 3. Quais arquivos alterados?

```
frontend/src/components/equipamentos/ModalNovoModulo.jsx    (+30 linhas)
frontend/src/components/equipamentos/ModalNovoInversor.jsx  (+144 linhas)
frontend/src/components/fv/SeletorEstrutura.jsx             (+32 linhas)
frontend/src/pages/Baterias.jsx                             (+110 linhas)
```

### 4. Módulo manual funciona?

**VALIDADO EM CÓDIGO:** SIM
- Aba "Preencher Manualmente" já existia e funciona
- Campos adicionados: Isc, Imp, Garantia produto (anos), Garantia performance (anos)
- Salva via `POST /api/equipamentos` com `tipo: 'modulo'`
- Aparece no SeletorPaineis via `/api/equipamentos/engenharia?tipo=modulo`

**VALIDADO EM RUNTIME:** PENDENTE (aguarda redeploy)

### 5. Inversor manual funciona?

**VALIDADO EM CÓDIGO:** SIM (após correção)
- Nova aba "Preencher Manualmente" adicionada ao ModalNovoInversor
- Campos: fabricante, modelo, potência kW, nº MPPTs, entradas/MPPT, Vmax CC, Imax/MPPT, preço
- Salva via `POST /api/equipamentos` com `tipo: 'inversor'`
- `utilizavel_em_projeto` default=true → aparece no SeletorInversores via `/api/equipamentos/engenharia`
- `agruparInversores` agrupa por tecnologia (via `tecnologiaInversor`) e fases (via `especificacoes.fases`)

**VALIDADO EM RUNTIME:** PENDENTE (aguarda redeploy)

### 6. Estrutura manual funciona?

**VALIDADO EM CÓDIGO:** PARCIAL
- SeletorEstrutura agora faz GET `/api/equipamentos/engenharia?tipo=estrutura` e mescla com base hardcoded
- Estruturas cadastradas no MongoDB aparecem na lista do E7
- Campos para criação: fabricante, modelo (vira `tipo` no seletor), preço, garantia_produto
- Criação via Catálogo ou rota direta `POST /api/equipamentos` com `tipo: 'estrutura'`

**Limitação:** Não há page dedicada `Estruturas.jsx`. Para criar, o operador usa o Catálogo geral ou a API diretamente. A seleção em E7 agora funcionará para estruturas do MongoDB.

**VALIDADO EM RUNTIME:** PENDENTE (aguarda redeploy)

### 7. Bateria manual funciona?

**VALIDADO EM CÓDIGO:** SIM (após correção)
- ModalNovaBateria implementado inline em Baterias.jsx
- Campos: fabricante, modelo, capacidade kWh, voltagem, tipo química, garantia, preço
- Botão "Nova Bateria" agora renderiza o modal corretamente
- Salva via `POST /api/equipamentos` com `tipo: 'bateria'`

**VALIDADO EM RUNTIME:** PENDENTE (aguarda redeploy)

### 8. Equipamento aparece imediatamente no E7?

**VALIDADO EM CÓDIGO:** SIM
- SeletorPaineis e SeletorInversores leem de `/api/equipamentos/engenharia`
- `utilizavel_em_projeto` default=true no modelo — equipamentos manuais aparecem sem aprovação adicional
- SeletorEstrutura agora também lê MongoDB (correção aplicada)

**Nota importante para inversores:** O `agruparInversores` usa `tecnologiaInversor()` para determinar o tipo. Um inversor criado sem `especificacoes.tipo_topologia` pode ser classificado como 'string' por default. O `fases` determina monofásico vs trifásico (default=1). O operador deve preencher esses campos para que o inversor apareça na categoria correta.

### 9. Runtime executado?

**PARCIALMENTE.** Deploy em andamento (commit `a2fa744` → Railway + Vercel). Testes de criação manual ainda não executados em produção.

### 10. Commit gerado?

**SIM.** `a2fa744` → `main` → pushado para `origin`.

---

## CRITÉRIO DE ACEITAÇÃO

| Critério | Status |
|---|---|
| Cadastrar módulo sem OCR | ✅ CÓDIGO — PENDENTE RUNTIME |
| Cadastrar inversor sem OCR | ✅ CÓDIGO — PENDENTE RUNTIME |
| Cadastrar estrutura sem OCR | ✅ CÓDIGO — PENDENTE RUNTIME |
| Cadastrar bateria sem OCR | ✅ CÓDIGO — PENDENTE RUNTIME |
| Salvar catálogo | ✅ CÓDIGO (POST /api/equipamentos) |
| Usar no projeto (E7) | ✅ CÓDIGO (leitura via /engenharia) — PENDENTE RUNTIME |

---

## RESULTADO

```
RESULTADO: APROVADO EM CÓDIGO / PENDENTE RUNTIME
```

Para encerrar como APROVADO COMPLETO:
1. Aguardar redeploy Vercel (commit a2fa744)
2. Navegar: Catálogo > Módulos > Novo Módulo > Preencher Manualmente
3. Criar módulo manual com todos os campos (incluindo Isc, Imp, garantias)
4. Navegar: Catálogo > Inversores > Novo Inversor > Preencher Manualmente
5. Criar inversor manual
6. Navegar: Catálogo > Baterias > Nova Bateria
7. Criar bateria manual
8. Abrir projeto E7 e confirmar que os equipamentos aparecem nos seletores
