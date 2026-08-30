/**
 * polyfills.cjs — polyfills de DOM para `pdfjs-dist`, carregados ANTES de tudo.
 *
 * FV-INFRA-059. O `server.js` já traz este mesmo bloco no topo do arquivo, mas
 * em ESM os `import` são içados: todo o grafo de módulos é avaliado ANTES da
 * primeira linha do corpo. A cadeia
 *
 *   server.js → routes/projetosFV.js → projetosFVController → equipamentosController → pdfjs-dist
 *
 * é estática, então `pdfjs-dist` executa `new DOMMatrix()` antes de o polyfill
 * existir. No deploy de QA isso derrubou o processo com
 * `ReferenceError: DOMMatrix is not defined`.
 *
 * Como CommonJS pré-carregado (`node --require ./src/polyfills.cjs`), este
 * arquivo roda antes de qualquer módulo ESM — que é o único momento em que o
 * polyfill chega a tempo.
 *
 * O bloco em `server.js` permanece intocado: é inofensivo (os `if` não
 * sobrescrevem o que já existe) e continua servindo quem inicia sem o preload.
 */

/**
 * Web Crypto global.
 *
 * O Node 18 só expõe `globalThis.crypto` sob `--experimental-global-webcrypto`;
 * a partir do 19 ele vem por padrão. A imagem do Dockerfile é `node:18-alpine`,
 * e o driver do MongoDB usa `crypto` na autenticação SCRAM — no deploy de QA a
 * conexão falhava com `crypto is not defined`, logo depois de a whitelist do
 * Atlas passar a aceitar o Railway.
 *
 * `webcrypto` do módulo nativo é a mesma implementação que o Node 19+ publica
 * como global: não é um substituto aproximado.
 */
if (!globalThis.crypto) {
  globalThis.crypto = require('node:crypto').webcrypto
}

if (!globalThis.DOMMatrix) {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() { this.a = this.b = this.c = this.f = 0; this.d = this.e = 1 }
    multiply() { return this }
    inverse() { return this }
    transformPoint() { return { x: 0, y: 0 } }
  }
}

if (!globalThis.ImageData) {
  globalThis.ImageData = class ImageData {
    constructor(data, width, height) { this.data = data; this.width = width; this.height = height }
  }
}

if (!globalThis.Path2D) {
  globalThis.Path2D = class Path2D {
    constructor() {}
    addPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    rect() {}
  }
}

if (!globalThis.HTMLCanvasElement) {
  globalThis.HTMLCanvasElement = class HTMLCanvasElement {
    getContext() { return {} }
    toDataURL() { return '' }
  }
}

if (!globalThis.HTMLImageElement) {
  globalThis.HTMLImageElement = class HTMLImageElement {
    constructor() { this.src = ''; this.width = this.height = 0 }
  }
}

if (!globalThis.CanvasRenderingContext2D) {
  globalThis.CanvasRenderingContext2D = class CanvasRenderingContext2D {
    fillRect() {}
    clearRect() {}
    fillText() {}
    drawImage() {}
    createImageData() { return new globalThis.ImageData([], 0, 0) }
    getImageData() { return new globalThis.ImageData([], 0, 0) }
    stroke() {}
    fill() {}
    beginPath() {}
    closePath() {}
    clip() {}
  }
}
