/**
 * gerarUnifilarSVG.js — FV-DOM-007B.
 *
 * A GERAÇÃO do diagrama saiu daqui: vive em
 * `packages/fv-shared/engenharia/unifilarSVG.js` e é servida pelo domínio em
 * `POST /api/projetos-fv/:id/unifilar/gerar`.
 *
 * O que sobrou são as duas funções de ENTREGA — download e conversão para PNG —
 * que dependem de DOM (Blob, canvas) e por isso não pertencem ao domínio.
 *
 * `gerarUnifilarSVG` continua exportado como re-export para o wizard legado não
 * quebrar. Ele executa o MESMO código que o servidor: um arquivo, uma verdade.
 * A nova UX não deve importá-lo — deve consumir a API.
 */
export { gerarUnifilarSVG } from '@fortesolar/fv-shared/engenharia/unifilar-svg'

export const baixarUnifilarSVG = (svg, projeto = 'unifilar') => {
  const nome = `unifilar_${projeto}_${new Date().toISOString().split('T')[0]}.svg`
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const link = document.createElement('a')
  link.href   = URL.createObjectURL(blob)
  link.download = nome
  link.click()
  URL.revokeObjectURL(link.href)
}

export const converterSVGparaPNG = async (svgString) => {
  return new Promise((resolve) => {
    const img  = new Image()
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.width  || 1460
      canvas.height = img.height || 950
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(resolve, 'image/png')
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}
