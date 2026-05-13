# 🔌 Implementação de Normas Brasileiras em Projetos EV

## Visão Geral

O sistema agora integra automaticamente os cálculos e validações conforme as normas brasileiras de instalação de carregadores de veículos elétricos:

- **ABNT NBR 17019:2022** - Ocupações destinadas a garagens com EV
- **ABNT NBR 5410:2004** - Instalações elétricas de baixa tensão
- **ABNT NBR IEC 61851-1:2021** - Requisitos gerais para recarga
- **ABNT NBR IEC 62196-1/2/3:2021** - Conectores e tomadas
- **ABNT NBR 5419:2026** - Proteção contra descargas atmosféricas
- **Corpo de Bombeiros RN RT-05-2025** - Requisitos regionais

## Arquitetura

### Componentes Principais

```
backend/src/
├── utils/
│   └── calculosCarregadorEV.js    # Funções de cálculo conforme normas
├── models/
│   └── ProjetoEV.js               # Schema com campos de conformidade
├── controllers/
│   └── projetosEVController.js    # Lógica com integração automática
└── routes/
    └── projetosEV.js              # Endpoints com novos recursos
```

### Fluxo de Dados

```
1. Cliente cria/atualiza projeto com dados do carregador
2. Controller recebe requisição
3. Se dados mudam (carregadores, tensão, comprimento):
   - Executa cálculos automáticos (executarCalculosProjetoEV)
   - Valida conformidade com normas
   - Atualiza campos calculos_nbr e conformidade_norms
4. Projeto é salvo com dados completos
5. Frontend recebe projeto com cálculos já realizados
```

## Uso da API

### 1. Criar Projeto EV

```http
POST /api/projetos-ev
Content-Type: application/json

{
  "clienteId": "507f1f77bcf86cd799439011",
  "nome": "Carregador Residencial - Sunset AP",
  "tipo_carregamento": "AC"
}
```

**Resposta:**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "clienteId": "507f1f77bcf86cd799439011",
  "nome": "Carregador Residencial - Sunset AP",
  "status": "rascunho",
  "modo_operacao": 1,
  "normas_aplicadas": [
    "ABNT NBR 17019:2022",
    "ABNT NBR 5410:2004",
    "ABNT NBR IEC 61851-1:2021",
    "ABNT NBR IEC 62196-1/2/3:2021"
  ]
}
```

### 2. Atualizar Projeto com Dados do Carregador

Quando você atualiza com dados do carregador, tensão ou comprimento, os cálculos são executados automaticamente:

```http
PUT /api/projetos-ev/507f1f77bcf86cd799439012
Content-Type: application/json

{
  "carregadores": [{
    "tipo": "AC_Mono",
    "potencia_kw": 7,
    "marca": "WallBox",
    "modelo": "Pulsar Plus",
    "quantidade": 1,
    "tensao_entrada_v": 230,
    "corrente_entrada_a": 16
  }],
  "tensao_sistema": 230,
  "comprimento_cabo_m": 30,
  "modo_operacao": 1,
  "tipo_conector": "IEC 62196-2 (Type 2)",
  "resistencia_aterramento_ohms": 3.5
}
```

**Resposta (com cálculos automáticos):**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "nome": "Carregador Residencial - Sunset AP",
  "carregadores": [{
    "tipo": "AC_Mono",
    "potencia_kw": 7,
    "marca": "WallBox",
    "modelo": "Pulsar Plus",
    "quantidade": 1,
    "tensao_entrada_v": 230,
    "corrente_entrada_a": 16
  }],
  "calculos_nbr": {
    "corrente_projeto_a": 40,
    "corrente_maxima_a": 38.04,
    "bitola_cabo_mm2": 16,
    "disjuntor_a": 50,
    "dr_ma": 30,
    "queda_tensao_pct": 2.6
  },
  "conformidade_norms": {
    "corrente_ok": true,
    "bitola_ok": true,
    "queda_tensao_ok": true,
    "disjuntor_ok": true,
    "dr_ok": true,
    "aterramento_ok": true,
    "spda_necessario": false,
    "conforme": true
  },
  "resistencia_aterramento_ohms": 3.5,
  "resistencia_aterramento_conformidade": "✓ Excelente"
}
```

### 3. Calcular Normas (Endpoint Explícito)

Use este endpoint para obter cálculos detalhados sem salvar ainda:

```http
POST /api/projetos-ev/507f1f77bcf86cd799439012/calcular-normas
Content-Type: application/json

{
  "carregadores": [{
    "tipo": "AC_Tri",
    "potencia_kw": 11,
    "marca": "Tesla",
    "modelo": "Wall Connector",
    "quantidade": 1
  }],
  "tensao_sistema": 400,
  "comprimento_cabo_m": 50,
  "resistencia_aterramento_ohms": 5.5
}
```

**Resposta (sem salvar):**
```json
{
  "calculos_nbr": {
    "corrente_projeto_a": 40,
    "corrente_maxima_a": 38.04,
    "bitola_cabo_mm2": 16,
    "disjuntor_a": 50,
    "dr_ma": 30,
    "queda_tensao_pct": 2.1
  },
  "conformidade_norms": {
    "corrente_ok": true,
    "bitola_ok": true,
    "queda_tensao_ok": true,
    "disjuntor_ok": true,
    "dr_ok": true,
    "aterramento_ok": true,
    "spda_necessario": false,
    "conforme": true
  },
  "detalhes": {
    "corrente": {
      "corrente_calculada": 38.04,
      "corrente_comercial": 40,
      "fator_seguranca": 1.25,
      "unidade": "A",
      "norma": "NBR 5410:2004"
    },
    "bitola": {
      "bitola_mm2": 16,
      "bitola_calculada": 10,
      "queda_tensao_real": 2.1,
      "queda_tensao_max": 3,
      "queda_tensao_ok": true,
      "norma": "NBR 5410:2004"
    },
    "disjuntor": {
      "disjuntor_a": 50,
      "disjuntor_max_permitido": 52,
      "curva_recomendada": "C",
      "tipo": "Disjuntor 50A Curva C",
      "norma": "NBR 5410:2004"
    },
    "dr": {
      "corrente_fuga_max_ma": 30,
      "tipo_recomendado": "Tipo AC",
      "tipos_disponiveis": ["Tipo AC", "Tipo A", "Tipo B"],
      "norma": "NBR IEC 61851-1:2021"
    },
    "aterramento": {
      "resistencia_medida": 5.5,
      "max_permitida": 10,
      "recomendada": 5,
      "conforme": true,
      "conforme_recomendado": true,
      "status": "⚠ Aceitável (considere melhorar)",
      "unidade": "Ω",
      "norma": "NBR 5410:2004"
    }
  }
}
```

## Campos do Schema ProjetoEV

### Novos Campos Adicionados

#### Carregador (Expandido)
```javascript
carregadores: [{
  tipo: String,              // AC_Mono, AC_Tri, DC
  potencia_kw: Number,
  marca: String,
  modelo: String,
  quantidade: Number,
  tensao_entrada_v: Number,  // NOVO
  corrente_entrada_a: Number // NOVO
}]

tipo_carregamento: String,   // NOVO - AC, DC, Misto
```

#### Modo de Operação
```javascript
modo_operacao: Number,       // NOVO - 1, 2, 3, ou 4
tipo_conector: String        // NOVO - IEC 62196-2, Tesla, CCS, CHAdeMO
```

#### Aterramento e Proteção
```javascript
resistencia_aterramento_ohms: Number,              // NOVO
resistencia_aterramento_conformidade: String       // NOVO - Status
```

#### Normas e Conformidade
```javascript
normas_aplicadas: [String],  // NOVO - Array com normas
conformidade_norms: {        // NOVO - Validação de conformidade
  corrente_ok: Boolean,
  bitola_ok: Boolean,
  queda_tensao_ok: Boolean,
  disjuntor_ok: Boolean,
  dr_ok: Boolean,
  aterramento_ok: Boolean,
  spda_necessario: Boolean,
  conforme: Boolean          // Todos os requisitos atendidos
}
```

## Funções Disponíveis em calculosCarregadorEV.js

### Cálculos Principais

#### 1. `calcularCorrenteProjetoNBR5410(potencia_kw, tensao_v)`
Calcula a corrente de projeto conforme NBR 5410 com fator de segurança 1.25.

```javascript
const resultado = calcularCorrenteProjetoNBR5410(7, 230)
// {
//   corrente_calculada: 38.04,
//   corrente_comercial: 40,
//   fator_seguranca: 1.25,
//   unidade: 'A',
//   norma: 'NBR 5410:2004'
// }
```

#### 2. `calcularBitolaNBR5410(corrente_a, comprimento_m, queda_tensao_max, tensao_v)`
Calcula bitola do condutor considerando queda de tensão máxima de 3%.

```javascript
const resultado = calcularBitolaNBR5410(40, 30, 3, 230)
// {
//   bitola_mm2: 16,
//   queda_tensao_real: 2.6,
//   queda_tensao_ok: true,
//   norma: 'NBR 5410:2004'
// }
```

#### 3. `calcularDisjuntorNBR5410(corrente_a)`
Calcula disjuntor recomendado (máximo 1.3× corrente de projeto).

```javascript
const resultado = calcularDisjuntorNBR5410(40)
// {
//   disjuntor_a: 50,
//   curva_recomendada: 'C',
//   tipo: 'Disjuntor 50A Curva C',
//   norma: 'NBR 5410:2004'
// }
```

#### 4. `obterEspecificacaoDRNBREIEC618511()`
Retorna especificação do DR (sempre 30mA conforme norma).

```javascript
const dr = obterEspecificacaoDRNBREIEC618511()
// {
//   corrente_fuga_max_ma: 30,
//   tipo_recomendado: 'Tipo AC',
//   norma: 'NBR IEC 61851-1:2021'
// }
```

#### 5. `validarAteramentoNBR5410(resistencia_medida_ohms)`
Valida resistência de aterramento (máx 10Ω, ideal <5Ω).

```javascript
const resultado = validarAteramentoNBR5410(3.5)
// {
//   resistencia_medida: 3.5,
//   max_permitida: 10,
//   recomendada: 5,
//   conforme: true,
//   status: '✓ Excelente',
//   norma: 'NBR 5410:2004'
// }
```

#### 6. `obterModoOperacao(modo)`
Retorna especificações do modo de operação (1-4).

```javascript
const modo = obterModoOperacao(3)
// {
//   nome: 'Recarga Dedicada com Wall Box',
//   tensao: '230V ou 400V (trifásico)',
//   corrente_max: 32,
//   tipo_conector: 'IEC 62196-2 (Type 2)',
//   aplicacao: 'Garagens, estacionamentos, condomínios (6-8h)',
//   modo: 3,
//   norma: 'NBR IEC 61851-1:2021'
// }
```

#### 7. `obterEspecificacaoConector(tipo_conector)`
Retorna especificações técnicas do conector.

```javascript
const conector = obterEspecificacaoConector('IEC 62196-2 (Type 2)')
// {
//   nome: 'IEC 62196-2 (Mennekes Type 2)',
//   corrente_max_a: 32,
//   tensao_max_v: 400,
//   fase: 'Monofásico ou Trifásico',
//   uso: 'Padrão europeu para Modo 3',
//   norma: 'ABNT NBR IEC 62196-2:2021'
// }
```

### Função Principal

#### `executarCalculosProjetoEV(dados)`
Executa todos os cálculos automaticamente baseado nos dados do projeto.

```javascript
const dados = {
  carregadores: [{
    potencia_kw: 7,
    tensao_entrada_v: 230
  }],
  tensao_sistema: 230,
  comprimento_cabo_m: 30,
  resistencia_aterramento_ohms: 3.5
}

const resultado = executarCalculosProjetoEV(dados)
// {
//   calculos_nbr: { ... },
//   conformidade_norms: { ... },
//   detalhes: { ... }
// }
```

## Fluxo de Integração Frontend

### 1. Ao Criar um Novo Projeto

```javascript
// Frontend: Cria projeto básico
const response = await fetch('/api/projetos-ev', {
  method: 'POST',
  body: JSON.stringify({
    clienteId: client._id,
    nome: 'Novo Projeto'
  })
})
```

### 2. Ao Preencher Dados do Carregador

```javascript
// Frontend: Simula cálculos ANTES de salvar
const simularCalculos = async (dados) => {
  const response = await fetch(
    `/api/projetos-ev/${projetoId}/calcular-normas`,
    {
      method: 'POST',
      body: JSON.stringify(dados)
    }
  )
  const resultado = await response.json()
  
  // Mostra para o usuário:
  // - Corrente calculada
  // - Bitola recomendada
  // - Disjuntor
  // - Conformidade com normas
  console.log('Cálculos:', resultado.calculos_nbr)
  console.log('Conforme?', resultado.conformidade_norms.conforme)
}
```

### 3. Ao Salvar Projeto

```javascript
// Frontend: Salva projeto (cálculos são feitos automaticamente)
const response = await fetch(`/api/projetos-ev/${projetoId}`, {
  method: 'PUT',
  body: JSON.stringify({
    carregadores: [{
      tipo: 'AC_Mono',
      potencia_kw: 7,
      // ... outros dados
    }],
    tensao_sistema: 230,
    comprimento_cabo_m: 30,
    resistencia_aterramento_ohms: 3.5
    // ... outros campos
  })
})

const projeto = await response.json()

// Projeto retorna com:
console.log(projeto.calculos_nbr)          // Cálculos automáticos
console.log(projeto.conformidade_norms)    // Validação de conformidade
```

## Validações Automáticas

Quando um projeto é atualizado, o sistema automaticamente:

1. ✅ Calcula corrente de projeto (NBR 5410)
2. ✅ Determina bitola do condutor (considerando queda ≤ 3%)
3. ✅ Dimensiona disjuntor (1.3× corrente)
4. ✅ Define DR em 30mA (obrigatório)
5. ✅ Valida aterramento (≤ 10Ω)
6. ✅ Gera checklist de conformidade
7. ✅ Define se SPDA é necessário (baseado em localização)

## Status de Conformidade

O campo `conformidade_norms.conforme` é `true` quando:

- ✓ Bitola permite queda ≤ 3%
- ✓ Aterramento ≤ 10Ω (ou não informado)
- ✓ Todos os componentes de proteção estão definidos

## Exemplos de Projeto Completo

### Exemplo 1: Residência com Carregador 7kW (Modo 1)

```json
{
  "_id": "507f1f77bcf86cd799439012",
  "nome": "Carregador Residencial - Sunset AP",
  "clienteId": { "_id": "507f1f77bcf86cd799439011", "nome": "Forte Solar" },
  "carregadores": [{
    "tipo": "AC_Mono",
    "potencia_kw": 7,
    "marca": "WallBox",
    "modelo": "Pulsar Plus",
    "quantidade": 1,
    "tensao_entrada_v": 230,
    "corrente_entrada_a": 16
  }],
  "modo_operacao": 1,
  "tipo_conector": "IEC 62196-2 (Type 2)",
  "tensao_sistema": 230,
  "fases": 1,
  "comprimento_cabo_m": 30,
  "resistencia_aterramento_ohms": 3.5,
  "calculos_nbr": {
    "corrente_projeto_a": 40,
    "bitola_cabo_mm2": 16,
    "disjuntor_a": 50,
    "dr_ma": 30,
    "queda_tensao_pct": 2.6
  },
  "conformidade_norms": {
    "corrente_ok": true,
    "bitola_ok": true,
    "queda_tensao_ok": true,
    "disjuntor_ok": true,
    "dr_ok": true,
    "aterramento_ok": true,
    "conforme": true
  }
}
```

## Mensagens de Conformidade

- **"✓ Excelente"** - Aterramento < 5Ω
- **"⚠ Aceitável"** - Aterramento 5-10Ω
- **"✗ Não conforme"** - Aterramento > 10Ω

## Próximos Passos

1. ✅ Backend com cálculos automáticos
2. ⏳ Frontend: Atualizar formulário para mostrar cálculos em tempo real
3. ⏳ Frontend: Validação visual antes de salvar
4. ⏳ PDF: Incluir detalhes de conformidade no diagrama unifilar
5. ⏳ Relatório: Gerar relatório de conformidade para cliente

## Suporte e Troubleshooting

### Cálculos não aparecem na resposta

**Causa:** Projeto não tem carregadores definidos.  
**Solução:** Forneça array `carregadores` com `potencia_kw`.

### Erro "Nenhum carregador definido"

**Solução:** Adicione ao mínimo:
```json
{
  "carregadores": [{
    "potencia_kw": 7
  }]
}
```

### Conformidade retorna false

Verifique:
- Queda de tensão > 3%? → Aumentar bitola
- Aterramento > 10Ω? → Melhorar eletrodos de aterramento

---

**Última Atualização:** 2026-05-13  
**Normas Implementadas:** ABNT NBR 17019:2022, NBR 5410:2004, IEC 61851-1:2021
