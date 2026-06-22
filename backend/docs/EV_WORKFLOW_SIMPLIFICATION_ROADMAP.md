# EV_WORKFLOW_SIMPLIFICATION_ROADMAP.md

**Sprint:** P0-EV-WORKFLOW-SIMPLIFICATION-01
**Data:** 2026-06-20

Sequência objetiva para deixar o EV pronto para operação comercial. Fluxo-alvo:
**Carregador → Distância → Dimensionamento → Materiais → Orçamento → Unifilar.**
Hoje a cadeia quebra no **Orçamento** (inexistente) e nos materiais (não editáveis).

---

## P0 — Bloqueadores de operação comercial

### P0.1 — Criar a etapa de ORÇAMENTO (EV-GAP-01) · CRÍTICO
- Inserir uma etapa **entre Materiais e Unifilar** no `NovaPropostaEV`.
- Compor: **equipamentos** (carregadores × preço) + **materiais** (BOM × preço unitário) + **serviços** (mão de obra/ART/deslocamento) + **margem (%)**.
- Persistir em `ProjetoEV.financeiro` (campo já existe; popular custo_equipamentos/instalação/total) + um breakdown de itens.
- Reusar o padrão do FV (E8): preço unitário editável, subtotais, total.

### P0.2 — Tornar a lista de materiais EDITÁVEL (EV-GAP-03) · ALTO
- Trocar o `<ul>` read-only por linhas editáveis: **alterar quantidade, adicionar, remover** item.
- O BOM (`gerarBOM`) vira o ponto de partida; o engenheiro fecha a lista real.
- Materiais editados alimentam o Orçamento (P0.1).

---

## P1 — Operacionais

### P1.1 — Cadastro manual de carregador (EV-GAP-02) · ALTO
- Adicionar um **modo manual** ao `ModalNovoCarregadorEV` (hoje é datasheet-only).
- Campos mínimos (EV-GAP-04): Fabricante, Modelo, Potência kW, **Tensão (enum 127/220/380)**, **Fases (mono/bi/tri)**, **Tipo de plug (enum Tipo1/Tipo2/CCS2/GB-T/NACS)**, **Qtd conectores**, **OCPP (sim/não)**.
- Schema `CarregadorEV`: adicionar `qtd_conectores`, `ocpp` (Boolean), enum de `tipo_conector`; `fases` incluir bifásico.

### P1.2 — "Dados Avançados" (EV-GAP-05) · MÉDIO
- Mover ~14 campos opcionais (eficiência, FP, IP, temperatura, peso, dimensões, frequência, protocolo, tempo de carga, comunicação, garantia, DC) para uma seção recolhida **"Dados Avançados"**.
- Remover do cadastro os 3 campos de proteção recomendada (calculados pelo motor).

---

## P2 — Refinamentos

### P2.1 — Proteções configuráveis (EV-GAP-06) · BAIXO
- Permitir DR 30/300 mA conforme caso (residencial vs força); `tipo_conector` por enum.

### P2.2 — Governança/Snapshot EV alinhados ao FV · BAIXO
- O `ProjetoEV` já tem `snapshot_carregador` + `governanca` + `homologacao` (Mixed). Consolidar o uso (congelar orçamento aprovado antes do unifilar).

---

## Sequência recomendada

```
Sprint N+1: P0-EV-ORCAMENTO-MATERIAIS-01  → P0.1 + P0.2  (desbloqueia uso comercial)
Sprint N+2: P1-EV-CADASTRO-MINIMO-01      → P1.1 + P1.2  (cadastro orientado a projeto)
Backlog:    P2.1, P2.2
```

**Critério de "pronto comercial":** o fluxo Carregador → Materiais → **Orçamento (com margem)** → Unifilar fecha de ponta a ponta, com materiais editáveis e cadastro manual disponível.
