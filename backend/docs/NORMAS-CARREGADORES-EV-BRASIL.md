# 📋 Normas Brasileiras para Instalação de Carregadores de Veículos Elétricos

## 🔴 NORMAS PRINCIPAIS (ABNT)

### 1. **ABNT NBR 17019:2022** - ⭐ FUNDAMENTAL
**Ocupações destinadas a garagens e locais com sistemas de alimentação de veículos elétricos**
- Requisitos específicos para instalações elétricas de baixa tensão
- Alimentação de veículos elétricos
- Proteção contra choques e sobrecargas
- Dimensionamento de circuitos para carregadores EV
- **APLICAÇÃO:** Deve ser o padrão base para TODOS os projetos EV

### 2. **ABNT NBR 5410:2004 (e versões atualizadas)**
**Instalações elétricas de baixa tensão (até 1000V CA ou 1500V CC)**
- Norma fundamental para dimensionamento de circuitos
- Seleção de condutores (seção mínima)
- Proteção contra choques elétricos
- Proteção contra sobrecargas
- Proteção contra curtos-circuitos
- Aterramento e equipotencialização
- **APLICAÇÃO:** Base para cálculos de bitola, disjuntores e DR

### 3. **ABNT NBR IEC 61851-1:2021**
**Requisitos gerais para sistemas de recarga condutiva de veículos elétricos**
- Modos de operação de recarga (Modo 1, 2, 3, 4)
- Segurança do sistema
- Componentes de proteção
- Sequência de recarga
- **APLICAÇÃO:** Definir modo de operação no projeto

### 4. **ABNT NBR IEC 62196-1/2/3:2021**
**Conectores, plugues e tomadas de recarga condutiva**
- Especificações técnicas de conectores
- Plugues e tomadas padronizadas
- Compatibilidade de interfaces
- **APLICAÇÃO:** Especificar tipo de conector no projeto

### 5. **ABNT NBR 5419:2026**
**Proteção contra descargas atmosféricas (SPDA)**
- Sistema de proteção contra descargas atmosféricas
- Obrigatório para infraestrutura externa
- Proteção dos veículos e equipamentos
- **APLICAÇÃO:** Implementar SPDA em instalações ao ar livre

### 6. **CORPO DE BOMBEIROS DO RN - RT-05-2025**
**Ocupações destinadas a garagens e locais com sistemas de alimentação de veículos elétricos**
- Requisitos específicos regionais (RN)
- Segurança contra incêndio
- Saídas de emergência
- Sinalização e proteção
- **APLICAÇÃO:** Respeitar requisitos locais de segurança contra incêndio

---

## 🔌 REQUISITOS DE DIMENSIONAMENTO

### **Corrente de Projeto (NBR 5410)**
```
I_projeto = (P_carregador / V_nominal) × fator_segurança
```

### **Bitola do Condutor (mm²)**
| Corrente (A) | Bitola (mm²) | Comprimento até 30m |
|---|---|---|
| Até 10 | 1.5 | ✓ |
| 10-16 | 2.5 | ✓ |
| 16-25 | 4 | ✓ |
| 25-32 | 6 | ✓ |
| 32-40 | 10 | ✓ |
| 40-50 | 16 | ✓ |
| 50-63 | 25 | ✓ |

### **Proteção (Disjuntor)**
- Disjuntor **1.3 × I_projeto** (máximo permitido)
- Curva tipo C para cargas normais
- Curva tipo B para cargas com inrush suave

### **Proteção contra Correntes de Fuga (DR)**
- **Valor obrigatório:** 30mA (máximo)
- **Tipo:** Seletivo ou rápido conforme projeto
- **Aplicação:** Todo carregador EV deve ter DR 30mA

### **Aterramento**
- Resistência máxima de aterramento: **10 Ω** (preferível < 5 Ω)
- Condutor de proteção (PE): **mesma seção da fase**
- Equipotencialização obrigatória

---

## ⚡ MODOS DE OPERAÇÃO (NBR IEC 61851-1)

### **Modo 1 - Recarga Normal (Residencial)**
- Tensão: 230V monofásico
- Corrente: até 16A
- Proteção: Disjuntor + DR no quadro
- Uso: Residências, tomadas convencionais

### **Modo 2 - Recarga Portátil com Proteção**
- Tensão: 230V ou 400V
- Corrente: até 32A
- Proteção: Dispositivo de proteção portátil (CPSE)
- Uso: Soluções temporárias

### **Modo 3 - Recarga Dedicada com Comunicação**
- Tensão: 230V ou 400V (trifásico)
- Corrente: até 32A por fase
- Proteção: Wall box com comunicação
- Uso: Garagens, estacionamentos, condomínios

### **Modo 4 - Recarga Rápida DC**
- Tensão: 400V a 920V (DC)
- Corrente: até 350A
- Proteção: Conversão AC/DC com proteção integrada
- Uso: Estações de recarga rápida pública

---

## 🔴 CHECKLIST DE IMPLEMENTAÇÃO EM DIAGRAMAS UNIFILAR

### **Informações Obrigatórias no Diagrama:**

- [ ] **Normas Aplicadas:** NBR 17019:2022, NBR 5410:2004, NBR IEC 61851-1:2021
- [ ] **Modo de Operação:** (1, 2, 3 ou 4)
- [ ] **Tensão de Alimentação:** 230V monofásico / 400V trifásico
- [ ] **Corrente de Projeto:** _____ A
- [ ] **Bitola dos Condutores:** _____ mm²
- [ ] **Tipo de Disjuntor:** (Curva B ou C) _____ A
- [ ] **DR (Corrente de Fuga):** 30mA
- [ ] **Tipo de Conector:** IEC 62196-2 / Tesla / CHAdeMO / CCS
- [ ] **Comprimento da Instalação:** _____ m
- [ ] **Queda de Tensão Máxima:** 3% (até 5% no final da linha)
- [ ] **Aterramento:** Resistência _____ Ω
- [ ] **SPDA (se aplicável):** Sim / Não
- [ ] **Proteção Diferencial:** DR 30mA Tipo AC/A/B

### **Cálculos Obrigatórios:**

1. **Corrente de Projeto (I):**
   - Fórmula: P ÷ V × 1.25 (fator de segurança)
   - Exemplo: 7 kW ÷ 230V × 1.25 = 38.04A → **40A**

2. **Seção do Condutor (S):**
   - Capacidade de corrente + queda de tensão
   - Verificar tabelas NBR 5410
   - Mínimo comercial: 1.5 mm²

3. **Queda de Tensão (ΔU):**
   - Fórmula: (2 × ρ × L × I) / S
   - ρ = Resistividade do cobre (0.0175 Ω·mm²/m)
   - L = Comprimento do condutor (m)
   - I = Corrente (A)
   - S = Seção (mm²)
   - **Máximo permitido: 3% (ou 5% para final de linha)**

4. **Disjuntor (Proteção):**
   - I_disjuntor = 1.3 × I_projeto (máximo)
   - Valores comerciais: 20A, 25A, 32A, 40A, 50A, 63A, 80A

5. **Aterramento:**
   - Verificar resistência máxima de 10Ω
   - Aumentar eletrodos se necessário
   - Registrar valor medido

---

## 📐 EXEMPLO DE PROJETO COM NORMAS APLICADAS

### **Cenário: Carregador EV 7kW em Residência (Modo 1)**

**Dados:**
- Potência: 7 kW
- Tensão: 230V monofásico
- Distância: 30 m
- Local: Garagem coberta

**Cálculos Conforme Normas:**

1. **Corrente de Projeto (NBR 5410):**
   - I = (7000 / 230) × 1.25 = **38.04A**
   - Usar: **40A** (valor comercial)

2. **Bitola (NBR 5410 - Tabela):**
   - Para 40A até 30m: **10mm²** (conforme tabela)
   - Queda de tensão check: (2 × 0.0175 × 30 × 40) / 10 = 4.2%
   - ⚠️ **Excede 3%!** Usar **16mm²** para reduzir a 2.6%

3. **Disjuntor (NBR 5410):**
   - I_disjuntor máx = 1.3 × 40 = 52A
   - Usar: **Disjuntor 50A Curva C**

4. **DR (NBR IEC 61851-1):**
   - Obrigatório: **DR 30mA Tipo AC**

5. **Aterramento (NBR 5410):**
   - Resistência máxima: **10Ω** (preferível < 5Ω)
   - Medir e registrar no projeto

**Diagrama Unifilar Resultante:**
```
┌─────────────────────────────────────┐
│   ALIMENTAÇÃO PRINCIPAL 230V/60Hz    │
│   DISJUNTOR GERAL 63A               │
└──────────────┬──────────────────────┘
               │
        ┌──────▼───────┐
        │   DR 30mA    │  (Proteção diferencial)
        │   Tipo AC    │
        └──────┬───────┘
               │
    ┌──────────▼──────────┐
    │  CIRCUITO CARREGADOR│
    │  Disjuntor: 50A C   │  (NBR 5410)
    │  Condutor: 16mm²    │  (NBR 17019:2022)
    │  Comprimento: 30m   │
    │  ΔU: 2.6% ✓         │
    └──────────┬──────────┘
               │
         ┌─────▼─────┐
         │ WALL BOX  │  (Conector IEC 62196-2)
         │ 7kW       │  (NBR IEC 62196-1/2021)
         │ Modo 1    │
         └───────────┘
```

---

## 🚨 REQUISITOS DE SEGURANÇA (CORPO DE BOMBEIROS RN)

1. **Sinalização:**
   - Placa de "CARREGADOR DE VEÍCULO ELÉTRICO"
   - Identificação de tensão perigosa

2. **Acesso e Circulação:**
   - Mínimo 1.2m de espaço livre ao redor
   - Via de acesso desobstruída

3. **Proteção Contra Incêndio:**
   - SPDA obrigatório em instalações ao ar livre
   - Distância mínima de materiais inflamáveis

4. **Tomadas e Conectores:**
   - Proteção contra intempéries (se ao ar livre)
   - Acesso restrito a pessoas autorizadas (se aplicável)

5. **Documentação:**
   - ART (Anotação de Responsabilidade Técnica)
   - Manual de operação e manutenção
   - Certificado de aterramento
   - Laudo de funcionamento

---

## 📚 REFERÊNCIAS E NORMAS

| Norma | Descrição | Aplicação |
|---|---|---|
| ABNT NBR 17019:2022 | Garagens com EV | Requisitos principais |
| ABNT NBR 5410:2004 | Instalações BT | Cálculos e proteção |
| ABNT NBR IEC 61851-1:2021 | Sistema recarga | Modos de operação |
| ABNT NBR IEC 62196-1/2/3:2021 | Conectores | Especificação física |
| ABNT NBR 5419:2026 | SPDA | Proteção atmosférica |
| **Corpo de Bombeiros RN - RT-05-2025** | **Requisitos regionais** | **Segurança contra incêndio** |
| ABNT NBR 10898 | Sistema detecção incêndio | Se necessário |

---

## ✅ PRÓXIMOS PASSOS

1. **Atualizar templates de diagrama unifilar** para incluir todos os requisitos acima
2. **Criar checklist de conformidade** para cada projeto EV
3. **Implementar cálculos automáticos** no sistema conforme fórmulas acima
4. **Adicionar validações** para garantir conformidade com normas
5. **Documentar sempre** quais normas foram aplicadas em cada projeto

---

**Última Atualização:** 2026-05-13  
**Status:** Documento de Referência para Implementação  
**Validação:** Conforme ABNT NBR 17019:2022 + Corpo de Bombeiros RN RT-05-2025
