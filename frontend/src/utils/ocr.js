import Tesseract from 'tesseract.js'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export async function extrairDadosPDF(arquivo) {
  try {
    console.log('📄 Iniciando leitura do PDF:', arquivo.name)

    const arrayBuffer = await arquivo.arrayBuffer()
    console.log('✓ PDF carregado em memória')

    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise
    console.log(`✓ PDF parseado (${pdf.numPages} páginas)`)

    let textoCompleto = ''

    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
      console.log(`Processando página ${i}...`)

      const page = await pdf.getPage(i)
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      const viewport = page.getViewport({ scale: 2 })

      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({ canvasContext: context, viewport }).promise
      console.log(`Página ${i} renderizada, iniciando OCR...`)

      const resultado = await Tesseract.recognize(canvas, 'por')
      const texto = resultado.data.text
      console.log(`OCR página ${i}:`, texto.substring(0, 100))
      textoCompleto += texto + '\n'
    }

    console.log('📝 Texto completo extraído:')
    console.log(textoCompleto)

    const dados = parsearDados(textoCompleto)
    console.log('✓ Dados extraídos:', dados)

    return dados
  } catch (err) {
    console.error('❌ Erro ao processar PDF:', err)
    throw err
  }
}

function parsearDados(texto) {
  const dados = {
    consumo: null,
    tarifa: null,
    valor: null,
  }

  // Procura por padrões comuns em contas de energia
  const regexConsumo = /(\d+)\s*(?:kWh|KWH|kwh)/i
  const regexTarifa = /(?:tarifa|taxa|valor).*?(?:R\$)?\s*([\d,]+)/i
  const regexValor = /(?:total|a pagar).*?(?:R\$)?\s*([\d.]+,[\d]+)/i

  const matchConsumo = texto.match(regexConsumo)
  if (matchConsumo) {
    dados.consumo = parseInt(matchConsumo[1])
  }

  const matchTarifa = texto.match(regexTarifa)
  if (matchTarifa) {
    dados.tarifa = parseFloat(matchTarifa[1].replace(',', '.'))
  }

  const matchValor = texto.match(regexValor)
  if (matchValor) {
    dados.valor = parseFloat(matchValor[1].replace('.', '').replace(',', '.'))
  }

  return dados
}
