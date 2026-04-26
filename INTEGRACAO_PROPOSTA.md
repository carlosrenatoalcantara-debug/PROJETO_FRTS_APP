# 🔗 GUIA DE INTEGRAÇÃO - SISTEMA AUTOMATIZADO

## ✅ CHECKLIST DE INTEGRAÇÃO NO `NovaProposta.jsx`

### **Etapa 1: Localização + Mapa**
```javascript
// Ao selecionar localização e calcular irradiância
const irradiancia = 5.77 // via NASA POWER API

// Passar para próxima etapa
context.setEtapaAtual(1.5)
```

---

### **Etapa 2: Unidades Consumidoras (UC)**
```javascript
// Seleção de UC com histórico
const consumoMensal = 350 // extraído da fatura

// Calcular automaticamente
import { calcularDimensionamentoAuto } from '@/services/calcAutoMatico'
const resultado = calcularDimensionamentoAuto(consumoMensal, irradiancia)

// Armazenar em context
context.setDimensionamento(resultado)
context.setEtapaAtual(2)
```

---

### **Etapa 2.5: Beneficiárias**
```javascript
// Beneficiários com rateio simplificado
// Modelo de dados:
{
  contaContrato: "123456789",
  tipoRateio: "Percentual", // ou "Prioridade"
  valor: 30 // % ou ordem
}

// Soma consumo total
const consumoTotal = consumoPrincipal * (1 + beneficiarias.map(b => b.valor).reduce())

// Redimensionar para TOTAL
const dimensionamentoFinal = calcularDimensionamentoAuto(consumoTotal, irradiancia)
```

---

### **Etapa 3: Kit Gerador (AUTOMÁTICO)**
```javascript
import SeletorAutomaticoKits from '@/components/fv/SeletorAutomaticoKits'

// Renderizar componente
<SeletorAutomaticoKits 
  potenciakWp={dimensionamento.potenciaArredondada}
  onSelecionarKit={(dados) => {
    context.setKitSelecionado(dados.kit)
    context.setOrcamento(dados.orcamento)
    context.setEtapaAtual(4)
  }}
/>
```

---

### **Etapa 4: Pré-Dimensionamento**
```javascript
// Exibir dados do dimensionamento automatizado
// - Consumo diário
// - Potência ideal
// - Número de painéis
// - Número de inversores
// - Configuração de strings
```

---

### **Etapa 5: Irradiância**
```javascript
// Exibir valor já calculado (NASA POWER API)
// Permitir ajuste manual
// Recalcular dimensionamento se alterado

const novaIrradiancia = 5.85
const novoDimensionamento = calcularDimensionamentoAuto(consumoTotal, novaIrradiancia)
```

---

### **Etapa 6: Dimensionamento Final**
```javascript
// Gerar diagrama automático
import { gerarUnifilarSVG, baixarUnifilarSVG } from '@/utils/gerarUnifilarSVG'

const svg = gerarUnifilarSVG({
  numPaineis: dimensionamento.numPaineis,
  numInversores: dimensionamento.numInversores,
  numStrings: dimensionamento.numStrings,
  potenciakWp: dimensionamento.potenciaArredondada,
})

// Permitir download
<button onClick={() => baixarUnifilarSVG(svg, 'unifilar.svg')}>
  📥 Baixar Unifilar
</button>
```

---

### **Etapa 7: Equipamentos Complementares**
```javascript
// Selecionar:
// - Estrutura (telhado, solo, poste)
// - Cabos (bitola automática via tabela)
// - Proteções (DPS, fusível, AC breaker)
// - Painel AC
// - Quadro de distribuição

// Cálculo automático de bitola:
const bitolaCaboCC = calcularBitolaCabo(numStrings, amperage)
```

---

### **Etapa 8: Orçamento Detalhado (AUTOMÁTICO)**
```javascript
import { gerarOrcamentoAuto, gerarPropostaPDF } from '@/services/calcAutoMatico'

// Gerar orçamento
const orcamento = gerarOrcamentoAuto(kitSelecionado, {
  margemLucro: 20,           // slider 10-30%
  precoMaoDObra: 50,         // R$ por painel
  percentualMateriais: 15,   // % do kit
  percentualProjeto: 5,      // % do kit
  percentualImpostos: 8,     // % do kit
})

// Gerar proposta PDF
const htmlProposta = gerarPropostaPDF({
  cliente: clienteData,
  sistema: {
    potenciakWp: dimensionamento.potenciaArredondada,
    numPaineis: dimensionamento.numPaineis,
    numInversores: dimensionamento.numInversores,
    economiaAnual: dimensionamento.economiaAnual,
    payback: dimensionamento.payback,
  },
  orcamento: orcamento,
  empresa: empresaData,
})

// Ações
<button onClick={() => abrirOuBaixarProposta(htmlProposta)}>
  📄 Abrir/Imprimir Proposta
</button>
```

---

## 📊 FLUXO COMPLETO DE CONTEXTO

```javascript
// ProjetoFVContext state shape
{
  // Etapa 1
  localizacao: { lat, lng, endereco },
  irradiancia: 5.77,
  
  // Etapa 2
  unidadeConsumidora: {
    numero: "...",
    endereco: "...",
    consumoMensal: 350,
    distribuidora: "COSERN",
  },
  
  // Etapa 2.5
  beneficiarias: [
    { contaContrato: "...", tipoRateio: "Percentual", valor: 30 },
  ],
  
  // Etapa 3
  dimensionamento: {
    potenciaArredondada: 15,
    numPaineis: 68,
    numInversores: 1,
    numStrings: 4,
    economiaAnual: 128700,
    payback: "8.5",
  },
  
  kitSelecionado: { nome, tag, precoTotal, paineis, inversor },
  
  // Etapa 4-5 (informativo)
  // (dados já em dimensionamento)
  
  // Etapa 6
  unifilar: "<svg>...", // SVG gerado
  
  // Etapa 7
  equipamentosComplementares: {
    estrutura: "telhado",
    cabos: { cc: "4mm²", ac: "6mm²" },
    protecoes: { dps: true, fusivel: true },
  },
  
  // Etapa 8
  orcamento: {
    itens: [...],
    subtotal: 150000,
    margem: { percentual: 20, valor: 30000 },
    total: 180000,
    precoWp: 12.0,
  },
  
  htmlProposta: "<html>...",
}
```

---

## 🚀 EXEMPLO DE FLUXO RÁPIDO

### Cenário: Proposta em 5 minutos
```javascript
// 1. Cliente seleciona UC com consumo 350 kWh/mês
// 2. Sistema calcula dimensionamento automático
// 3. 3 opções de kit aparecem (Econômico, Balanceado, Premium)
// 4. Seleciona "Balanceado"
// 5. Unifilar gerado automaticamente
// 6. Orçamento preenchido com margem padrão
// 7. Clica "Gerar Proposta" → PDF abre em nova aba
// 8. Clica "Imprimir como PDF" no navegador
// ✅ Proposta pronta em 5 minutos!
```

---

## 📝 CAMPOS OPCIONAIS DO USUÁRIO

| Etapa | Campo | Obrigatório | Auto? |
|-------|-------|------------|-------|
| 1 | Localização (Mapa) | Sim | Não |
| 1 | Irradiância | Não | Sim (NASA API) |
| 2 | UC (consumo) | Sim | Sim (PDF) |
| 2 | Distribuidora | Não | Sim (PDF) |
| 2.5 | Beneficiários | Não | Não |
| 3 | Kit | Sim | Sim (3 opções) |
| 6 | Estrutura | Não | Sim (padrão: telhado) |
| 6 | Cabos | Não | Sim (tabela IEC) |
| 8 | Margem lucro | Não | Sim (20% padrão) |

---

## 🔄 VALIDAÇÕES IMPORTANTES

```javascript
// Validar beneficiários
if (beneficiarias.length > 0) {
  const somaPorcentuais = beneficiarias
    .filter(b => b.tipoRateio === "Percentual")
    .reduce((sum, b) => sum + b.valor, 0)
  
  if (somaPorcentuais > 100) {
    throw new Error("Soma de percentuais não pode exceder 100%")
  }
}

// Validar dimensionamento
if (numInversores > numStrings) {
  throw new Error("Número de inversores não pode exceder strings")
}

// Validar tensão DC
const tensaoDC = painelVoc * (numPaineis / numStrings)
if (tensaoDC > 600) {
  throw new Error("Tensão DC excede 600V - aumentar número de strings")
}
```

---

## 🎯 PRÓXIMOS PASSOS DE INTEGRAÇÃO

1. ✅ Criar arquivos de serviço (calcAutoMatico.js)
2. ✅ Criar utilitários (gerarUnifilarSVG.js, gerarPropostaPDF.js)
3. ✅ Criar componente SeletorAutomaticoKits
4. ⏳ Integrar em NovaProposta.jsx (Etapas 1-8)
5. ⏳ Testar fluxo completo end-to-end
6. ⏳ Conectar API NASA POWER (Etapa 1)
7. ⏳ Implementar homologação auto-preenchida (Etapa 8)

---

**Status:** Serviços e utilitários prontos. Aguardando integração em NovaProposta.jsx
