# 🚀 Teste Rápido - 5 Minutos

## 1️⃣ Rodar Teste Automatizado

```bash
cd C:\PROJETO_FRTS_APP
node teste-datasheets.js
```

**Resultado Esperado:**
```
✅ Testes passados: 20/20 (100.0%)
🎉 TODOS OS TESTES PASSARAM! Sistema pronto para usar.
```

---

## 2️⃣ Testar no Navegador (Vercel)

### A. Verificar Frontend
```
Acesse: https://projeto-frts-app.vercel.app
Deve carregar normalmente (layout, cores, botões)
```

### B. Formulário de Novo Módulo
1. Clique em: **Equipamentos → Novo Módulo**
2. Preencha com dados compilados:
   - Marca: **JA Solar**
   - Modelo: **JAM72S09**
   - Potência: **385Wp**
   - Voc: **40.2V**
   - Isc: **10.15A**
   - Vmp: **32.2V**
   - Imp: **11.96A**
3. Clique: **Salvar**
4. Deve confirmar com **✅ Módulo salvo com sucesso**

### C. Formulário de Novo Inversor
1. Clique em: **Equipamentos → Novo Inversor**
2. Selecione dados compilados:
   - Marca: **Huawei**
   - Potência: **8kW**
   - Modelo: **SUN2000-8KTL-M1**
   - Fases: **3 (Trifásico)**
   - Tensão Mín: **200V**
   - Tensão Máx: **600V**
3. Clique: **Salvar**

---

## 3️⃣ Testar API Localmente

### Terminal 1: Iniciar Backend
```bash
cd C:\PROJETO_FRTS_APP\backend
NODE_ENV=production npm start
```

### Terminal 2: Fazer Requisições

```bash
# TEST 1: Listar marcas de módulos
curl http://localhost:5005/api/datasheets/modulos
# Resultado: {"marcas":["JA Solar","Trina Solar",...], "total":11}

# TEST 2: Ver módulos JA Solar
curl "http://localhost:5005/api/datasheets/modulos/JA%20Solar"
# Resultado: {"375-395":{"modelo":"JAM72S09",...},"435-455":{...}}

# TEST 3: Inversores trifásicos
curl http://localhost:5005/api/datasheets/inversores/3
# Resultado: {"Huawei":{...},"Growatt":{...},...}

# TEST 4: Calcular cabo DC (80A, 30m, 48V)
curl "http://localhost:5005/api/datasheets/cabos/calcular?corrente=80&distancia=30&tensao=48"
# Resultado: {"secao_calculada_mm2":24.18,"secao_comercial_mm2":25}

# TEST 5: Tabela de cabos
curl http://localhost:5005/api/datasheets/cabos/tabela
# Resultado: [{"secao_mm2":1,"ampacidade_b1_a":15,...},...13 cabos]
```

---

## 4️⃣ Testar Adição de Datasheet Customizado

### Opção A: Rápida (5 minutos)

```bash
# 1. Copiar template
copy backend\src\data\datasheets-customizados\exemplo-seus-datasheets.js `
     backend\src\data\datasheets-customizados\meu-modulo.js

# 2. Editar arquivo (abrir em VS Code)
code backend\src\data\datasheets-customizados\meu-modulo.js

# 3. Mudar exemplo para seu datasheet:
# Procure por 'Sua Marca' e mude para uma marca real
# Exemplo: 'Sunova' → busque especificações do fabricante

# 4. Reiniciar backend (Ctrl+C, depois npm start)
# 5. Verificar: curl http://localhost:5005/api/datasheets/modulos
#    Deve aparecer sua marca nova
```

### Opção B: Usando PDF (automático)

```bash
# 1. Abrir: https://projeto-frts-app.vercel.app
# 2. Ir em: Equipamentos → Novo Módulo → "Upload PDF"
# 3. Selecionar datasheet PDF
# 4. Sistema extrai automaticamente
# 5. Clicar "Confirmar"
```

---

## 5️⃣ Teste Completo - Simulação Real

**Cenário: Projeto Solar 10kW Trifásico**

### Etapa 1: Selecionar Painéis
```bash
# Usar módulo de 550Wp
curl "http://localhost:5005/api/datasheets/modulos/JA%20Solar"
# → Escolher: "580-605" = JAM78S30 (590Wp)
```

### Etapa 2: Calcular Quantidade
```
10000W ÷ 590Wp = 16.95 → 17 painéis necessários
```

### Etapa 3: Calcular Corrente DC
```bash
# Arranjo: 4 strings × 4 painéis em série
# Por string: 590Wp ÷ 41.6V = 14.16A
# Corrente total no combiner: 14.16A × 4 strings = 56.6A → ~60A
```

### Etapa 4: Dimensionar Cabo DC
```bash
# Painel → Combiner (5m)
curl "http://localhost:5005/api/datasheets/cabos/calcular?corrente=60&distancia=5&tensao=400"
# Resultado: seção 4mm² (perto)

# Combiner → Inversor (30m)
curl "http://localhost:5005/api/datasheets/cabos/calcular?corrente=60&distancia=30&tensao=400"
# Resultado: seção 10mm² (recomendado) ou 16mm² (seguro)
```

### Etapa 5: Selecionar Inversor
```bash
# Buscar inversor trifásico 10kW
curl http://localhost:5005/api/datasheets/inversores/3
# → Escolher: Huawei/Growatt/Deye 10kW
# Especificações esperadas: 2-3 MPPT, 150-700V entrada
```

### Etapa 6: Dimensionar Cabo AC
```bash
# Corrente AC: 10000W ÷ (230V × √3) ≈ 25A
curl "http://localhost:5005/api/datasheets/cabos/calcular?corrente=25&distancia=10&tensao=230"
# Resultado: seção 2.5-4mm² (AC)
```

### Resultado Final
```
✅ 17 painéis × 590Wp = 10.03kW
✅ Cabo DC: 16mm² (50A de margem)
✅ Inversor: Huawei 10kW (3 fases)
✅ Cabo AC: 4mm² (suficiente)
✅ Projeto validado!
```

---

## Checklist Rápido

- [ ] Teste automatizado passou (20/20)
- [ ] Frontend carrega
- [ ] Formulário novo módulo funciona
- [ ] Formulário novo inversor funciona
- [ ] API /datasheets/modulos responde
- [ ] API /datasheets/inversores responde
- [ ] API /datasheets/cabos/calcular funciona
- [ ] Cálculo de cabo retorna seção válida
- [ ] Consegui adicionar novo datasheet
- [ ] Projeto exemplo foi validado

---

## ✅ Resultado Esperado

Se você fez tudo acima e deu certo:

```
✅ Datasheets compilados e funcionando
✅ Tabelas NBR carregadas
✅ Cálculos de cabo automáticos
✅ API respondendo dados corretos
✅ Frontend integrando com datasheets
✅ Sistema pronto para produção!
```

---

## 🔗 Links Úteis

- **Frontend**: https://projeto-frts-app.vercel.app
- **Backend API**: https://projetofrtsapp-production.up.railway.app/api/health
- **Documentação**: COMPILACAO_DATASHEETS.md
- **Como Adicionar**: ADICIONAR_DATASHEETS.md
- **Guia Completo**: GUIA_TESTES_DATASHEETS.md

---

**⏱️ Tempo Total**: ~5-10 minutos

Se tudo passou ✅ → **Sistema está pronto para usar em produção!**

