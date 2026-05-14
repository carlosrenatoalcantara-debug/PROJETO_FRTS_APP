# 🧪 Guia de Validação - Editor de Diagrama Unifilar EV

## Versão Atual
- **Phase 2:** ✅ Componentes Realistas + DPS Obrigatório + Customização
- **Phase 4:** ✅ Undo/Redo + Validação de Conexões + Snap-to-Grid + Validações Bloqueantes
- **Phase 5:** ✅ Edição de Edges + Context Menu + Tipos de Conexão
- **Status:** 🚀 Pronto para Produção

---

## 📋 Matriz de Testes

### Seção 1: Componentes Realistas (Phase 2)

#### 1.1 Renderização Visual
- [ ] **Componente REDE**
  - [ ] Aparece como círculo laranja (#f97316)
  - [ ] Tem símbolo `~` em branco no centro
  - [ ] Label exibe "REDE" com corrente (ex: "32.5A")

- [ ] **Componente DISJUNTOR**
  - [ ] Aparece como retângulo azul (#3b82f6)
  - [ ] Tem 2 alavancas pretas (símbolo bipolar)
  - [ ] Label exibe "DISJUNTOR" com corrente (ex: "32A")

- [ ] **Componente DPS**
  - [ ] Aparece como retângulo laranja forte (#ff6b35)
  - [ ] Tem triângulo de proteção + círculo vermelho
  - [ ] Label exibe "DPS ⚡" com tensão (ex: "420V")

- [ ] **Componente DR (IDR)**
  - [ ] Aparece como retângulo roxo (#a855f7)
  - [ ] Tem 2 alavancas + botão TEST vermelho
  - [ ] Label exibe "IDR" com sensibilidade (ex: "30mA")

- [ ] **Componente CABO**
  - [ ] Aparece como retângulo verde (#10b981)
  - [ ] Label exibe "CABO" com bitola (ex: "10mm²")

- [ ] **Componente CARREGADOR**
  - [ ] Aparece como retângulo rosa (#db2777)
  - [ ] Tem LED indicador verde + conector
  - [ ] Label exibe "CARREGADOR" com potência (ex: "7kW")

- [ ] **Componente CUSTOMIZADO**
  - [ ] Aparece como retângulo amarelo-ouro (#fbbf24)
  - [ ] Mostra nome customizado
  - [ ] Totalmente editável

#### 1.2 Toggle Realista/Genérico
- [ ] **Botão "🎨 Realista" na toolbar**
  - [ ] Clique ativa modo realista (desenhos SVG detalhados)
  - [ ] Clique novamente ativa modo genérico (caixas simples)
  - [ ] Todos os componentes mudam de renderização
  - [ ] Dados são preservados em ambos os modos

#### 1.3 DPS Obrigatório
- [ ] **Criação de novo diagrama**
  - [ ] DPS aparece automaticamente na sequência
  - [ ] Posição: entre DISJUNTOR e DR
  - [ ] Não pode ser deletado (validação bloqueia)
  - [ ] Tentativa de deletar mostra erro: "❌ DPS é obrigatório"

- [ ] **Validação ao salvar**
  - [ ] Tentar salvar sem DPS = BLOQUEADO
  - [ ] Mensagem de erro clara: "❌ DPS (proteção) é obrigatória"

#### 1.4 Customização de Componentes
- [ ] **Adicionar novo componente**
  - [ ] Clique em "➕ Customizado"
  - [ ] Modal abre com campos: Nome, Descrição, Valor 1, Valor 2
  - [ ] Nome é obrigatório
  - [ ] Clique "➕ Adicionar Componente"
  - [ ] Novo componente aparece no diagrama em amarelo-ouro

- [ ] **Editar componente customizado**
  - [ ] Duplo-clique no componente abre modal
  - [ ] Preencha valores
  - [ ] Clique "✓ Salvar"
  - [ ] Valores são atualizados no diagrama

- [ ] **Deletar componente customizado**
  - [ ] Hover no componente mostra botão 🗑️
  - [ ] Clique em 🗑️
  - [ ] Modal de confirmação aparece
  - [ ] Clique "Confirmar"
  - [ ] Componente é removido e conexões limpas

---

### Seção 2: Undo/Redo System (Phase 4)

#### 2.1 Funcionalidade Básica
- [ ] **Desfazer (Ctrl+Z)**
  - [ ] Faça 3 ações: mover nó, editar valor, adicionar componente
  - [ ] Pressione Ctrl+Z
  - [ ] Voltam para estado anterior a última ação
  - [ ] Histórico mantém até 20 ações

- [ ] **Refazer (Ctrl+Shift+Z)**
  - [ ] Depois de Ctrl+Z, pressione Ctrl+Shift+Z
  - [ ] Ação desfeita é reexecutada
  - [ ] Pode refazer múltiplas ações

- [ ] **Botões na Toolbar**
  - [ ] Botões "↶ Desfazer" e "↷ Refazer" existem
  - [ ] Funcionam igual aos atalhos
  - [ ] Desabilitados quando não há ações (no início ou no fim)

#### 2.2 Persistência do Histórico
- [ ] **LocalStorage**
  - [ ] Crie 3 ações diferentes
  - [ ] Recarregue a página (F5)
  - [ ] Histórico está lá (posso fazer Ctrl+Z)
  - [ ] Snapshots são preservados

- [ ] **Limite de 20 Snapshots**
  - [ ] Faça 22 ações rapidamente
  - [ ] Histórico mantém apenas últimas 20
  - [ ] Ação 1 e 2 são descartadas (FIFO)

#### 2.3 Snapshots Descritivos
- [ ] **Ver descrições ao fazer Undo**
  - [ ] Cada snapshot tem descrição (visible em console logs ou UI)
  - [ ] Ex: "Moveu nó(s)", "Editou corrente do DISJUNTOR", "Conectou REDE → DISJUNTOR"

---

### Seção 3: Validação de Conexões (Phase 4)

#### 3.1 Matriz de Compatibilidade
- [ ] **Conexões Válidas**
  - [ ] REDE → DISJUNTOR ✓
  - [ ] DISJUNTOR → DPS ✓
  - [ ] DPS → DR ✓
  - [ ] DR → CABO ✓
  - [ ] CABO → CARREGADOR ✓

- [ ] **Conexões Inválidas (Bloqueadas)**
  - [ ] REDE → DR ✗ (mostra erro)
  - [ ] DISJUNTOR → CARREGADOR ✗ (mostra erro)
  - [ ] CARREGADOR → qualquer coisa ✗ (é ponto final)
  - [ ] SPECS → qualquer coisa ✗ (só informação)

#### 3.2 Handles Coloridos
- [ ] **Durante Drag para Conectar**
  - [ ] Ao arrastar de um nó, handles compatíveis ficam verdes
  - [ ] Handles incompatíveis ficam cinza/desabilitados
  - [ ] Você só consegue conectar aos verdes

#### 3.3 Mensagens de Erro
- [ ] **Tentativa de Conexão Inválida**
  - [ ] Erro claro: "❌ Conexão inválida: CARREGADOR → DISJUNTOR"
  - [ ] Alert mostra tipo dos nós envolvidos
  - [ ] Conexão NÃO é criada

---

### Seção 4: Snap-to-Grid (Phase 4)

#### 4.1 Alinhamento Automático
- [ ] **Ao soltar um nó**
  - [ ] Mova um componente para posição não-alinhada (ex: x=137, y=256)
  - [ ] Solte o mouse
  - [ ] Nó se alinha automaticamente ao múltiplo de 16 mais próximo
  - [ ] Posição final: x=144, y=256 (ou similiar)

- [ ] **Botão "⊞ Alinhar à Grade"**
  - [ ] Mova vários nós para posições não-alinhadas
  - [ ] Clique botão na toolbar
  - [ ] Todos os nós se alinham imediatamente
  - [ ] Layout fica organizado em grid

#### 4.2 Visual Grid (Opcional)
- [ ] **Grid Background**
  - [ ] Fundo do canvas mostra linhas de grid (subtle, 16px de espaço)
  - [ ] Ajuda a visualizar onde nós vão "snap"

---

### Seção 5: Validações Bloqueantes (Phase 4)

#### 5.1 Range Validation
- [ ] **REDE - Corrente (1-200A)**
  - [ ] Tente editar para 0A → Rejeitado: "❌ corrente_projeto_a deve estar entre 1 e 200 A"
  - [ ] Tente 250A → Rejeitado: "❌ corrente_projeto_a deve estar entre 1 e 200 A"
  - [ ] 32.5A → ✓ Aceito

- [ ] **DISJUNTOR - Corrente (6-200A)**
  - [ ] Tente 2A → Rejeitado
  - [ ] 32A → ✓ Aceito

- [ ] **DR - Sensibilidade (10-300mA)**
  - [ ] Tente 5mA → Rejeitado
  - [ ] 30mA → ✓ Aceito

- [ ] **CABO - Bitola (1.5-240mm²)**
  - [ ] Tente -5mm² → Rejeitado
  - [ ] Tente 500mm² → Rejeitado
  - [ ] 10mm² → ✓ Aceito

- [ ] **CABO - Comprimento (0.1-1000m)**
  - [ ] Tente 0m → Rejeitado
  - [ ] Tente 10000m → Rejeitado
  - [ ] 50m → ✓ Aceito

- [ ] **CARREGADOR - Potência (3.7-22kW)**
  - [ ] Tente 2kW → Rejeitado
  - [ ] Tente 30kW → Rejeitado
  - [ ] 7kW → ✓ Aceito

#### 5.2 Componentes Obrigatórios
- [ ] **Não conseguir deletar REDE**
  - [ ] Hover em REDE → sem botão 🗑️ ou desabilitado
  - [ ] Validação diz: "❌ REDE (origem) é obrigatória"

- [ ] **Não conseguir deletar CARREGADOR**
  - [ ] Hover em CARREGADOR → sem botão 🗑️ ou desabilitado
  - [ ] Validação diz: "❌ CARREGADOR (destino) é obrigatório"

- [ ] **Não conseguir deletar DPS**
  - [ ] Hover em DPS → sem botão 🗑️ ou desabilitado
  - [ ] Validação diz: "❌ DPS (proteção) é obrigatória"

#### 5.3 Salvamento Bloqueado
- [ ] **Com erros de validação**
  - [ ] CABO com bitola inválida
  - [ ] Tentar salvar/gerar PDF → Bloqueado
  - [ ] Mensagem: "❌ Existem erros que precisam ser corrigidos"

---

### Seção 5B: Edição de Edges - Context Menu (Phase 5)

#### 5B.1 Context Menu de Edge
- [ ] **Clique Direito em Uma Conexão**
  - [ ] Posicione o mouse sobre uma linha de conexão
  - [ ] Clique direito (ou context menu)
  - [ ] Menu aparece com opções:
    * Tipo de Conexão (submenu)
    * Deletar Conexão
    * Info do edge

- [ ] **Info do Edge**
  - [ ] Mostra "Origem:" com ID do nó source
  - [ ] Mostra "Destino:" com ID do nó target
  - [ ] Mostra "Tipo:" com tipo atual (CA, CC, TERRA)

#### 5B.2 Submenu de Tipos de Conexão
- [ ] **CA (Corrente Alternada)**
  - [ ] Hover em submenu mostra "CA (Corrente Alternada)"
  - [ ] Clique muda edge para azul (#3b82f6)
  - [ ] Label no meio da edge mostra "CA"

- [ ] **CC (Corrente Contínua)**
  - [ ] Hover mostra "CC (Corrente Contínua)"
  - [ ] Clique muda edge para vermelho (#ef4444)
  - [ ] Label mostra "CC"

- [ ] **TERRA/Neutro**
  - [ ] Hover mostra "Terra/Neutro"
  - [ ] Clique muda edge para verde (#059669)
  - [ ] Label mostra "TERRA"

#### 5B.3 Deletar Conexão
- [ ] **Menu Delete Edge**
  - [ ] Clique em "Deletar Conexão"
  - [ ] Edge desaparece do diagrama
  - [ ] Nós ficam desconectados
  - [ ] Histórico registra "Deletou conexão"
  - [ ] Ctrl+Z desfaz a deleção

#### 5B.4 Label de Edge
- [ ] **Visual do Label**
  - [ ] Label aparece no meio da edge
  - [ ] Mostra tipo atual (CA, CC, TERRA)
  - [ ] Cor do label corresponde à cor da edge
  - [ ] Label é clicável para abrir context menu

- [ ] **Hover no Label**
  - [ ] Label aumenta um pouco (scale 1.15)
  - [ ] Mostra tooltip: "Clique direito para editar"
  - [ ] Background fica mais escuro

#### 5B.5 Integração com Undo/Redo
- [ ] **Mudar Tipo de Edge**
  - [ ] CA → CC (via menu)
  - [ ] Ctrl+Z volta para CA
  - [ ] Ctrl+Shift+Z volta para CC
  - [ ] Histórico: "Alterou tipo de conexão para CC"

- [ ] **Deletar Edge**
  - [ ] Delete conexão via menu
  - [ ] Ctrl+Z restaura com tipo anterior
  - [ ] Histórico: "Deletou conexão"

#### 5B.6 Responsividade
- [ ] **Em Mobile/Tablet**
  - [ ] Context menu fica visível ao longo tap
  - [ ] Submenu abre à esquerda em telas pequenas
  - [ ] Texto é legível (font-size ajustado)
  - [ ] Menu não sai da tela

---

### Seção 6: Fluxo Completo

#### 6.1 Criar Diagrama Novo
- [ ] **Sequência esperada**
  1. Abrir Nova Proposta EV
  2. Passar por Step 1-2 (cliente, carregador)
  3. Step 3: Cálculos NBR (preencher valores)
  4. Step 4: Unifilar Diagram editor abre
  5. Diagrama mostra: REDE → CABO → DISJUNTOR → DPS → DR → CABO → CARREGADOR
  6. Tudo com renderização realista

#### 6.2 Editar Diagrama
- [ ] **Mover componentes**
  - [ ] Arraste DISJUNTOR para direita
  - [ ] Solte (snap-to-grid automático)
  - [ ] Mude valor de corrente
  - [ ] Ctrl+Z volta para posição anterior
  - [ ] Ctrl+Shift+Z volta para posição editada

- [ ] **Adicionar customizado**
  - [ ] Clique "➕ Customizado"
  - [ ] Nome: "Transformador"
  - [ ] Descrição: "10kVA"
  - [ ] Aparece em amarelo no diagrama
  - [ ] Duplo-clique para editar

- [ ] **Validação Final**
  - [ ] Tente salvar com CABO bitola = -5
  - [ ] Sistema bloqueia com erro
  - [ ] Corrija para 10mm²
  - [ ] Agora permite salvar

#### 6.3 Geração de Documento
- [ ] **Exportar para PDF/SVG**
  - [ ] Clique "Baixar Unifilar" ou "Exportar"
  - [ ] PDF mostra diagrama com componentes realistas
  - [ ] DPS aparece na posição correta
  - [ ] Todos os valores são exatos

---

## 🎯 Critérios de Aceite

### Para Phase 2 (Componentes Realistas)
- ✅ Todos os 6 componentes renderizam com SVG realista
- ✅ DPS é obrigatório e validado
- ✅ Customizados podem ser adicionados/editados/deletados
- ✅ Toggle realista/genérico funciona
- ✅ Documento de teste passa 100% dos testes

### Para Phase 4 (Funcionalidades Avançadas)
- ✅ Undo/Redo funciona com Ctrl+Z e Ctrl+Shift+Z
- ✅ Histórico persiste em localStorage
- ✅ Validação de conexões bloqueia inválidas
- ✅ Snap-to-grid alinha componentes automaticamente
- ✅ Validações bloqueantes impedem valores inválidos
- ✅ Componentes obrigatórios não podem ser deletados
- ✅ Documento de teste passa 100% dos testes

### Para Phase 5 (Edição de Edges)
- ✅ Context menu abre ao clicar direito em edge
- ✅ Submenu permite alterar tipo (CA, CC, TERRA)
- ✅ Label de edge mostra tipo atual e cor correspondente
- ✅ Deletar conexão via menu remove edge e nós ficam desconectados
- ✅ Info do edge mostra origem, destino e tipo
- ✅ Undo/Redo funciona para mudança de tipo e deleção
- ✅ Menu responsivo em mobile
- ✅ Documento de teste passa 100% dos testes

---

## 📊 Resultado do Teste

**Data:** _____________
**Testador:** _____________
**Resultado:** ☐ ✅ APROVADO | ☐ ❌ FALHAS

**Falhas encontradas (se houver):**
```
1. ...
2. ...
3. ...
```

**Observações:**
```
...
```

---

**Próximas Fases:**
- Fase 5: Edição de edges (tipo CC/CA/Terra via context menu)
- Fase 6: Grupos/camadas (agrupar componentes)
- Fase 7: Templates (salvar/carregar layouts padrão)
- Fase 8: Comparação de versões (diff visual entre edições)
