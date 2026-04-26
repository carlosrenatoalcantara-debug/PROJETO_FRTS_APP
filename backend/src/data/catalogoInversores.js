// Catálogo de inversores com especificações para engine de string
export const INVERSORES = [
  {
    id: 'fr5', marca: 'Fronius', modelo: 'Primo 5.0-1',
    potenciaKW: 5, vocMax: 1000, mpptMin: 200, mpptMax: 800,
    imaxMppt: 13.5, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 1,
    garantia: 10, precoUnitario: 4200,
  },
  {
    id: 'gw5', marca: 'Growatt', modelo: 'MOD 5000TL3-LV',
    potenciaKW: 5, vocMax: 1000, mpptMin: 70, mpptMax: 850,
    imaxMppt: 16.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 3,
    garantia: 5, precoUnitario: 2800,
  },
  {
    id: 'sg5', marca: 'Sungrow', modelo: 'SG5.0RS',
    potenciaKW: 5, vocMax: 1000, mpptMin: 80, mpptMax: 950,
    imaxMppt: 12.5, nMppts: 2, nStringsTotal: 2,
    tipoInversor: 'string', faseAC: 1,
    garantia: 10, precoUnitario: 3100,
  },
  {
    id: 'dy8', marca: 'Deye', modelo: 'SUN-8K-SG01LP1',
    potenciaKW: 8, vocMax: 1000, mpptMin: 100, mpptMax: 850,
    imaxMppt: 16.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 1,
    garantia: 5, precoUnitario: 5500,
  },
  {
    id: 'sg10', marca: 'Sungrow', modelo: 'SG10RS',
    potenciaKW: 10, vocMax: 1000, mpptMin: 80, mpptMax: 950,
    imaxMppt: 15.0, nMppts: 2, nStringsTotal: 4,
    tipoInversor: 'string', faseAC: 1,
    garantia: 10, precoUnitario: 7800,
  },
  {
    id: 'sg15', marca: 'Sungrow', modelo: 'SG15RT',
    potenciaKW: 15, vocMax: 1000, mpptMin: 200, mpptMax: 950,
    imaxMppt: 22.0, nMppts: 3, nStringsTotal: 6,
    tipoInversor: 'string', faseAC: 3,
    garantia: 10, precoUnitario: 11500,
  },
  {
    id: 'fr20', marca: 'Fronius', modelo: 'Symo 20.0-3-M',
    potenciaKW: 20, vocMax: 1000, mpptMin: 200, mpptMax: 800,
    imaxMppt: 27.0, nMppts: 3, nStringsTotal: 6,
    tipoInversor: 'string', faseAC: 3,
    garantia: 10, precoUnitario: 18000,
  },
  // Microinversores
  {
    id: 'aps400', marca: 'APsystems', modelo: 'EZ1-M 400W',
    potenciaKW: 0.4, vocMax: 60, mpptMin: 16, mpptMax: 55,
    imaxMppt: 10.5, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'micro', faseAC: 1,
    garantia: 10, precoUnitario: 850,
  },
  {
    id: 'enph', marca: 'Enphase', modelo: 'IQ8M',
    potenciaKW: 0.366, vocMax: 60, mpptMin: 16, mpptMax: 55,
    imaxMppt: 14.0, nMppts: 1, nStringsTotal: 1,
    tipoInversor: 'micro', faseAC: 1,
    garantia: 25, precoUnitario: 1100,
  },
]

export function getInversorById(id) {
  return INVERSORES.find(i => i.id === id) ?? null
}
