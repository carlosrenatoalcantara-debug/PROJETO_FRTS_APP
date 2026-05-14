# 📋 Guia Completo: Editor de Diagrama Unifilar EV com Componentes Realistas

## ⚡ Sequência Correta do Fluxo Elétrico para Carregamento EV

```
┌─────────────────────────────────────────────────────────────────┐
│                    REDE (220V/380V)                             │
│                         ~                                        │
└─────────────┬───────────────────────────────────────────────────┘
              │
              ↓ (Cabo 10mm²)
┌─────────────────────────────────────────────────────────────────┐
│              DISJUNTOR BIPOLAR (32A)                            │
│              [Alavanca] [Alavanca]                              │
└─────────────┬───────────────────────────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────────────────────────┐
│              DPS ⚡ (275V ou 420V)                              │
│         [Proteção contra Surtos]                               │
└─────────────┬───────────────────────────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────────────────────────┐
│              IDR TIPO A (30mA)                                  │
│              [Alavanca] [TEST]                                  │
└─────────────┬───────────────────────────────────────────────────┘
              │
              ↓ (Cabo 10mm²)
┌─────────────────────────────────────────────────────────────────┐
│              CARREGADOR EV (7kW - 22kW)                        │
│              [Indicador] [Conector]                             │
└─────────────┬───────────────────────────────────────────────────┘
              │
              ↓ (Cabo carregador específico para o veículo)
┌─────────────────────────────────────────────────────────────────┐
│              CARRO / VEÍCULO ELÉTRICO                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Componentes Realistas Disponíveis

### 1. **REDE** (Laranja #f97316)
- Símbolo: Círculo com `~` (corrente alternada)
- Função: Fonte de alimentação principal
- Parâmetros: Tensão (220V/380V)

### 2. **CABO** (Verde #10b981)
- Símbolo: Retângulo com bitola em mm²
- Função: Condutor elétrico entre componentes
- Parâmetros: Bitola (10mm², 16mm², etc), comprimento
- **Observação:** Use 10mm² padrão no projeto EV

### 3. **DISJUNTOR BIPOLAR** (Azul #3b82f6)
- Símbolo: Duas alavancas pretas
- Função: Proteção contra sobrecarga
- Parâmetros: Corrente nominal (32A, 40A, etc)
- **Observação:** Deve ser BIPOLAR (2 polos) para 3 fases

### 4. **DPS ⚡** (Laranja forte #ff6b35) - **OBRIGATÓRIO**
- Símbolo: Triângulo com círculo vermelho
- Função: Proteção contra surtos de tensão
- Parâmetros: Tensão nominal (275V para 220V, 420V para 380V)
- **Observação:** NUNCA pode faltar no diagrama!

### 5. **IDR TIPO A** (Roxo #a855f7)
- Símbolo: Duas alavancas + botão TEST (vermelho)
- Função: Proteção diferencial residual (proteção contra choque)
- Parâmetros: Sensibilidade (30mA, 300mA)
- **Observação:** Tipo A é essencial para carregadores com eletrônica

### 6. **CARREGADOR EV** (Rosa #db2777)
- Símbolo: Caixa com conector de plugue
- Função: Equipamento de carregamento veicular
- Parâmetros: Potência (7kW, 11kW, 22kW)
- **Observação:** Último componente antes do veículo

### 7. **COMPONENTES CUSTOMIZADOS** (Amarelo-ouro #facc15)
- Símbolo: Retângulo amarelo com nome customizado
- Função: Adicionar componentes específicos (transformadores, medidores, etc)
- Parâmetros: Nome, descrição, valores customizados
- **Observação:** Totalmente editável!

---

## 🎮 Como Usar o Editor

### **Adicionar Componentes**

1. **Clique no botão correspondente** na toolbar "ADICIONAR:"
   - `REDE` - Adicionar rede elétrica
   - `DISJ.` - Adicionar disjuntor
   - `DPS ⚡` - Adicionar protetor de surtos
   - `DR` - Adicionar dispositivo diferencial
   - `CABO` - Adicionar condutor
   - `CARR.` - Adicionar carregador
   - `➕ Customizado` - Adicionar componente customizado

2. **O componente aparecerá** no canvas (área de desenho) com um desenho realista

3. **Clique e arraste** para mover o componente para a posição desejada

### **Editar Componentes**

1. **Passe o mouse** sobre o componente
2. **Clique no ícone ✏️** (lápis) que aparece
3. **Preencha os valores:**
   - `Valor`: Parâmetro principal (corrente, tensão, bitola, etc)
   - `Unidade`: A (amperes), V (volts), mA (miliamperes), mm² (milímetros quadrados), kW, etc
   - `Descrição`: Informações adicionais (ex: "Bipolar", "Tipo A")
4. **Clique "✓ Salvar"** para confirmar

### **Conectar Componentes**

1. **Clique e arraste** do círculo verde inferior de um componente
2. **Solte** no círculo verde superior do componente seguinte
3. **Automático:** A cor da linha muda conforme o tipo (CA = azul, CC = vermelho)

### **Deletar Componentes**

1. **Passe o mouse** sobre o componente
2. **Clique no ícone 🗑️** (lixo) que aparece
3. **Confirme** na caixa de diálogo

---

## 🎨 Alternar Visualização

### **Botão "🎨 Realista" / "📐 Genérico"**

- **Realista** (padrão): Mostra desenhos dos componentes como parecem na realidade
- **Genérico**: Mostra versão simplificada (para melhor performance em diagramas grandes)

---

## 📐 Adicionar Componente Customizado

### **Passo a Passo:**

1. **Clique em "➕ Customizado"** na toolbar
2. **Preencha o formulário modal:**
   - **Nome*** (obrigatório): Ex: "Transformador", "Protetor extra", "Medidor"
   - **Descrição** (opcional): Ex: "10 kVA", "Isolamento 5kV"
   - **Valor 1** (opcional): Ex: "50", "100"
   - **Valor 2** (opcional): Ex: "Classe II", "Tipo 2"
3. **Clique "➕ Adicionar Componente"**
4. **O componente amarelo-ouro** aparecerá no diagrama
5. **Edite e conecte** normalmente como qualquer outro componente

---

## ✅ Validação Automática

### **O sistema valida automaticamente:**

- ✅ Todos os componentes obrigatórios estão presentes (REDE, DISJUNTOR, DPS, DR, CABO, CARREGADOR)
- ✅ DPS está sempre presente (OBRIGATÓRIO!)
- ✅ Fluxo elétrico está na sequência correta
- ✅ Valores estão dentro dos limites NBR 5410
- ✅ Conexões são válidas entre componentes

**Se houver erro:** Uma mensagem vermelha aparece na base indicando o problema

---

## 🔄 Histórico (Undo/Redo)

- **↶ Desfazer** (Ctrl+Z): Volta a ação anterior
- **↷ Refazer** (Ctrl+Shift+Z): Avança a ação desfeita
- **Histórico completo:** Até 20 ações são armazenadas

---

## 📊 Exportar Diagrama

- **💾 Exportar**: Salva o diagrama como arquivo JSON
- **Posteriormente:** Pode ser importado novamente para continuar edição

---

## 🎯 Exemplo Completo: Carregador 7kW em Casa

### **Diagrama Esperado:**

```
1. REDE (380V Trifásico)
   ↓ Cabo 10mm²
2. DISJUNTOR BIPOLAR (32A)
   ↓
3. DPS (420V) ⚡ [OBRIGATÓRIO]
   ↓
4. IDR TIPO A (30mA)
   ↓ Cabo 10mm²
5. CARREGADOR EV (7kW)
   ↓ Cabo específico (normalmente 6mm² para veículo)
6. CARRO (Bateria será carregada)
```

### **Parâmetros Esperados:**

| Componente | Valor | Unidade | Descrição |
|-----------|-------|---------|-----------|
| Rede | 380 | V | Trifásico |
| Disjuntor | 32 | A | Bipolar, Curva C |
| DPS | 420 | V | Classe II |
| IDR | 30 | mA | Tipo A |
| Cabo (alimentação) | 10 | mm² | Cobre 0,6/1kV |
| Carregador | 7 | kW | AC Trifásico |
| Cabo (veículo) | 6 | mm² | Específico para carro |

---

## 🔄 Funcionalidades Avançadas (Fase 4)

### **Undo/Redo System - Histórico Completo**

O editor possui um sistema completo de histórico que permite desfazer e refazer até **20 ações** anteriores:

- **Ctrl+Z** (ou Cmd+Z no Mac): Desfazer última ação
- **Ctrl+Shift+Z** (ou Cmd+Shift+Z): Refazer ação desfeita
- **Botões na toolbar:** "↶ Desfazer" e "↷ Refazer"
- **Persistência:** Histórico é salvo em localStorage automaticamente
- **Snapshots descritivos:** Cada ação registra o que foi feito ("Moveu Painel 1", "Editou bitola do CABO", etc)

**Exemplo:**
```
Ação 1: Mover DISJUNTOR
Ação 2: Editar corrente de 32A para 40A  ← Usuário faz Ctrl+Z aqui
Ação 2 desfeita: Voltou para 32A
Usuário faz Ctrl+Shift+Z: Volta para 40A
```

### **Validação Inteligente de Conexões**

Sistema automático que valida e sugere conexões corretas:

- **Matriz de compatibilidade:** Só permite conexões elétrico-válidas
- **Sequência obrigatória:** REDE → DISJUNTOR → DPS → DR → CABO → CARREGADOR
- **Handles coloridos:** Durante conexão, apenas handles compatíveis ficam verdes
- **Erros claros:** "❌ Conexão inválida: Carregador → Disjuntor" quando tenta conectar errado
- **Tipos de conexão:** Cores indicam tipo (CA azul, CC vermelho, Terra verde)

**Tipos permitidos:**
```
REDE (origem) → DISJUNTOR ✓
DISJUNTOR → DPS ✓
DPS → DR ✓
DR → CABO ✓
CABO → CARREGADOR ✓
CARREGADOR → ... ✗ (ponto final)
```

### **Snap-to-Grid - Alinhamento Automático**

Componentes se alinham automaticamente a uma grade 16×16 pixels:

- **Automático ao soltar:** Nós se alinha quando você solta a posição
- **Botão "⊞ Alinhar à Grade":** Realinha todos os nós de uma vez
- **Melhor organização:** Diagrama fica mais limpo e profissional
- **Posições precisas:** Coordenadas são sempre múltiplos de 16

### **Validação Bloqueante - Valores Seguros**

Impede erros elétricos bloqueando valores inválidos:

**Ranges válidos (NBR 5410):**
| Campo | Mínimo | Máximo | Unidade |
|-------|--------|--------|---------|
| REDE - Corrente | 1 | 200 | A |
| DISJUNTOR - Corrente | 6 | 200 | A |
| DR - Sensibilidade | 10 | 300 | mA |
| CABO - Bitola | 1.5 | 240 | mm² |
| CABO - Comprimento | 0.1 | 1000 | m |
| CARREGADOR - Potência | 3.7 | 22 | kW |

**Componentes obrigatórios:**
- ✓ REDE (origem) - NÃO pode deletar
- ✓ CARREGADOR (destino) - NÃO pode deletar
- ✓ DPS (proteção) - NÃO pode deletar
- ❌ Tentar salvar sem estes = BLOQUEADO com erro

**Exemplo de erro bloqueante:**
```
Usuário tenta CABO bitola = -5
Sistema responde: ❌ bitola deve estar entre 1.5 e 240 mm²
Atualização é REJEITADA
```

## 🚀 Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl+Z` | Desfazer |
| `Ctrl+Shift+Z` | Refazer |
| `Duplo clique` | Editar componente |
| `Delete` | Deletar selecionado |
| `Scroll` | Zoom in/out |
| `Arrastar` | Mover componente (auto snap-to-grid) |

---

## 💡 Dicas Importantes

1. **DPS é obrigatório!** O sistema não permite diagrama sem DPS
2. **Bitola do cabo:** Use 10mm² entre componentes, 6mm² até o carregador (dependendo da distância)
3. **Disjuntor bipolar:** Essencial para 3 fases (380V)
4. **IDR Tipo A:** Necessário quando há eletrônica (carregadores)
5. **Sequência importa:** Não pule componentes no fluxo
6. **Componentes customizados:** Use para adicionar transformadores, medidores, ou proteções extras

---

## ❓ Perguntas Frequentes

**P: Posso omitir o DPS?**
R: NÃO! O DPS é OBRIGATÓRIO pela NBR 5410. O sistema bloqueará diagramas sem ele.

**P: Qual é a diferença entre DR e IDR?**
R: DR = Dispositivo Residual, IDR = Interruptor Diferencial Residual. Ambos são proteção diferencial, mas IDR oferece proteção maior.

**P: Posso usar Disjuntor Unipolar?**
R: Não é recomendado. Para 3 fases, use Disjuntor Bipolar (2 polos) no mínimo.

**P: Como exporto o diagrama para usar em documento?**
R: Use o botão "Baixar Unifilar" para gerar PDF, ou "💾 Exportar" para salvar como JSON.

**P: Os valores são validados?**
R: Sim! O sistema valida conforme NBR 5410 e bloqueia valores inválidos.

---

**Última atualização:** 2026-05-14
**Versão:** 2.0 (Componentes Realistas)
