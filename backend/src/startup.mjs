#!/usr/bin/env node

// 🔧 POLYFILL PRELOAD — MUST run BEFORE any other imports
// This wrapper ensures DOM API polyfills are set in the global scope
// BEFORE the module dependency graph is resolved

if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix {
    constructor(transform) {
      this.a = 1
      this.b = 0
      this.c = 0
      this.d = 1
      this.e = 0
      this.f = 0
    }
    multiply() { return this }
    inverse() { return this }
    transformPoint() { return { x: 0, y: 0 } }
    translate() { return this }
    scale() { return this }
    rotate() { return this }
    skewX() { return this }
    skewY() { return this }
    flipX() { return this }
    flipY() { return this }
  }
}

if (typeof global.ImageData === 'undefined') {
  global.ImageData = class ImageData {
    constructor(data, width, height) {
      this.data = data
      this.width = width
      this.height = height
    }
  }
}

if (typeof global.Path2D === 'undefined') {
  global.Path2D = class Path2D {
    constructor(path) {}
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

if (typeof global.HTMLCanvasElement === 'undefined') {
  global.HTMLCanvasElement = class HTMLCanvasElement {
    getContext() { return {} }
    toDataURL() { return '' }
  }
}

if (typeof global.HTMLImageElement === 'undefined') {
  global.HTMLImageElement = class HTMLImageElement {
    constructor() {
      this.src = ''
      this.width = 0
      this.height = 0
    }
  }
}

if (typeof global.CanvasRenderingContext2D === 'undefined') {
  global.CanvasRenderingContext2D = class CanvasRenderingContext2D {
    fillRect() {}
    clearRect() {}
    fillText() {}
    drawImage() {}
    createImageData() { return new global.ImageData([], 0, 0) }
    getImageData() { return new global.ImageData([], 0, 0) }
    putImageData() {}
    stroke() {}
    fill() {}
    beginPath() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
    clip() {}
    fillStyle = '#000000'
    strokeStyle = '#000000'
    lineWidth = 1
    font = ''
    textAlign = 'start'
    textBaseline = 'alphabetic'
    globalAlpha = 1
  }
}

if (typeof global.HTMLDivElement === 'undefined') {
  global.HTMLDivElement = class HTMLDivElement {}
}

// ✅ Polyfills ready. Now import and run the actual server.
// Using dynamic import ensures all polyfills are in place before server code executes
await import('./server.js')
