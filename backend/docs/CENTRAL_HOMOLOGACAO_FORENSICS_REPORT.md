# Central de Homologação — Relatório de Forense

**Sprint:** P2-CENTRAL-HOMOLOGACAO-FORENSICS-01 · **Modelo:** Sonnet
**Tipo:** FORENSE / READ ONLY — Nenhum código ou banco alterado
**Revisão Gemini:** OBRIGATÓRIA E PENDENTE

---

## Resumo Executivo

A suspeita estava correta: **~65% da futura Central de Homologação já está implementada**,
distribuída em múltiplos componentes criados ao longo de sprints anteriores.
O maior gap não é de funcionalidade técnica — é de **organização e usabilidade**:
os componentes existem, mas o operador precisa navegar entre abas díspares para completar
um único fluxo de homologação.

A Central de Homologação proposta é, em grande parte, uma **reorganização** do que existe,
com correções pontuais (BUG-ART-01, ENEL no provider, número de protocolo).

---

## FASE 1 — Inventário de Componentes

### Frontend

| Arquivo | Linhas | Responsabilidade |
|---|---|---|
| `pages/Homologacao.jsx` | 260 | Página standalone (entrada manual de dados, sem projeto FV vinculado) |
| `components/fv/homologacao/Homologacao.jsx` | 158 | **Hub integrado** (aba Homologação no ProjetosFVDetalhes) |
| `components/fv/homologacao/MemorialDescritivo.jsx` | 118 | POST /memorial → copiar/baixar TXT |
| `components/fv/homologacao/CartaConcessionaria.jsx` | 118 | POST /carta → copiar/baixar TXT |
| `components/fv/homologacao/DadosART.jsx` | 160 | GET /art → copiar (**BUG-ART-01**) |
| `components/fv/homologacao/ChecklistDocumentos.jsx` | 248 | GET+PATCH /checklist → toggle docs + status |
| `components/homologacao/` | ~379 | Versão anterior dos 4 componentes acima (menos completa) |
| `data/checklistsHomologacao.js` | 140 | Checklists estáticos por concessionária (7 grupos) |
| `data/templatesHomologacao.js` | 283 | Templates: gerarMemorialCalculo(), gerarCartaConcessionaria(), gerarDadosART() |
| `utils/gerarPdfHomologacao.js` | — | Utilidade de PDF (capacidade limitada) |

**Integração no hub:**
- `ProjetosFVDetalhes.jsx` — aba "Homologação" → `Homologacao.jsx` (fv/homologacao)
- `ProjetosFVDetalhes.jsx` — aba "Beneficiárias" → `BeneficiariasPainel.jsx` (separada)
- `ProjetosFVDetalhes.jsx` — aba "mapa" → coordenadas (separada)

### Backend — Rotas

| Método | Rota | Responsabilidade |
|---|---|---|
| POST | `/:id/homologacao/memorial` | Gerar memorial (snapshot-aware) |
| POST | `/:id/homologacao/carta` | Gerar carta à concessionária |
| GET | `/:id/homologacao/art` | **BUG-ART-01** → dados ART com body vazio |
| GET | `/:id/homologacao/checklist` | Checklist manual (schema legado) |
| PATCH | `/:id/homologacao/checklist` | Salvar checklist manual |
| PATCH | `/:id/homologacao/status` | Status legado (5 estados) |
| GET | `/:id/homologacao/status` | Status atual |
| POST | `/:id/homologacao/test-freeze` | Teste de freezimento |
| GET | `/:id/homologacao/assistida/checklist` | Checklist automático S9.0 |
| GET | `/:id/homologacao/assistida/validacao` | Validar docs/certificações |
| GET | `/:id/homologacao/assistida/pacote` | Pacote documental completo |
| PATCH | `/:id/homologacao/assistida/status` | Status S9.0 (7 estados) |
| GET | `/:id/homologacao/assistida/regras` | Regras por concessionária |

### Backend — Serviços e Utilitários

| Arquivo | Responsabilidade |
|---|---|
| `controllers/homologacaoController.js` | Controller: memorial/carta/art/checklist/status, snapshot-aware |
| `services/memorialDescritivoService.js` | Geração de texto: memorial (com beneficiárias, certificações, irradiância), carta, ART |
| `utils/homologacao/homologacaoAssistida.js` | STATUS_HOMOLOGACAO (7 estados), gerarChecklist(), validarDocumentos(), montarPacoteDocumental() |
| `utils/homologacao/concessionariaProvider.js` | Regras por grupo: NEOENERGIA, EQUATORIAL, ENERGISA, CPFL, CEMIG, COPEL + ENEL (ausente ← GAP-10) |
| `utils/beneficiarias/beneficiariaRateio.js` | Cálculo de rateio |
| `services/concessionariaDictionaryService.js` | Normalização de nomes de concessionárias |
| `data/concessionarias/` | Dados de concessionárias |
| `importadores/concessionariaProfiles.js` | Perfis para importação |

### Modelos / Schema

| Modelo | Campos relevantes para homologação |
|---|---|
| `ProjetoFV` | `homologacao.{status,data_envio,concessionaria,documento_*,checklist_documentos,status_homologacao,historico_status,iniciada_em,concluida_em}` |
| `ProjetoFV` | `governanca.{freeze_status,snapshot_catalogo,snapshot_unifilar,snapshot_memorial,snapshot_responsavel_tecnico}` |
| `ProjetoFV` | `localizacao.{endereco_completo,latitude,longitude,estado}` |
| `UnidadeBeneficiaria` | `{contaContrato,tipoRateio,valor,titular,cpf_cnpj,concessionaria,modalidade_gd,ativa,historico}` |
| `Equipamento` | `{fabricante,modelo,certificacao.inmetro,certificacao.normas_iec,datasheet_original,aprovacao_tecnica}` |

---

## FASE 2 — Dados Disponíveis

| Campo | Status | Observação |
|---|---|---|
| Cliente (nome) | **DISPONÍVEL** | ProjetoFV.clienteId.nome + UnidadeBeneficiaria.titular |
| UC / conta contrato | **DISPONÍVEL** | UnidadeBeneficiaria.contaContrato |
| CPF/CNPJ | **DISPONÍVEL** | UnidadeBeneficiaria.cpf_cnpj |
| Coordenadas | **DISPONÍVEL** | ProjetoFV.localizacao.latitude/longitude (geocodificadas) |
| Endereço | **DISPONÍVEL** | ProjetoFV.localizacao.endereco_completo |
| Estado | **DISPONÍVEL** | ProjetoFV.localizacao.estado |
| Módulos (fab/modelo/specs) | **DISPONÍVEL** | snapshot_catalogo ou Equipamento |
| Inversores (fab/modelo) | **DISPONÍVEL** | idem |
| Potência kWp | **DISPONÍVEL** | ProjetoFV.dimensionamento.potencia_kwp |
| Beneficiárias (completo) | **DISPONÍVEL** | UnidadeBeneficiaria.* |
| Rateio (%) / Prioridade | **DISPONÍVEL** | UnidadeBeneficiaria.tipoRateio + valor |
| Irradiância mensal | **DISPONÍVEL** | NASA API geocodificada |
| Consumo mensal kWh | **DISPONÍVEL** | Via parser de fatura |
| Potência inversores (kW) | **PARCIAL** | 83/175 com potencia_kw; 39 pendentes |
| Concessionária | **PARCIAL** | String manual; sem normalização obrigatória no cadastro |
| RT (nome, CREA) | **PARCIAL** | Via snapshot_responsavel_tecnico (quando congelado); EmpresaContext (vivo) |
| Certificações INMETRO | **PARCIAL** | Estrutura existe; preenchimento real desconhecido sem Atlas |
| Normas IEC | **PARCIAL** | Idem |
| Número de protocolo | **AUSENTE** | Campo não existe no schema |
| Data de envio (UI) | **PARCIAL** | Campo no schema; sem UI de input |
| Procuração | **AUSENTE** | Sem template ou campo |
| Nota fiscal | **AUSENTE** | Sem integração |

---

## FASE 3 — Documentos

| Documento | Status | Onde |
|---|---|---|
| **Memorial Descritivo** | **GERADO** | memorialDescritivoService.js; POST /memorial; snapshot-aware; inclui beneficiárias + certificações + irradiância |
| **Carta à Concessionária** | **GERADO** | idem; POST /carta; inclui RT + equipamentos + UC |
| **Dados para ART** | **PARCIAL** | Gerado no service, mas BUG-ART-01 impede uso via UI |
| **Checklist** | **GERADO** | homologacaoAssistida.js (automático por concessionária) + manual (legado) |
| Diagrama Unifilar | **PARCIAL** | snapshot_unifilar existe; UI do editor existe; PDF não integrado |
| PDF formatado | **PARCIAL** | gerarPdfHomologacao.js existe; download atual é .txt |
| Procuração | **AUSENTE** | Sem template |
| Laudo de Conformidade | **PARCIAL** | Flag no checklist; sem geração de conteúdo |
| Projeto de Execução | **PARCIAL** | Flag no checklist; sem geração de conteúdo |
| Nota Fiscal | **AUSENTE** | Sem integração |
| Relatório de Geração Estimada | **AUSENTE** | Dados existem; sem template |

---

## FASE 4 — Capacidade por Concessionária

### O que é atendido genericamente

- Documentos base (memorial, carta, ART) para **qualquer** concessionária
- Checklist base (`DOCS_BASE`) com 12 documentos padrão Lei 14.300/2022
- Cálculo de rateio independente de concessionária
- Coordinates disponíveis para todos os projetos

### Por concessionária

| Concessionária | Atendido | Requer customização |
|---|---|---|
| **Neoenergia** (COSERN/COELBA/CELPE/ELEKTRO) | Regras no provider, checklist, formulários ESS-PEH referenciados | IEC 62116 verificação automática; laudo conformidade (sem geração) |
| **Equatorial** | Regras no provider, checklist genérico | Formulário de acesso (só referenciado, não gerado) |
| **Enel** (SP/Rio/CE) | Checklists estáticos no frontend | **Ausente do concessionariaProvider.js (GAP-10)** |
| **Energisa** | Regras no provider | Sem customização específica |
| **CEMIG** | Regras no provider, checklist com GD-01 | Formulário GD-01 (só referenciado) |
| **CPFL** | Regras no provider (proj. execução + IEC 62116) | Projeto de execução sem geração |
| **COPEL** | Regras no provider, checklist com layout telhado | Layout de telhado (geoEngine existe, mas não integrado ao checklist) |

---

## FASE 5 — Campos para Copy/Paste na Central

Os seguintes campos são candidatos a cards copiáveis:

**Grupo: Cliente**
- Nome completo, CPF/CNPJ, Endereço, Cidade/UF/CEP

**Grupo: Sistema FV**
- Potência instalada (kWp), Qtd módulos × Wp, Modelo módulo (fab + modelo), Modelo inversor (fab + modelo + kW), Tipo de conexão (mono/bi/trifásico), Tensão (220/380V)

**Grupo: Localização**
- Endereço completo, Coordenadas (lat, lon), Link Google Maps

**Grupo: UC / GD**
- Número(s) de UC / Conta Contrato, Titular, Rateio (%)
- Concessionária, Estado

**Grupo: Responsável Técnico**
- Nome, CREA/CAU número e UF, Especialidade
- Link ao portal do CREA do estado

**Grupo: ART**
- Descrição de serviços (texto pronto para e-CAT)
- Valor da obra

**Funcionamento:** cada campo tem botão [📋] de cópia individual + "Copiar Tudo" no topo.
**Já implementado:** copiar memorial (texto), copiar carta (texto), copiar dados ART (todos os campos).
**Gap:** não existe card estruturado com campos individuais copiáveis (seria nova UI na aba Dados).

---

## FASE 6 — Checklist

**Dois sistemas coexistem:**

| Sistema | Onde | Cobertura |
|---|---|---|
| **Legado** (checklistsHomologacao.js) | Frontend, 7 concessionárias, estático | CEMIG, COPEL, CELPE, COELBA, ENEL SP/Rio/CE, CELESC, Genérico |
| **Assistido S9.0** (homologacaoAssistida.js) | Backend, dinâmico, auto-verifica | RT, datasheets, certificações, rateio, documentos |

**O que já existe:**
- Verificação automática de: RT atribuído, snapshot RT, equipamentos aprovados, datasheets presentes, certificações INMETRO/IEC, rateio 100%, documentos obrigatórios
- 7 estados de status com máquina de estados
- Status sugerido automático
- Persistência de itens marcados
- Campo de observações

**O que falta:**
- Campo de número de protocolo da concessionária
- Data de envio (input) e alerta de SLA
- Histórico por item (timestamp de quando foi marcado)
- Notificação/alerta de pendências urgentes

---

## FASE 7 — Matriz de Cobertura

| Área | Cobertura | Justificativa |
|---|---|---|
| Dados Técnicos | **75%** | potência kWp/inversores OK; MPPT/certificações parciais |
| Documentos | **50%** | Memorial+Carta gerados; ART bugada; Procuração/NF ausentes; PDF limitado |
| Beneficiárias | **100%** | CRUD, rateio percentual+prioridade, titular, CPF (tudo completo) |
| Rateio | **100%** | percentual + prioridade + validação automática de soma |
| Coordenadas | **75%** | lat/lon geocodificadas; sem copy/paste na Central |
| Equipamentos | **75%** | fab/modelo/qtd OK; certificações e specs parciais |
| Checklist | **75%** | Assistido automático funcional; sem protocolo/SLA/histórico por item |
| Histórico | **25%** | Backend completo; UI de timeline ausente |
| **TOTAL** | **~65%** | Média ponderada |

---

## FASE 8 — Arquitetura da Central (síntese)

Ver [CENTRAL_HOMOLOGACAO_ARCHITECTURE.md](CENTRAL_HOMOLOGACAO_ARCHITECTURE.md) para a especificação completa.

**Estrutura em 5 abas:**
1. **Status** — dashboard, protocolo, SLA, próximo passo
2. **Dados** — cards copiáveis por campo (cliente, sistema, localização, UC, RT)
3. **Documentos** — memorial, carta, ART (corrigida), unifilar, PDF
4. **Checklist** — assistido + manual por concessionária
5. **Histórico** — timeline de status

**Concessionárias previstas:** Neoenergia, Equatorial, Enel (a adicionar ao provider), Energisa, CEMIG, CPFL, COPEL.

**Sem automação externa:** somente apoio operacional (copy/paste, geração de texto, links ao portal).

---

## Respostas Diretas

**1. O que já existe:**
- Memorial Descritivo (texto completo, snapshot-aware) ✓
- Carta à Concessionária ✓
- Dados para ART (bugados, mas o serviço funciona)
- Checklist assistido automático por concessionária ✓
- Beneficiárias com rateio completo (100% funcional) ✓
- Status S9.0 com 7 estados e histórico ✓
- Regras de 6 grupos de concessionárias (sem ENEL) ✓
- Coordenadas geocodificadas ✓
- Snapshot imutável quando congelado ✓

**2. O que falta:**
- BUG-ART-01 (correção do transporte GET→POST)
- Card de dados copiáveis por campo (nova UI)
- Número de protocolo da concessionária (schema + UI)
- ENEL no concessionariaProvider.js
- Timeline histórico na UI
- Beneficiárias integradas na aba Homologação (atualmente aba separada)
- PDF real (ao invés de .txt)
- Procuração (template)

**3. Cobertura percentual atual:** **~65%**

**4. Principais gaps:**
- BUG-ART-01 (P1 — bloqueia ART)
- Status sobrepostos legado/S9.0 (confusão operacional)
- Beneficiárias fora da aba Homologação
- Campos não acessíveis para copy/paste (coordenadas, concessionária, RT)
- Número de protocolo sem campo

**5. Esforço para conclusão:**

| Sprint | Conteúdo | Esforço |
|---|---|---|
| P1-BUG-ART-01 | Corrigir transporte GET→POST | XS (< 2h) |
| P1-CENTRAL-HOMOLOGACAO-MVP | Aba Dados (cards copiáveis), integrar beneficiárias, protocolo, ENEL provider, timeline | S–M (1–2 sprints) |
| P2-CENTRAL-PDF | PDF real, unifilar integrado | M (1 sprint) |

**6. Necessidade de nova arquitetura:**
**NÃO.** A base existe. A Central é reorganização e extensão do que já está implementado.
O componente `fv/homologacao/Homologacao.jsx` (aba hub) é o ponto de entrada natural —
expandir suas abas com os novos cards é suficiente. Nenhuma quebra de API ou schema necessária.

**7. Próxima sprint recomendada:**

```
P1-BUG-ART-01 (XS, imediato)
    ↓
P1-CENTRAL-HOMOLOGACAO-MVP (S, reorganização + novos cards)
```

---

## Honestidade

- Nenhum código alterado nesta sprint.
- Nenhum dado de Atlas acessado (percentuais de certificações são estimativas estruturais).
- Contagens de equipamentos com/sem specs são baseadas em leitura de código + P1-UNKNOWN-POWER-APPLY-01 confirmado.
- Revisão Gemini obrigatória e pendente.
