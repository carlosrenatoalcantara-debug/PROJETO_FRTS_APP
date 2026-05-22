// backend/src/utils/freeze.js

const MAX_FREEZE_NODES = 50000

function isPlainObjectOrArray(value) {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return true
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

function _deepFreezeSafeInternal(obj, visited, state) {
  if (obj === null || typeof obj !== 'object') return obj
  if (visited.has(obj)) return obj

  state.count++
  if (state.count > MAX_FREEZE_NODES) return Object.freeze(obj)

  visited.add(obj)

  if (isPlainObjectOrArray(obj)) {
    const propNames = Reflect.ownKeys(obj)
    for (const name of propNames) {
      const value = obj[name]
      if (value !== null && typeof value === 'object') {
        _deepFreezeSafeInternal(value, visited, state)
      }
    }
  }

  return Object.freeze(obj)
}

export function deepFreezeSafe(obj) {
  return _deepFreezeSafeInternal(obj, new WeakSet(), { count: 0 })
}
