// backend/src/testing/snapshotSerializer.js
//
// Deterministic snapshot serializer for governance regression testing.
// Strips transient metadata fields, canonically sorts object keys,
// and preserves array order to produce a stable, comparable payload.

const TRANSIENT_FIELDS = new Set([
  'timestamp',
  'traceId',
  'parentTraceId',
  'engineModule',
  'stack',
  'hash'
])

function sanitize(value) {
  if (value === null || value === undefined) return value

  if (Array.isArray(value)) {
    return value.map(sanitize)
  }

  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value)
    const isPlain = proto === null || proto === Object.prototype
    if (!isPlain) return value

    const result = {}
    for (const key of Object.keys(value).sort()) {
      if (TRANSIENT_FIELDS.has(key)) continue
      result[key] = sanitize(value[key])
    }
    return result
  }

  return value
}

/**
 * Serializes a payload to a deterministic JSON string.
 * Transient fields are stripped. Object keys are sorted canonically.
 * Array order is preserved.
 *
 * @param {*} payload
 * @returns {string}
 */
export function serialize(payload) {
  return JSON.stringify(sanitize(payload))
}
