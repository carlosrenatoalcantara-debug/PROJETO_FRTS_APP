# RUNTIME_FINAL_VALIDATION_EVIDENCES.md

**Sprint:** P1-RUNTIME-FINAL-VALIDATION-01
**Data:** 2026-06-20
**Modelo:** Claude Sonnet 4.6

---

## EVIDÊNCIAS COLETADAS

Nenhuma evidência de runtime foi coletada.
Todos os 10 testes estão com status NÃO_EXECUTADO.

---

## EVIDÊNCIAS DISPONÍVEIS (código/build — sprints anteriores)

As seguintes evidências foram validadas em código nos commits anteriores:

### Sprint P1-GOVERNANCA-REACT31-RCA-01 — commit 9b41554
- Build: ✓ 0 erros, 13.95s, 2332 módulos
- Correção: `diffRevisoes.js:36` — campo `bitola` → `secao`
- Safety net: `ComparadorRevisoes.jsx:64` — função `fmt()` defensiva
- Evidência de código: campo `cabos.dc.secao` existe em `engenhariaNormativa.js:335`

### Sprint P1-HUAWEI-50KTL-RCA-01 — commit 3e42c9a
- Build: ✓ 0 erros, 12.89s, 2332 módulos
- Correção: regex `\w*` → `[-A-Z0-9]*` em `fabricanteModeloFallback.js:94-98`
- Orphan adicionado: `/\b(SUN2000-\d{1,3}K?TL[-A-Z0-9]*)\b/i`
- Evidência de código: `/\b(SUN2000-\d{1,3}K?TL[-A-Z0-9]*)\b/i.test('SUN2000-50KTL-M0')` → true ✓

### Sprint P1-TENSAO-380V-PARSER-01 — commit e2a3afd
- Build: ✓ 0 erros, 7.91s, 2332 módulos
- Correção: 5 arquivos, 4 bugs encadeados
- Evidência de código: `tensaoNaLinha('Trifásico 380V')` → `'380'` ✓
- Evidência de código: `adaptarFatura({ tensao: '380' })` → `{ tensao_v: 380 }` ✓

---

## PROTOCOLO PARA COLETA DE EVIDÊNCIAS (a preencher)

Quando o usuário executar os testes, as evidências devem ser coletadas como:

### T01/T02 — Huawei
```
Screenshot: tela de resultado do Cadastro Assistido após upload
Campos a capturar: fabricante, modelo, potência, MPPT, Voc, Isc
```

### T03 — COSERN 380V
```
Screenshot 1: E2Consumo após upload da fatura — campos tipoLigacao e tensao
Screenshot 2: Projeto reaberto — mesmos campos após reload
Console Railway: log "✓ Extraído: { ... fase: 'Trifásico', tensao: '380' ... }"
```

### T04 — ComparadorRevisoes
```
Screenshot: aba Governança com ComparadorRevisoes renderizado sem erro
DevTools Console: sem mensagem "Objects are not valid as a React child"
```

### T05/T06 — Governança
```
Screenshot: seções Engenharia, Unifilar, Orçamento, Homologação
Screenshot: botão "Abrir Documentação Homologada" visível e funcional
```

### T07 — Unifilar
```
Screenshot: SVG gerado do unifilar
Screenshot: tabela de especificações (módulos, strings, MPPTs)
```

### T08 — Multiarranjo
```
Screenshot antes: 3 arranjos criados
Screenshot depois: 3 arranjos persistidos após reload
```

### T09 — Beneficiárias
```
Screenshot: formulário de beneficiárias com UC/Conta Contrato/Consumo preenchidos
```

### T10 — E2E
```
Screenshot final: projeto com status HOMOLOGADO após fluxo completo
```
