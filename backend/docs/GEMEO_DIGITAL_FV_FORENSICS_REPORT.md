# GEMEO_DIGITAL_FV_FORENSICS_REPORT.md

**Sprint:** P3-GEMEO-DIGITAL-FV-FORENSICS-01
**Modelo:** Sonnet (Opus 4.8 requisitado)
**Tipo:** Forense · Read-Only
**Data:** 2026-06-19
**Revisão Gemini:** Obrigatória (pendente)

---

## FASE 1 — INVENTÁRIO

### Backend — Entidades Core

| Arquivo | Responsabilidade | Dependências principais |
|---|---|---|
| `backend/src/models/AtivoEquipamento.js` | Gêmeo Digital: entidade as-built, QR, ciclo de vida, histórico, monitoramento | Contador, ProjetoFV, Equipamento |
| `backend/src/models/ProjetoFV.js` | Projeto FV: localização, dimensionamento, engenharia, governança, snapshots, homologação | Cliente, Empresa, Equipamento, Tecnico, Vendedor |
| `backend/src/services/ativoService.js` | Geração idempotente de ativos a partir de ProjetoFV | AtivoEquipamento, Contador, arranjosService |
| `backend/src/controllers/ativosController.js` | CRUD do Gêmeo Digital, QR, comissionamento, scan, monitoramento | ativoService, ativoSeguranca, etiquetaParser |
| `backend/src/routes/ativos.js` | Rotas: /qr/:qr, /comissionar, /scan, /monitoramento, /projeto/:id, /gerar | ativosController |
| `backend/src/services/ativoSeguranca.js` | AES-256-GCM para credenciais de monitoramento | encryption |
| `backend/src/services/arranjosService.js` | Normaliza arranjos legado/v3 (normalizarArranjos) | ProjetoFV |
| `backend/src/utils/statusLifecycle.js` | Máquina de estados do ProjetoFV | — (puro) |
| `backend/src/utils/freeze.js` | Utilitários de congelamento/descongelamento | — |
| `backend/src/utils/snapshotRT.js` | Snapshot responsável técnico | — |
| `backend/src/utils/homologacao/homologacaoAssistida.js` | Regras assistidas de homologação | concessionariaProvider |
| `backend/src/models/Equipamento.js` | Catálogo (especificações, qualidade, garantias) | — |
| `backend/src/models/Contador.js` | Gerador atômico de sequência QR | — |

### Frontend — Componentes Core

| Arquivo | Responsabilidade |
|---|---|
| `frontend/src/pages/AtivoQR.jsx` | Página pública por QR: consulta + comissionamento mobile + monitoramento |
| `frontend/src/pages/EtiquetaScanner.jsx` | Scanner QR (BarcodeDetector/jsQR) + OCR (Tesseract) |
| `frontend/src/components/fv/UnifilarFV.jsx` | Diagrama unifilar interativo (gera/exibe SVG) |
| `frontend/src/utils/engenhariaGovernanca.js` | Engine de snapshots: 8 tipos congelados + obterEquipamentosEngenharia |
| `frontend/src/components/fv/homologacao/Homologacao.jsx` | Central de Homologação (6 sub-abas) |
| `frontend/src/components/fv/homologacao/CentralHistorico.jsx` | Timeline histórico de governança + protocolo |
| `frontend/src/utils/gerarUnifilarSVG.js` | Gerador SVG do unifilar (client-side) |

---

## FASE 2 — MAPA DE IDENTIDADE CANÔNICA

### Identidade do equipamento instalado

| Identificador | Origem | Persistência | Uso | Classificação |
|---|---|---|---|---|
| `qr_code` | Gerado na criação do ativo (`FORTE-<TIPO3>-<SEQ6>`) | Atlas — índice único, imutável | Campo, scanner, URL `/ativo/qr/:qr` | **CANÔNICO** (identidade física) |
| `_id` (ObjectId) | MongoDB (auto) | Atlas | Referências internas entre coleções | **CANÔNICO** (identidade de banco) |
| `chave_origem` | `${projetoId}:${arrId}:${tipo}:${modelo}[:idx]` | Atlas — índice único parcial | Idempotência de geração | **CANÔNICO** (identidade de geração) |
| `numero_serie` | Etiqueta física, preenchido no comissionamento | AtivoEquipamento.numero_serie | Rastreabilidade, garantia | **Secundário** (as-built, pode ser null) |
| `equipamento_id` | Link ao Equipamento do catálogo | AtivoEquipamento.equipamento_id | Consulta de especificações, qualidade | **Secundário** (pode ser null — BUG-EQ-ID-01) |
| `arranjo_id` | String copiada de ProjetoFV.arranjos[].id | AtivoEquipamento.arranjo_id | Agrupamento por arranjo | **Secundário** (contexto, não identidade) |
| `projeto_id` | ObjectId do ProjetoFV | AtivoEquipamento.projeto_id | Pertencimento ao projeto | **Secundário** (contexto) |

**Conclusão:** `qr_code` é o identificador canônico para o campo (físico, na etiqueta). `_id` é canônico para o banco. O `numero_serie` é o identificador do fabricante — coletado pós-instalação. A plataforma já tem 3 identidades complementares bem definidas.

---

## FASE 3 — COBERTURA DO CICLO DE VIDA

| Fase | Cobertura | Evidência | Lacunas |
|---|---|---|---|
| **Projeto** | 100% | ProjetoFV completo: localização (coords+UF), dimensionamento, consumo, concessionária, arranjos multi-inversor | — |
| **Aquisição** | 25% | Orçamento/fornecedor/kit preenchidos; ProjetoFV.governanca.snapshot_financeiro | Sem NF de compra, sem pedido de compra, sem rastreio de entrega |
| **Instalação** | 60% | AtivoEquipamento.data_instalacao + status=instalado; geração idempotente | Sem foto de instalação, sem check-in geolocalizado, sem guia de serviço |
| **Comissionamento** | 75% | endpoint POST /qr/:qr/comissionar completo; histórico com diff por campo; scanner QR/OCR mobile | Sem assinatura de comissionador, sem teste elétrico registrado |
| **Homologação** | 75% | Central de Homologação com 6 sub-abas; protocolo; checklist; histórico | Sem integração com portais; GAP-10 ENEL ausente; PDF (.txt resolvido nesta sprint) |
| **Operação** | 20% | AtivoEquipamento.monitoramento (portal, plant_id, credenciais AES) persistido | Sem telemetria real; sem histórico de produção; sem alertas |
| **Ampliação** | 65% | tipo_projeto=ampliacao; projeto_origem_id; arranjo.tipo=ampliacao; somente_leitura=true | Sem fluxo UI específico para clonar projeto pai; snapshot do "executado" depende de freeze |
| **Substituição** | 40% | substitui_ativo_id ↔ substituido_por_ativo_id na entidade | Sem fluxo UI; sem transferência de garantia; sem histórico cruzado |
| **Manutenção** | 15% | HistoricoSchema.tipo inclui 'manutencao', 'falha', 'inspecao' | Sem OS, sem agendamento preventivo, sem SLA, sem visita técnica |
| **Desativação** | 50% | status=desativado na máquina de estados (TRANSICOES) | Sem fluxo de baixa patrimonial; sem nota de desativação |

---

## FASE 4 — AUDITORIA DO ATIVO

### 4.1 — Tipos representados

| Tipo | Suporte | Código QR |
|---|---|---|
| Módulo FV | ✅ (agregado por arranjo×modelo) | FORTE-MOD-XXXXXX |
| Inversor | ✅ (1 por unidade) | FORTE-INV-XXXXXX |
| Microinversor | ✅ | FORTE-MICRO-XXXXXX |
| Otimizador | ✅ | FORTE-OTIM-XXXXXX |
| BESS (bateria) | ✅ | FORTE-BESS-XXXXXX |
| Carregador EV | ✅ | FORTE-CARR-XXXXXX |

### 4.2 — Campos presentes no AtivoEquipamento

| Campo | Status | Detalhe |
|---|---|---|
| QR code | ✅ | FORTE-<TIPO>-<SEQ6>, único, imutável |
| Histórico | ✅ | 10 tipos de evento; diff por campo {campo, de, para} |
| Localização | ✅ parcial | `localizacao: String` (texto livre); sem lat/lon |
| Número de série | ✅ | Coletado no comissionamento (scanner ou manual) |
| Firmware | ✅ | conectividade.firmware |
| IP local | ✅ | conectividade.endereco_ip |
| Wi-Fi SSID | ✅ | conectividade.wifi_ssid |
| Wi-Fi senha | ✅ | conectividade.senha_wifi (AES-256-GCM, nunca exposta) |
| MAC | ✅ | conectividade.mac_wifi |
| Monitoramento | ✅ | portal/plant_id/gateway_sn/logger_id/url (credenciais criptografadas) |
| Garantia | ✅ parcial | garantia_inicio + garantia_fim (datas livres, não auto-preenchidas do catálogo) |
| Substituição chain | ✅ | substitui_ativo_id ↔ substituido_por_ativo_id |
| Arranjo | ✅ | arranjo_id = ProjetoFV.arranjos[].id |
| Topologia | ✅ | string/micro/hibrido/off-grid/otimizador/bess |
| Documentos | ⚠️ | Campo reservado (`documentos: Mixed[]`, not implemented) |

### 4.3 — Utilizável como núcleo do Gêmeo Digital?

**SIM — e já é.** O comentário na linha 10 do próprio model confirma:
> `"O 'Gêmeo Digital': registra O QUE FOI EFETIVAMENTE INSTALADO (as-built)"`

O `AtivoEquipamento` já tem todos os elementos core do Digital Twin:
- Identidade física (QR + série)
- Localização e contexto (arranjo, topologia, projeto)
- Ciclo de vida (estados: planejado → operacional → substituido)
- Histórico auditável (diff por campo)
- Conectividade (IP, Wi-Fi, firmware)
- Monitoramento registry (credenciais do portal)
- Substituição chain (rastreabilidade)

O que falta é a **camada de apresentação e integração** (O&M, telemetria, unifilar linkado), não a entidade base.

---

## FASE 5 — UNIFILAR

| Aspecto | Status | Detalhe |
|---|---|---|
| Unifilar referencia ativos | ❌ | UnifilarFV.jsx gera SVG a partir de `projeto.arranjos[]` — sem referência a AtivoEquipamento |
| Clique leva ao ativo | ❌ | SVG é estático; sem onclick handlers para navegar para `/ativo/qr/:qr` |
| Ativo conhece seu arranjo | ✅ | `AtivoEquipamento.arranjo_id` aponta para `ProjetoFV.arranjos[].id` |
| Arranjo conhece seus equipamentos | ✅ | `ProjetoFV.arranjos[].paineis[]` e `arranjos[].inversores[]` |
| Snapshot do unifilar | ✅ | `governanca.snapshot_unifilar.svg` (congelado, imutável após homologação) |
| Download SVG/PNG | ✅ | Botões de download no UnifilarFV.jsx |

**Maturidade do Unifilar: 55%**

O unifilar existe e funciona. O SVG é congelado corretamente no snapshot. A ligação lógica
`ativo → arranjo_id → unifilar` existe via dado, mas não há navegação visual
(clicar num módulo no diagrama e ver o AtivoEquipamento correspondente).

**Gap crítico:** O unifilar não sabe os QR codes dos ativos instalados; os ativos sabem o `arranjo_id` mas não a posição no SVG.

---

## FASE 6 — HISTÓRICO EXISTENTE

| Fonte | Escopo | Campos | Utilizável como linha do tempo |
|---|---|---|---|
| `AtivoEquipamento.historico[]` | Por ativo (as-built) | tipo, data, usuario, descricao, status_de, status_para, alteracoes[{campo,de,para}] | ✅ **Mais rico para O&M** |
| `ProjetoFV.governanca.historico[]` | Por projeto (engenharia) | timestamp, tipo, descricao | ✅ Linha do tempo de proposta |
| `ProjetoFV.homologacao.historico_status[]` | Por projeto (homologação) | em, status_de, status_para, por, nota | ✅ Linha do tempo de homologação |
| `ProjetoFV.governanca.auditoria[]` | Por projeto (governance) | timestamp, usuario, acao, detalhe, contexto | ✅ Auditoria técnica |
| `ProjetoFV.governanca.comercial.historico[]` | Por projeto (comercial) | timestamp, usuario, acao, detalhe | ✅ Auditoria comercial |
| `ProjetoFV.homologacao.protocolo_historico[]` | Por projeto (protocolo) | em, valor, por | ✅ Rastreio de protocolo |

**Linha do tempo do ativo (Digital Twin):**

O `AtivoEquipamento.historico[]` já suporta:
- `criacao` (geração a partir do projeto)
- `instalacao` (data física no campo)
- `comissionamento` (scanner QR ou manual)
- `troca` / `substituido` (chain de substituição)
- `manutencao` (preventiva/corretiva)
- `falha` (registro de evento)
- `inspecao` (visita técnica)
- `mudanca_status` (transição de estado)

---

## FASE 7 — O&M

| Necessidade O&M | Status | Evidência |
|---|---|---|
| Manutenção preventiva (agendamento, MTBF) | ❌ Ausente | Nenhum scheduler, nenhum plano de manutenção |
| Manutenção corretiva (OS, SLA) | ⚠️ Parcial | tipo=manutencao no historico; sem OS estruturada, sem prazo |
| Substituição de equipamento | ⚠️ Parcial | substitui_ativo_id chain existe; sem fluxo UI, sem transferência de garantia |
| Garantia (alerta de expiração) | ⚠️ Parcial | garantia_inicio/fim no modelo; sem preenchimento automático, sem alerta |
| Visitas técnicas | ❌ Ausente | Sem entidade "Visita", sem tecnico_id para visita, sem checklist de campo |
| Registro de falha/alarme | ⚠️ Parcial | tipo=falha no historico; sem integração com portal de monitoramento |
| Relatório de O&M | ❌ Ausente | — |

---

## FASE 8 — EXPANSÃO DE SISTEMA

| Cenário | Suporte | Mecanismo | Limitação |
|---|---|---|---|
| Ampliação de módulos | ✅ | tipo_projeto=ampliacao + arranjo.tipo=ampliacao + somente_leitura=true | Sem fluxo UI dedicado; snapshot do arranjo executado depende de freeze manual |
| Troca de inversor | ✅ | AtivoEquipamento.substitui_ativo_id chain; status=substituido | Sem fluxo UI; sem propagação automática de garantia |
| Segundo inversor | ✅ | ProjetoFV.arranjos[].inversores[] (multiarranjo) | OK |
| Retrofit (ex.: adicionar BESS) | ⚠️ | Usa arranjo.tipo=ampliacao; sem tipo=retrofit explícito | BESS pode ser adicionado via arranjo mas sem distinção semântica |
| Histórico preservado na ampliação | ✅ | AtivoEquipamento nunca deletado; status=substituido; projeto_origem_id | OK |
| Snapshot do executado preservado | ✅ | governanca.snapshot_catalogo congelado; arranjo.somente_leitura=true | OK |

**Conclusão FASE 8:** A plataforma representa ampliação, substituição e multi-inversor sem perda de histórico. O gap é UI/fluxo (nenhuma tela guia o usuário pelo processo), não dado.

---

## FASE 9 — MATRIZ DE MATURIDADE

| Dimensão | % | Justificativa |
|---|---|---|
| **Projeto** | 90% | ProjetoFV completo: localização GPS, consumo, dimensionamento, concessionária, arranjos, governança, lifecycle |
| **Engenharia** | 85% | Motor elétrico v2 (Voc/Vmpp corrigidos, temperatura, cabos NBR), snapshots imutáveis, 8 tipos de snapshot, versão ENG-2.0 |
| **Instalação** | 60% | AtivoEquipamento com data_instalacao, status=instalado; falta: check-in geolocalizado, foto, assinatura |
| **Homologação** | 75% | Central 6 sub-abas, protocol, PDF gerado, checklist, histórico; falta: integração portal, GAP-10 ENEL |
| **Ativos** | 70% | AtivoEquipamento completo (QR, série, firmware, IP, WiFi, garantia, substituição, monitoramento registry); falta: lat/lon no ativo, documentos |
| **Operação** | 20% | Monitoramento registry (portal/plant_id) existe mas sem telemetria real; sem alertas; sem dashboard |
| **Manutenção** | 15% | Tipos de evento no historico; sem OS, agendamento, SLA, visita |
| **Expansão** | 65% | Modelo de dados suporta ampliação/substituição/multi-inversor; falta fluxo UI |

**Maturidade global: ~60%**

A infraestrutura de dados é madura (~80%). A lacuna está concentrada em O&M (15%) e Operação (20%), que são fases que exigem integração com portais externos de monitoramento.

---

## NOTA DE HONESTIDADE

- Auditoria por leitura de código. ✅
- Contagens de documentos no Atlas: ❌ não acessado (sem acesso ao Atlas nesta sprint).
- Nenhum código foi alterado.
- Nenhuma migração criada.
- Nenhuma funcionalidade implementada.
