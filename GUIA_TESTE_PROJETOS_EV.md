# 🧪 GUIA DE TESTE - Projetos EV

## Como Validar que Todas as Correções Funcionam

---

## ✅ Teste 1: Criar e Salvar Novo Projeto

### Pré-requisitos
- ✅ Sistema rodando (Frontend + Backend)
- ✅ Cliente criado no CRM
- ✅ Pelo menos 1 carregador EV cadastrado

### Passo a Passo

**Etapa 1: Iniciar Novo Projeto**
```
1. Clique em "Novo Projeto EV" (botão azul com +)
   └─ Deve abrir página "Nova Proposta EV"

2. Preencha os dados:
   Nome do Projeto:  "Teste Garagem 22kW"
   Nome do Cliente:  "João Silva" (ou nome de cliente existente)
   Endereço:         "Rua das Flores, 123, São Paulo"
   Técnico:          "Carlos Renato"
   CREA:             "SP 123456/D"

3. Clique "Próxima →"
   ✅ Deve avançar para Etapa 2 (Carregadores)
```

**Etapa 2: Selecionar Carregador**
```
1. Clique "+ Adicionar Carregador"

2. Selecione um carregador:
   - INTELBRAS EVE 0074B (22 kW, AC, Trifásico)
   - Quantidade: 1

3. Clique "Adicionar"
   ✅ Deve aparecer na lista de carregadores selecionados

4. Clique "Próxima →"
   ✅ Deve avançar para Etapa 3 (Cálculos)
```

**Etapa 3: Calcular Parâmetros NBR 5410**
```
1. Clique "Calcular Parâmetros NBR 5410"
   ✅ Deve aparecer cálculos:
      - Corrente de Projeto
      - Corrente Máxima
      - Bitola do Cabo (mm²)
      - Disjuntor (A)
      - DR (mA)
      - Queda Tensão (%)

2. Materiais necessários devem listar:
   - Cabos
   - Disjuntores
   - DRs
   - Etc.

3. Clique "Próxima →"
   ✅ Deve avançar para Etapa 4 (Unifilar)
```

**Etapa 4: Gerar Unifilar**
```
1. Clique "Gerar Unifilar"
   ✅ Deve aparecer diagrama SVG do sistema EV com:
      - Rede Elétrica
      - Disjuntor
      - DR
      - Cabo
      - Carregador EV
      - Nome do técnico responsável

2. Botões disponíveis:
   - "Download" (com ícone de seta para baixo)
   - "Salvar Projeto"
```

---

## ✅ Teste 2: Download do Diagrama Unifilar

### Procedimento
```
1. Na Etapa 4 (com Unifilar gerado), clique no botão "Download"

2. Seu navegador deve baixar arquivo:
   Nome: Unifilar_Teste Garagem 22kW.svg
   Tipo: SVG (Scalable Vector Graphics)

3. Abra o arquivo SVG:
   - Duplo clique para abrir no navegador
   - Ou abra com programa gráfica (Inkscape, Illustrator, etc)
   ✅ Deve mostrar diagrama técnico

4. Propriedades do arquivo:
   ✅ Escalonável sem perder qualidade
   ✅ Pode ser editado em editores SVG
   ✅ Menor tamanho que PNG
```

---

## ✅ Teste 3: Salvar Projeto no Banco

### Procedimento
```
1. Na Etapa 4 (com Unifilar gerado), clique "Salvar Projeto"

2. Feedback esperado:
   ✅ Alert com mensagem: "✅ Projeto salvo com sucesso!"

3. Redirecionamento:
   ✅ Deve ser redirecionado para /projetos-ev
   ✅ Página deve carregar lista de projetos

4. Tempo esperado:
   ⏱️ ~2-3 segundos para salvar
   ⏱️ ~1 segundo para redirecionar
```

---

## ✅ Teste 4: Verificar Projeto na Lista

### Procedimento
```
1. Após salvar, deve estar em página /projetos-ev

2. Procure o projeto na tabela:
   Coluna "Projeto": "Teste Garagem 22kW"
   Coluna "Cliente": "João Silva"
   Coluna "Pontos": 1
   Coluna "Potência": 22 kW
   Coluna "Status": "Dimensionado"

3. Clique botão "Ver" ao lado do projeto
   ✅ Deve abrir página com detalhes do projeto salvo

4. Dados visíveis devem incluir:
   ✅ Nome do projeto
   ✅ Cliente
   ✅ Endereço
   ✅ Carregador selecionado
   ✅ Cálculos NBR
   ✅ Técnico responsável
```

---

## ✅ Teste 5: Criar Múltiplos Projetos

### Procedimento (Validar que Todos Aparecem)
```
1. Repita Teste 1-3 com dados diferentes:
   Projeto 2: "Frota Costa 88kW"
   Cliente: "Marcia Costa"
   Carregador: INTELBRAS EVE 0110C (4 unidades)

2. Repita Teste 1-3 novamente:
   Projeto 3: "Estacionamento BD 44kW"
   Cliente: "Banco Dados SA"
   Carregador: SOLPLANET SOL7.4H (6 unidades)

3. Volte a /projetos-ev
   ✅ Devem aparecer 3 projetos na tabela
   ✅ Total de pontos deve ser: 1 + 4 + 6 = 11

4. Filtrar por cliente:
   ✅ Clique em "Filtros"
   ✅ Selecione cliente "Marcia Costa"
   ✅ Deve mostrar apenas projeto 2
```

---

## 🔍 Testes de Erro (Validar Tratamento)

### Teste 6: Validação de Campos Obrigatórios
```
1. Clique "Novo Projeto EV"

2. Deixe campos em branco:
   ✅ Botão "Próxima" deve ficar desabilitado (cinza)

3. Preencha apenas "Nome do Projeto"
   ✅ Botão continua desabilitado

4. Preencha todos os campos
   ✅ Botão fica habilitado (azul)
```

### Teste 7: Sem Carregador Selecionado
```
1. Etapa 2, clique "Próxima" sem selecionar carregador
   ✅ Deve mostrar aviso ou manter na mesma etapa
```

### Teste 8: Salvar Sem Gerar Unifilar
```
1. Etapa 4, clique "Salvar Projeto" sem gerar unifilar
   ✅ Botão deve estar desabilitado (cinza)
```

---

## 📊 Checklist de Validação

- [ ] Teste 1: Criar projeto passo a passo
- [ ] Teste 2: Download SVG funciona
- [ ] Teste 3: Salvar no banco funciona
- [ ] Teste 4: Projeto aparece na lista
- [ ] Teste 5: Múltiplos projetos funcionam
- [ ] Teste 6: Validações de campos funcionam
- [ ] Teste 7: Validação de carregador funciona
- [ ] Teste 8: Botão desabilitado sem unifilar

---

## 🆘 Troubleshooting

### Problema: "Erro ao salvar projeto"
**Solução**: 
1. Verifique se o clienteId é válido
2. Abra console do navegador (F12)
3. Procure por erro na aba "Network"
4. Verifique logs do backend

### Problema: "Download não funciona"
**Solução**:
1. Tente em outro navegador (Chrome, Firefox, Safari)
2. Verifique se pop-ups estão bloqueados
3. Abra console (F12) e procure por erros

### Problema: "Projeto não aparece na lista"
**Solução**:
1. Recarregue a página (F5)
2. Verifique se o projeto foi realmente salvo
3. Abra /api/projetos-ev para ver JSON direto
4. Verifique logs do backend

### Problema: "Botão Salvar fica desabilitado"
**Solução**:
1. Certifique-se de gerar o unifilar
2. Botão só fica habilitado com unifilar gerado

---

## ✅ Resultado Esperado

Após todos os testes, você deve ter:
- ✅ 3 projetos salvos no banco
- ✅ 3 diagramas unifilar baixados
- ✅ Total de 11 pontos de carga
- ✅ Todos os cálculos NBR salvos
- ✅ Sistema funcionando 100%

---

## 📝 Tempo Estimado
- Teste 1-4 (um projeto): ~5 minutos
- Teste 5 (três projetos): ~12 minutos
- Testes 6-8 (validações): ~5 minutos
- **Total: ~20 minutos**

---

**Após completar este guia, o sistema estará totalmente validado!** ✅

Para dúvidas, consulte:
- `CORRECOES_PROJETOS_EV.md` - Detalhes técnicos
- `RESUMO_CORRECOES_FINAIS.txt` - Resumo visual

---

_Guia de teste criado em: 2026-05-12_
