/**
 * etiquetaParser.js — P1-COMMISSIONING-SCAN-01
 * Extrai campos de comissionamento (serial/MAC/SSID/senha) de texto cru vindo de:
 *   - QR/Datamatrix da etiqueta (texto decodificado), OU
 *   - OCR (tesseract) de uma foto da etiqueta.
 * Puro/sem efeitos colaterais — fácil de testar. NÃO toca DB.
 */

// MAC: 6 pares hex separados por : ou -  (ou 12 hex contínuos)
const RE_MAC = /\b(?:[0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}\b/
const RE_MAC12 = /\b[0-9A-Fa-f]{12}\b/

// valor após um rótulo (ROTULO: valor | ROTULO valor | ROTULO=valor)
function aposRotulo(texto, rotulos) {
  for (const r of rotulos) {
    const re = new RegExp(`(?:${r})\\s*[:=#]?\\s*([A-Za-z0-9_\\-./]{4,40})`, 'i')
    const m = texto.match(re)
    if (m && m[1]) return m[1].replace(/[.,;]+$/, '')
  }
  return null
}

// Normaliza MAC para AA:BB:CC:DD:EE:FF
function normMac(s) {
  if (!s) return null
  let h = s.replace(/[^0-9A-Fa-f]/g, '').toUpperCase()
  if (h.length !== 12) return s.toUpperCase().replace(/-/g, ':')
  return h.match(/.{2}/g).join(':')
}

/**
 * @param {string} textoRaw  texto do QR ou OCR
 * @param {object} hint      { fabricante }  (opcional, refina heurísticas)
 * @returns {{campos:object, confianca:object, texto_normalizado:string}}
 */
export function parseEtiqueta(textoRaw, hint = {}) {
  const texto = String(textoRaw || '').replace(/ /g, ' ')
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const campos = {}
  const confianca = {}

  // ── Formatos estruturados (QR costuma trazer k:v ou k=v;…) ──────────────────
  // ex.: "SN:2305210123;SSID:AP_2305;PWD:12345678"  ou JSON
  let estruturado = null
  try { if (texto.trim().startsWith('{')) estruturado = JSON.parse(texto) } catch { /* não-JSON */ }
  if (!estruturado && /[:=]/.test(texto) && /[;,\n]/.test(texto)) {
    estruturado = {}
    for (const par of texto.split(/[;,\n]/)) {
      const m = par.match(/^\s*([A-Za-z_ ]{2,20})\s*[:=]\s*(.+?)\s*$/)
      if (m) estruturado[m[1].trim().toUpperCase().replace(/\s+/g, '')] = m[2].trim()
    }
    if (Object.keys(estruturado).length === 0) estruturado = null
  }
  const fromEstrut = (chaves) => {
    if (!estruturado) return null
    for (const k of Object.keys(estruturado)) {
      const ku = k.toUpperCase()
      if (chaves.some(c => ku === c || ku.includes(c))) return String(estruturado[k]).trim()
    }
    return null
  }

  // ── MAC ──────────────────────────────────────────────────────────────────
  const macRaw = fromEstrut(['MAC']) || texto.match(RE_MAC)?.[0]
    || (aposRotulo(texto, ['MAC']) || '').match(RE_MAC12)?.[0]
  if (macRaw) { campos.mac_address = normMac(macRaw); confianca.mac_address = 0.95 }

  // ── Número de série ─────────────────────────────────────────────────────────
  const sn = fromEstrut(['SN', 'SERIAL', 'SERIALNUMBER', 'SERIALNO', 'NSERIE'])
    || aposRotulo(texto, ['S\\/?N', 'SERIAL\\s*(?:N[ºo.]?|NUMBER)?', 'N[ºo°]?\\s*S[ÉE]RIE'])
  if (sn) { campos.numero_serie = sn; confianca.numero_serie = 0.85 }
  else if (linhas.length === 1 && /^[A-Za-z0-9][A-Za-z0-9\-]{7,29}$/.test(linhas[0]) && !RE_MAC.test(linhas[0])) {
    // QR "puro": o conteúdo é o próprio serial (token alfanumérico longo)
    campos.numero_serie = linhas[0]; confianca.numero_serie = 0.7
  }

  // ── SSID Wi-Fi ──────────────────────────────────────────────────────────────
  const ssid = fromEstrut(['SSID', 'WIFINAME', 'APNAME', 'WLAN'])
    || aposRotulo(texto, ['SSID', 'WIFI\\s*NAME', 'AP\\s*NAME', 'WLAN', 'WIFI'])
    || texto.toUpperCase().match(/\bAP[_-][A-Z0-9]{4,}\b/)?.[0]
  if (ssid) { campos.wifi_ssid = ssid; confianca.wifi_ssid = ssid.toUpperCase().startsWith('AP') ? 0.8 : 0.75 }

  // ── Senha Wi-Fi ───────────────────────────────────────────────────────────────
  const senha = fromEstrut(['PWD', 'PASSWORD', 'SENHA', 'WIFIKEY', 'KEY', 'PASS'])
    || aposRotulo(texto, ['PWD', 'PASSWORD', 'SENHA', 'WIFI\\s*KEY', 'PASS(?:WORD)?', 'KEY'])
  if (senha) { campos.wifi_senha = senha; confianca.wifi_senha = 0.8 }

  return { campos, confianca, texto_normalizado: linhas.join('\n') }
}
