# Biblioteca de Símbolos Elétricos — EV + FV

Símbolos padronizados e reutilizáveis para unifilares de projetos Elétrico-Veicular (EV) e Fotovoltaico (FV).

## 📁 Estrutura

```
biblioteca-simbolos-ev-fv/
├── CLEAN/          ← PNGs com valores hardcoded removidos
├── SVG/            ← SVGs escaláveis com imagem embutida (base64)
├── README.md       ← Esta documentação
└── *.py            ← Scripts de processamento
```

## ✅ Símbolos Disponíveis

| Arquivo | Componente | Variações | Status |
|---------|-----------|-----------|--------|
| **1-disjuntor-simbolos.svg** | Disjuntores | Mono, Bi, Tri, Tetra | ✓ Sem valores (customizável) |
| **1-disjuntor-modelo.svg** | Disjuntores (Modelo) | Mono, Bi, Tri, Tetra | ✓ Sem valores (customizável) |
| **2-idr-simbolos.svg** | IDRs | Bi, Tri, Tetra | ✓ Sem valores (customizável) |
| **3-dps-multiplo.svg** | DPS (Proteção Surto) | 1, 2, 3, 4 unidades | ✓ Sem valores (customizável) |
| **4-barramento-acessorios.svg** | Barramento + Acessórios | Ponto, Conector, Parafuso, Barramento Pente, Aterramento, Neutro | ✓ Pronto |
| **5-barramento-bifasico.svg** | Barramento Bifásico (FF) | — | ✓ Pronto |
| **6-barramento-trifasico.svg** | Barramento Trifásico (FFF) | — | ✓ Pronto |
| **7-condutores-simbolos.svg** | Condutores | Neutro 3F, 2F, 1F; Fases; Aterramento; Retornos | ✓ Pronto |

## 🔧 Processamento Realizado

### 1. Limpeza (limpar-vetorizar.py)
- ✓ Removeu valores hardcoded dos disjuntores (10A → em branco)
- ✓ Removeu valores hardcoded dos IDRs (10A, 50mA → em branco)
- ✓ Removeu valores hardcoded do DPS (UC, In, Up → em branco)
- ✓ Copiastrou barramento e condutores (já sem valores)

**Resultado:** PNGs limpos em `CLEAN/`

### 2. Vetorização (criar-svgs-embutidos.py)
- ✓ Converteu cada PNG em SVG com imagem embutida (base64)
- ✓ SVGs são escaláveis (viewBox + dimensões)
- ✓ Sem dependência de ferramentas externas (Potrace, ImageMagick)

**Resultado:** SVGs em `SVG/` prontos para integração

## 🎯 Integração no DiagramEngine (Próximo Passo)

### Uso no Adapter EV
```javascript
// frontend/src/utils/adapterDiagramaEV.js

import disjuntorSvg from '../../../biblioteca-simbolos-ev-fv/SVG/1-disjuntor-simbolos.svg'
import idrSvg from '../../../biblioteca-simbolos-ev-fv/SVG/2-idr-simbolos.svg'
import dpsSvg from '../../../biblioteca-simbolos-ev-fv/SVG/3-dps-multiplo.svg'
// etc.

const SIMBOLOS = {
  'disjuntor-mono': { svg: disjuntorSvg, label: 'Disjuntor Monopolar' },
  'disjuntor-bi': { svg: disjuntorSvg, label: 'Disjuntor Bipolar' },
  'idr-bi': { svg: idrSvg, label: 'IDR Bipolar' },
  'dps-1': { svg: dpsSvg, label: 'DPS (1 unidade)' },
  // ...
}

function desenharComponente(tipo, propriedades) {
  const simbolo = SIMBOLOS[tipo]
  if (!simbolo) return null

  // Renderizar SVG + adicionar label dinâmico
  // Ex: disjuntor + "63A" (de calculos_nbr.disjuntor_a)
  return `
    <g>
      <image href="${simbolo.svg}"/>
      <text x="50" y="100" font-size="12">${propriedades.label}</text>
    </g>
  `
}
```

### Labels Dinâmicos
- **Disjuntores:** valor de `calculos_nbr.disjuntor_a` (ex: "63A", "40A")
- **IDRs:** valor de `calculos_nbr.dr_ma` (ex: "30mA", "100mA")
- **DPS:** valor de `calculos_nbr.dps_kv` (ex: "0.28kV", "0.5kV") + quantidade

## 📝 Notas Técnicas

### Por que SVG com PNG embutido?
- **Escalável:** viewBox permite zoom infinito sem pixelização
- **Reutilizável:** mesmo arquivo em vários tamanhos
- **Independente:** sem dependência de Potrace ou ferramentas externas
- **Pronto:** base64 embutido, nenhuma ref externa

### Customização Futura
Se precisar de SVG 100% vetorial (sem rasterização):
1. Instale Potrace: `choco install potrace` (Windows) ou `brew install potrace` (macOS)
2. Modifique `limpar-vetorizar.py`: descomente a função `vetorizar_com_potrace()`
3. Re-execute: `python limpar-vetorizar.py`

## 📋 Checklist de Uso

- [ ] Copiar pasta `SVG/` para `frontend/src/assets/simbolos-ev-fv/`
- [ ] Importar SVGs no adapter EV (`adapterDiagramaEV.js`)
- [ ] Atualizar `desenharComponente()` para renderizar com símbolos + labels dinâmicos
- [ ] Testar unifilares EV com novo visual
- [ ] Testar unifilares FV (barramento, condutores, disjuntores se aplicável)
- [ ] Validar online (Vercel bundle contém símbolos)

---

**Criado:** 2026-07-02
**Versão:** 1.0
**Status:** Pronto para integração
