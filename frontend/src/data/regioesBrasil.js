// Dados regionais do Brasil: concessionárias, tensão padrão e irradiância de fallback
// Irradiância: média anual kWh/m²/dia (fonte: CRESESB/INPE - Atlas Brasileiro de Energia Solar)
// Tensão: padrão residencial predominante por estado (em migração conforme ANEEL)

export const REGIOES = {
  AC: { nome: 'Acre',               uf: 'AC', tensao: '127/220', tensaoTri: '220/380', irradiancia: 4.8, concessionarias: ['Energisa Acre']                           },
  AL: { nome: 'Alagoas',            uf: 'AL', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.5, concessionarias: ['Equatorial Alagoas']                      },
  AP: { nome: 'Amapá',              uf: 'AP', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.4, concessionarias: ['CEA (Equatorial)']                        },
  AM: { nome: 'Amazonas',           uf: 'AM', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.1, concessionarias: ['Amazonas Energia']                        },
  BA: { nome: 'Bahia',              uf: 'BA', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.8, concessionarias: ['Neoenergia Coelba', 'Energisa Bahia']     },
  CE: { nome: 'Ceará',              uf: 'CE', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.9, concessionarias: ['ENEL Ceará']                              },
  DF: { nome: 'Distrito Federal',   uf: 'DF', tensao: '220/380', tensaoTri: '220/380', irradiancia: 5.5, concessionarias: ['Neoenergia Brasília (CEB)']               },
  ES: { nome: 'Espírito Santo',     uf: 'ES', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.2, concessionarias: ['EDP Espírito Santo']                     },
  GO: { nome: 'Goiás',              uf: 'GO', tensao: '220/380', tensaoTri: '220/380', irradiancia: 5.5, concessionarias: ['ENEL Goiás (CELG-D)']                    },
  MA: { nome: 'Maranhão',           uf: 'MA', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.7, concessionarias: ['Equatorial Maranhão']                    },
  MT: { nome: 'Mato Grosso',        uf: 'MT', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.4, concessionarias: ['Energisa Mato Grosso']                   },
  MS: { nome: 'Mato Grosso do Sul', uf: 'MS', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.3, concessionarias: ['Energisa Mato Grosso do Sul']            },
  MG: { nome: 'Minas Gerais',       uf: 'MG', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.4, concessionarias: ['CEMIG Distribuição']                     },
  PA: { nome: 'Pará',               uf: 'PA', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.6, concessionarias: ['Equatorial Pará']                        },
  PB: { nome: 'Paraíba',            uf: 'PB', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.7, concessionarias: ['Energisa Paraíba']                       },
  PR: { nome: 'Paraná',             uf: 'PR', tensao: '220/380', tensaoTri: '220/380', irradiancia: 4.7, concessionarias: ['COPEL Distribuição']                     },
  PE: { nome: 'Pernambuco',         uf: 'PE', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.7, concessionarias: ['Neoenergia Pernambuco (CELPE)']          },
  PI: { nome: 'Piauí',              uf: 'PI', tensao: '127/220', tensaoTri: '220/380', irradiancia: 6.0, concessionarias: ['Equatorial Piauí']                       },
  RJ: { nome: 'Rio de Janeiro',     uf: 'RJ', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.1, concessionarias: ['ENEL Rio', 'Light']                      },
  RN: { nome: 'Rio Grande do Norte',uf: 'RN', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.9, concessionarias: ['Neoenergia Cosern']                      },
  RS: { nome: 'Rio Grande do Sul',  uf: 'RS', tensao: '127/220', tensaoTri: '220/380', irradiancia: 4.6, concessionarias: ['CEEE-D (Equatorial)', 'RGE', 'Energisa RS']},
  RO: { nome: 'Rondônia',           uf: 'RO', tensao: '127/220', tensaoTri: '220/380', irradiancia: 4.9, concessionarias: ['Energisa Rondônia']                      },
  RR: { nome: 'Roraima',            uf: 'RR', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.2, concessionarias: ['Roraima Energia (CEAL)']                 },
  SC: { nome: 'Santa Catarina',     uf: 'SC', tensao: '220/380', tensaoTri: '220/380', irradiancia: 4.5, concessionarias: ['CELESC Distribuição']                    },
  SP: { nome: 'São Paulo',          uf: 'SP', tensao: '127/220', tensaoTri: '220/380', irradiancia: 4.9, concessionarias: ['ENEL São Paulo', 'CPFL Paulista', 'Elektro', 'CPFL Piratininga', 'Energisa Sul-Sudeste'] },
  SE: { nome: 'Sergipe',            uf: 'SE', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.3, concessionarias: ['Energisa Sergipe']                       },
  TO: { nome: 'Tocantins',          uf: 'TO', tensao: '127/220', tensaoTri: '220/380', irradiancia: 5.7, concessionarias: ['Energisa Tocantins']                     },
}

export const UFS_ORDENADAS = Object.values(REGIOES)
  .sort((a, b) => a.nome.localeCompare(b.nome))
  .map(r => ({ valor: r.uf, rotulo: `${r.uf} - ${r.nome}` }))

export function getRegiao(uf) {
  return REGIOES[uf] ?? REGIOES.SP
}

export function getConcessionariasPorUF(uf) {
  return (REGIOES[uf]?.concessionarias ?? []).map(c => ({ valor: c, rotulo: c }))
}

// Detecta UF a partir de texto de endereço (retorno Nominatim)
export function detectarUF(enderecoFormatado) {
  const texto = enderecoFormatado?.toUpperCase() ?? ''
  const entrada = Object.entries(REGIOES)
  for (const [uf, dados] of entrada) {
    if (texto.includes(`, ${uf},`) || texto.includes(` ${uf} `) ||
        texto.includes(dados.nome.toUpperCase())) {
      return uf
    }
  }
  return null
}
