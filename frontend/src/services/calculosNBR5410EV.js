// Cálculos segundo NBR 5410 para instalações de carregadores EV

/**
 * Calcula todos os parâmetros elétricos de uma instalação EV.
 *
 * SELEÇÃO DO DISJUNTOR (NBR 5410 — Ib ≤ In ≤ Iz):
 *  - Prioridade 1: corrente_nominal_a (informada pelo fabricante no catálogo)
 *  - Prioridade 2: corrente_projeto_a (calculada pela potência quando catálogo
 *                  não informa corrente_entrada_a)
 *  - Critério: menor valor comercial normalizado >= Ib
 *  - O fator 125% (carga contínua) aplica-se EXCLUSIVAMENTE ao dimensionamento
 *    dos condutores (Iz), nunca à seleção do disjuntor.
 *
 * CONDUTORES:
 *  A bitola é selecionada para suportar In × 1,25 (carga contínua) corrigida
 *  por temperatura. A queda de tensão é verificada sobre corrente_projeto_a.
 */
export function calcularParametrosNBR5410({
  potencia_kw,
  tensao_entrada_v,
  numero_fases,
  comprimento_cabo_m,
  tipo_carregador,
  corrente_nominal_a,   // corrente do fabricante (catálogo) — prioridade para disjuntor
  incluir_mob_box = false,
  tipo_conector,
}) {
  const potencia_w = potencia_kw * 1000

  // BUG-017: corrente de PROJETO (Ib) = corrente nominal do CATÁLOGO quando informada
  // (é a corrente real de entrada AC do carregador). Só quando ausente derivamos da
  // potência: Ib = P / (V · √3(tri) · fp). Antes usava-se sempre P/(V·fp0,95), o que
  // inflava a corrente ACIMA da nominal do catálogo → corrente_projeto > disjuntor.
  const fator_potencia = 0.95
  const fator_raiz3 = Number(numero_fases) === 3 ? Math.sqrt(3) : 1
  const corrente_calculada_a = potencia_w / (tensao_entrada_v * fator_raiz3 * fator_potencia)
  const corrente_projeto_a = corrente_nominal_a ? Number(corrente_nominal_a) : corrente_calculada_a

  // In_cabo: corrente de dimensionamento dos condutores
  // NBR 5410 9.5.1.1 — carga contínua (>3h): fator 1,25
  const fator_carga_continua = 1.25
  const corrente_maxima_a = corrente_projeto_a * fator_carga_continua

  // Tabela de bitolas — cobre 70°C, instalação em eletroduto (NBR 5410 Tab.36)
  const tabelaCobre = [
    { bitola: 1.5,  capacidade_a: 15.5 },
    { bitola: 2.5,  capacidade_a: 21   },
    { bitola: 4,    capacidade_a: 28   },
    { bitola: 6,    capacidade_a: 36   },
    { bitola: 10,   capacidade_a: 50   },
    { bitola: 16,   capacidade_a: 68   },
    { bitola: 25,   capacidade_a: 89   },
    { bitola: 35,   capacidade_a: 109  },
    { bitola: 50,   capacidade_a: 134  },
    { bitola: 70,   capacidade_a: 170  },
    { bitola: 95,   capacidade_a: 207  },
    { bitola: 120,  capacidade_a: 239  },
    { bitola: 150,  capacidade_a: 272  },
    { bitola: 185,  capacidade_a: 309  },
    { bitola: 240,  capacidade_a: 360  },
  ]

  // Fator de correção temperatura 40°C (NBR 5410 Tab.36)
  const fator_temperatura = 0.95
  const corrente_corrigida_a = corrente_maxima_a / fator_temperatura

  // Iz >= corrente_corrigida_a: seleciona bitola mínima adequada
  let bitola_cabo_mm2 = 2.5
  for (const cabo of tabelaCobre) {
    if (cabo.capacidade_a >= corrente_corrigida_a) {
      bitola_cabo_mm2 = cabo.bitola
      break
    }
  }

  // Verificação da queda de tensão (ΔU = ρ × L × I / S)
  // ρ cobre 70°C = 0,0179 Ω·mm²/m · limite NBR 5410: 3% circuito terminal
  const resistividade = 0.0179
  let queda_tensao_v = (resistividade * comprimento_cabo_m * corrente_projeto_a) / bitola_cabo_mm2
  let queda_tensao_pct = (queda_tensao_v / tensao_entrada_v) * 100

  // Se queda > 3%, aumentar bitola até atender o limite
  if (queda_tensao_pct > 3) {
    for (const cabo of tabelaCobre) {
      const qt = (resistividade * comprimento_cabo_m * corrente_projeto_a) / cabo.bitola
      if ((qt / tensao_entrada_v) * 100 <= 3) {
        bitola_cabo_mm2 = cabo.bitola
        queda_tensao_v = (resistividade * comprimento_cabo_m * corrente_projeto_a) / bitola_cabo_mm2
        queda_tensao_pct = (queda_tensao_v / tensao_entrada_v) * 100
        break
      }
    }
  }

  // ── SELEÇÃO DO DISJUNTOR ─────────────────────────────────────────────────
  // Ib = corrente de projeto (= nominal do catálogo, ou calculada).
  // Critério: menor disjuntor comercial >= Ib (NBR 5410: Ib ≤ In ≤ Iz)
  const Ib = corrente_projeto_a
  const disjuntores_normalizados = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200]
  let disjuntor_a = disjuntores_normalizados[disjuntores_normalizados.length - 1]
  for (const dj of disjuntores_normalizados) {
    if (dj >= Ib) {
      disjuntor_a = dj
      break
    }
  }

  // Capacidade do cabo selecionado (Iz) para verificação Ib ≤ In ≤ Iz
  const capacidade_cabo_a = tabelaCobre.find(c => c.bitola === bitola_cabo_mm2)?.capacidade_a || 0

  // DR: 30 mA para todos os circuitos EV (NBR 5410 obrigatório — áreas úmidas/externas)
  const dr_ma = 30

  // DPS Tipo 2 (Classe II): tensão conforme sistema
  const dps_kv = Number(tensao_entrada_v) >= 380 ? 420 : 275

  // Tempo de seccionamento automático
  let tempo_seccionamento_s = 0.2
  if (tensao_entrada_v <= 120) tempo_seccionamento_s = 0.4
  if (tensao_entrada_v <= 50)  tempo_seccionamento_s = 5

  return {
    corrente_projeto_a:  parseFloat(corrente_projeto_a.toFixed(2)),
    corrente_maxima_a:   parseFloat(corrente_maxima_a.toFixed(2)),
    Ib_disjuntor:        parseFloat(Ib.toFixed(2)),
    bitola_cabo_mm2,
    capacidade_cabo_a,
    disjuntor_a,
    dr_ma,
    dps_kv,
    dps_capacidade_a:    Math.round(Ib + 20),   // BUG-017: completa o calc (evita recálculo no GET)
    queda_tensao_pct:    parseFloat(queda_tensao_pct.toFixed(2)),
    tempo_seccionamento_s,
    materiais: gerarListaMateriais({ potencia_kw, tipo_carregador, numero_fases, bitola_mm2: bitola_cabo_mm2, disjuntor_a, dr_ma, dps_kv, comprimento_m: comprimento_cabo_m, incluir_mob_box, tipo_conector }),
  }
}

// EV-BUGFIX-02: delegado para o helper puro em utils/bomMateriaisEV.js
import { gerarBOM as _gerarBOM } from '../utils/bomMateriaisEV'

function gerarListaMateriais(args) {
  return _gerarBOM(args)
}

// Validar se a instalação atende NBR 5410
export function validarNBR5410(calculos) {
  const erros = []
  const avisos = []

  if (calculos.queda_tensao_pct > 3) {
    erros.push(`Queda de tensão (${calculos.queda_tensao_pct}%) excede 3% permitido pela NBR 5410`)
  }

  if (calculos.tempo_seccionamento_s > 0.5) {
    avisos.push(`Tempo de seccionamento (${calculos.tempo_seccionamento_s}s) próximo ao limite`)
  }

  // Verificação Ib ≤ In ≤ Iz
  if (calculos.disjuntor_a > calculos.capacidade_cabo_a) {
    erros.push(`Disjuntor (${calculos.disjuntor_a}A) excede capacidade do cabo (${calculos.capacidade_cabo_a}A) — violação NBR 5410 In ≤ Iz`)
  }

  return { valido: erros.length === 0, erros, avisos }
}
