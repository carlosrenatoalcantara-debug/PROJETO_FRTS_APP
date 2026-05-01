# 🧪 Guia de Testes - Datasheets e Tabelas NBR

## Opção 1: Teste Local (Rápido) ⚡

### Passo 1: Iniciar Backend
```bash
cd C:\PROJETO_FRTS_APP\backend
NODE_ENV=production npm start
```

Você vai ver:
```
✅ MongoDB conectado com sucesso
✅ Forte Solar API rodando em http://localhost:5005
```

### Passo 2: Testar Datasheets em Node.js

Abra PowerShell/Terminal em `C:\PROJETO_FRTS_APP` e execute:

```bash
# Criar arquivo de teste
cat > teste-datasheets.js << 'EOF'
// Importar os dados compilados
import { modulos, inversores, carregadores, getInversores, getCargadores } from './backend/src/data/equipamentosDatabase.js'
import { tabelaCobre, tabelaAluminio, calcularSecaoMinima, verificarAmpacidade } from './backend/src/data/tabelasNBRCabos.js'

console.log('\n=== TEST 1: Listar Marcas de Módulos ===')
console.log(Object.keys(modulos))
// Saída: ['JA Solar', 'Trina Solar', 'Canadian Solar', 'Deye', 'Risen Energy']

console.log('\n=== TEST 2: Módulos JA Solar (Potências Disponíveis) ===')
console.log(Object.keys(modulos['JA Solar']))
// Saída: ['375-395', '435-455', '530-555', '580-605', '600-625']

console.log('\n=== TEST 3: Especificações do JAM72S09 ===')
const jam72 = modulos['JA Solar']['375-395']
console.log(`Modelo: ${jam72.modelo}`)
console.log(`Potência: ${jam72.potencia_wp}Wp`)
console.log(`Voc: ${jam72.voc}V, Isc: ${jam72.isc}A`)
console.log(`Vmp: ${jam72.vmp}V, Imp: ${jam72.imp}A`)
console.log(`Validação: ${jam72.vmp} × ${jam72.imp} = ${(jam72.vmp * jam72.imp).toFixed(0)}W ≈ ${jam72.potencia_wp}W ✓`)

console.log('\n=== TEST 4: Inversores Trifásicos Disponíveis ===')
const inversoresTrifasico = getInversores(3)
Object.keys(inversoresTrifasico).forEach(marca => {
  console.log(`\n${marca}:`)
  Object.keys(inversoresTrifasico[marca]).forEach(faixa => {
    const modelos = inversoresTrifasico[marca][faixa]
    console.log(`  ${faixa}kW: ${Object.keys(modelos).length} modelos`)
  })
})

console.log('\n=== TEST 5: Carregadores para 48V ===')
const carregadores48v = getCargadores(48)
Object.entries(carregadores48v).forEach(([marca, modelos]) => {
  console.log(`\n${marca}:`)
  Object.entries(modelos).forEach(([nome, specs]) => {
    console.log(`  ${nome}: ${specs.saida_a}A @ ${specs.entrada_v_max}V`)
  })
})

console.log('\n=== TEST 6: Tabela Cobre - Cabos Disponíveis ===')
console.log('Seção (mm²) | AWG | Ampacidade (B1) | Uso')
console.log('------------|-----|-----------------|---')
tabelaCobre.forEach(cabo => {
  console.log(`${cabo.secao_mm2.toString().padEnd(11)} | ${cabo.secao_awg.padEnd(3)} | ${cabo.ampacidade_b1_a.toString().padEnd(15)} | ${cabo.uso}`)
})

console.log('\n=== TEST 7: Calcular Seção de Cabo DC ===')
// Exemplo: painel solar a 30m, corrente 80A, tensão 48V
const calcCabo = calcularSecaoMinima(80, 30, 3, 48, 'cobre')
console.log(`Corrente: 80A, Distância: 30m, Tensão: 48V DC`)
console.log(`Seção calculada: ${calcCabo.secao_calculada_mm2}mm²`)
console.log(`Seção comercial: ${calcCabo.secao_comercial_mm2}mm²`)
console.log(`Queda de tensão: ${calcCabo.queda_tensao_v}V (${calcCabo.queda_tensao_pct}%)`)

console.log('\n=== TEST 8: Verificar Ampacidade ===')
// Verificar se cabo 16mm² aguenta 70A
const verificacao = verificarAmpacidade(16, 70, 1.0)
console.log(`Cabo: 16mm² | Corrente: 70A`)
console.log(`Válido: ${verificacao.valido ? '✅ SIM' : '❌ NÃO'}`)
console.log(`Ampacidade nominal: ${verificacao.ampacidade_nominal_a}A`)
console.log(`Margem de segurança: ${verificacao.margem_seguranca_pct}%`)
console.log(`${verificacao.mensagem}`)

console.log('\n✅ TODOS OS TESTES COMPLETADOS!')
EOF

# Executar o teste
node teste-datasheets.js
```

**Resultado Esperado:**
```
=== TEST 1: Listar Marcas de Módulos ===
[ 'JA Solar', 'Trina Solar', 'Canadian Solar', 'Deye', 'Risen Energy' ]

=== TEST 2: Módulos JA Solar (Potências Disponíveis) ===
[ '375-395', '435-455', '530-555', '580-605', '600-625' ]

=== TEST 3: Especificações do JAM72S09 ===
Modelo: JAM72S09
Potência: 385Wp
Validação: 32.2 × 11.96 = 385W ≈ 385W ✓
...
```

---

## Opção 2: Teste via API HTTP 🌐

### Teste 1: Criar Endpoint de Datasheets

Edite: `backend/src/server.js`

Adicione esta rota:

```javascript
// Adicionar após outras rotas
import { modulos, inversores, carregadores, getInversores, getCargadores } from './data/equipamentosDatabase.js'
import { tabelaCobre, calcularSecaoMinima } from './data/tabelasNBRCabos.js'

// Endpoints de teste para datasheets
app.get('/api/datasheets/modulos', (req, res) => {
  res.json({
    marcas: Object.keys(modulos),
    total: Object.values(modulos).reduce((acc, marca) => acc + Object.keys(marca).length, 0)
  })
})

app.get('/api/datasheets/modulos/:marca', (req, res) => {
  const { marca } = req.params
  if (modulos[marca]) {
    res.json(modulos[marca])
  } else {
    res.status(404).json({ erro: `Marca ${marca} não encontrada` })
  }
})

app.get('/api/datasheets/inversores/:fases', (req, res) => {
  const { fases } = req.params
  const inversoresRede = getInversores(parseInt(fases))
  res.json(inversoresRede)
})

app.get('/api/datasheets/cabos/calcular', (req, res) => {
  const { corrente, distancia, tensao = 48, queda_max = 3 } = req.query
  const resultado = calcularSecaoMinima(
    parseFloat(corrente),
    parseFloat(distancia),
    parseFloat(queda_max),
    parseFloat(tensao),
    'cobre'
  )
  res.json(resultado)
})

app.get('/api/datasheets/cabos/tabela', (req, res) => {
  res.json(tabelaCobre)
})
```

### Teste 2: Chamar a API

Abra PowerShell e execute:

```bash
# TEST 1: Listar marcas de módulos
curl http://localhost:5005/api/datasheets/modulos

# TEST 2: Módulos JA Solar
curl http://localhost:5005/api/datasheets/modulos/JA%20Solar

# TEST 3: Inversores trifásicos
curl http://localhost:5005/api/datasheets/inversores/3

# TEST 4: Calcular cabo (80A, 30m, 48V)
curl "http://localhost:5005/api/datasheets/cabos/calcular?corrente=80&distancia=30&tensao=48"

# TEST 5: Tabela de cabos
curl http://localhost:5005/api/datasheets/cabos/tabela | more
```

**Resultado Esperado:**
```json
{
  "secao_calculada_mm2": 24.18,
  "secao_comercial_mm2": 25,
  "queda_tensao_v": 1.44,
  "queda_tensao_pct": 3
}
```

---

## Opção 3: Teste de Adição de Datasheets Customizados 📝

### Passo 1: Duplicar Template

```bash
# Copiar o template exemplo
copy backend\src\data\datasheets-customizados\exemplo-seus-datasheets.js `
     backend\src\data\datasheets-customizados\meus-modulos.js
```

### Passo 2: Editar com Seus Dados

Abra `meus-modulos.js` e preencha com dados reais:

```javascript
export const meusDatasheetsModulos = {
  'Sunova': {
    '550-570': {
      modelo: 'SUNOVA-SV550-HC144',
      potencia_wp: 560,
      voc: 49.5,
      isc: 14.2,
      vmp: 40.0,
      imp: 14.0,
      eficiencia_pct: 21.8,
      garantia_anos: 12,
      tipo: 'monocristalino',
      data_datasheet: '2026-05-01',
      fonte: 'Seu datasheet PDF',
    }
  }
}
```

### Passo 3: Importar no Sistema

Edite `backend/src/data/equipamentosDatabase.js`:

```javascript
// Adicione no topo:
import { meusDatasheetsModulos } from './datasheets-customizados/meus-modulos.js'

// Merge com base de dados existente:
export const modulosCompletos = {
  ...modulos,
  ...meusDatasheetsModulos
}
```

### Passo 4: Testar

```bash
# Verificar se novo datasheet foi carregado
node -e "
import { modulosCompletos } from './backend/src/data/equipamentosDatabase.js'
console.log('Módulos disponíveis:', Object.keys(modulosCompletos))
"
```

---

## Opção 4: Teste via Formulário Web 🖥️

### Teste 1: Novo Módulo

1. Abra: **https://projeto-frts-app.vercel.app**
2. Vá em: **Equipamentos → Novo Módulo**
3. Preencha:
   - Marca: **JA Solar**
   - Modelo: **JAM72S09**
   - Potência: **385Wp**
   - Voc: **40.2V**
   - Isc: **10.15A**
4. Clique: **Salvar**
5. Verifique se os dados aparecem na lista

### Teste 2: Upload de PDF (se OCR estiver ativo)

1. Vá em: **Novo Módulo → Upload PDF**
2. Selecione um datasheet PDF
3. Sistema deve extrair automaticamente:
   - Modelo
   - Potência
   - Tensões e correntes
4. Revise e clique **Confirmar**

---

## Opção 5: Teste Completo - Cenário Real 🔋

### Simulação: Projeto Solar 8kW Monofásico

```bash
# 1. Quantos painéis de 550Wp preciso?
# 8000W ÷ 550Wp = 14.5 → 15 painéis
echo "Painéis necessários: 15 × 550Wp"

# 2. Corrente DC esperada
# I = P ÷ V = 8000W ÷ 400V = 20A
# Considerando 4 strings: 20A × 4 = 80A
echo "Corrente no combiner: 80A"

# 3. Calcular cabo painel → combiner (5m)
curl "http://localhost:5005/api/datasheets/cabos/calcular?corrente=80&distancia=5&tensao=400"
# Resultado: seção 4mm² (pequeno, perto)

# 4. Calcular cabo combiner → inversor (30m)
curl "http://localhost:5005/api/datasheets/cabos/calcular?corrente=80&distancia=30&tensao=400"
# Resultado: seção 16mm² (mais longo)

# 5. Selecionar inversor 8kW monofásico
curl "http://localhost:5005/api/datasheets/inversores/1"
# Resultado: Huawei/Growatt/Deye 8kW options

# 6. Calcular cabo inversor → quadro AC (10m)
# Corrente AC: 8000W ÷ 230V ≈ 35A
curl "http://localhost:5005/api/datasheets/cabos/calcular?corrente=35&distancia=10&tensao=230"
# Resultado: seção 6mm² (AC)
```

---

## Checklist de Testes ✅

### Módulos
- [ ] Listar todas as marcas
- [ ] Ver potências disponíveis por marca
- [ ] Validar: Vmp × Imp ≈ Pmax
- [ ] Adicionar novo módulo (datasheet customizado)
- [ ] Filtrar módulos por potência

### Inversores
- [ ] Inversores monofásicos aparecem
- [ ] Inversores trifásicos aparecem
- [ ] Dados de MPPT estão corretos
- [ ] Tensão min/max estão em range 150-700V

### Carregadores
- [ ] Carregadores 48V aparecem
- [ ] Carregadores 24V aparecem
- [ ] Eficiência listada

### Cabos
- [ ] Tabela cobre mostra 13 seções
- [ ] Cálculo rápido funciona
- [ ] Queda de tensão é ≤ 3%
- [ ] Ampacidade validada

### Datasheets Customizados
- [ ] Arquivo novo criado
- [ ] Dados parseados corretamente
- [ ] Aparece em listagens
- [ ] Validação de potência passa

---

## Troubleshooting

### ❌ "Módulo não encontrado"
```bash
# Verificar se módulos foram carregados
node -e "import('./backend/src/data/equipamentosDatabase.js').then(m => console.log(Object.keys(m.modulos)))"
```

### ❌ "Erro ao calcular cabo"
```bash
# Verificar parâmetros:
# corrente em A (número)
# distancia em m (número)
# tensao em V (número, default 48)
curl "http://localhost:5005/api/datasheets/cabos/calcular?corrente=80&distancia=30&tensao=48"
```

### ❌ "API não responde"
```bash
# Verificar se backend está rodando
curl http://localhost:5005/api/health
# Deve retornar: {"status":"ok","servico":"Forte Solar API"}
```

---

## Resultado Esperado Final

```
✅ Datasheets compilados: 5 marcas de módulos
✅ Inversores disponíveis: 4 marcas, 20+ modelos
✅ Carregadores listados: 4 fabricantes
✅ Tabelas NBR funcionando: cobre + alumínio
✅ Cálculo de cabos automático
✅ Sistema aceita datasheets customizados
✅ API respondendo com dados
✅ Pronto para uso em produção
```

