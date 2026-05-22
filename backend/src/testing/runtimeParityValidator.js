// backend/src/testing/runtimeParityValidator.js
//
// Forensic-grade parity validator.
// Ensures strict electrical calculation consistency across runtimes.
// Acts as the final check-valve in the CI governance pipeline.

export function validateRuntimeParity(reports) {
  // Governance requirement: Parity validation requires comparison of >= 2 runtimes.
  if (!Array.isArray(reports) || reports.length < 2) {
    throw new Error('RUNTIME_PARITY_INSUFFICIENT_REPORTS: Parity validation requires >= 2 reports to compare.')
  }

  const validatedRuntimes = []

  // Structural pre-validation: Ensures all reports are valid DTOs before comparison
  for (const report of reports) {
    if (
      !report ||
      typeof report !== 'object' ||
      !report.hashes ||
      typeof report.hashes !== 'object' ||
      Array.isArray(report.hashes)
    ) {
      throw new Error('RUNTIME_PARITY_INVALID_STRUCTURE: Report missing required hashes object.')
    }
    if (typeof report.nodeVersion === 'string' && report.nodeVersion.trim() !== '') {
      validatedRuntimes.push(report.nodeVersion)
    }
  }

  const firstReport = reports[0]
  const fixtureIds  = Object.keys(firstReport.hashes).sort()

  // Cross-runtime comparison loop
  for (let i = 1; i < reports.length; i++) {
    const currentReport    = reports[i]
    const currentFixtureIds = Object.keys(currentReport.hashes).sort()

    // 1. Structural Drift Check (Fixture Count)
    if (fixtureIds.length !== currentFixtureIds.length) {
      throw new Error(
        `RUNTIME_PARITY_FIXTURE_DRIFT: Count mismatch at report index ${i}.`
      )
    }

    // 2. Identity Mismatch Check (Fixture ID order and value)
    for (let j = 0; j < fixtureIds.length; j++) {
      if (fixtureIds[j] !== currentFixtureIds[j]) {
        throw new Error(
          `RUNTIME_PARITY_FIXTURE_DRIFT: ID mismatch at report index ${i}: ` +
          `expected "${fixtureIds[j]}", found "${currentFixtureIds[j]}".`
        )
      }
    }

    // 3. Forensic Hash Parity Check (Type and Value)
    for (const id of fixtureIds) {
      const h1 = firstReport.hashes[id]
      const h2 = currentReport.hashes[id]

      if (typeof h1 !== 'string' || typeof h2 !== 'string') {
        throw new Error(
          `RUNTIME_PARITY_INVALID_HASH_TYPE: Non-string hash found at report index ${i}, fixture ${id}.`
        )
      }

      if (h1 !== h2) {
        throw new Error(
          `RUNTIME_PARITY_HASH_MISMATCH: Divergence detected at report index ${i}, fixture ${id}.`
        )
      }
    }
  }

  // Return immutable governance payload
  return Object.freeze({
    valid:              true,
    runtimesChecked:    Object.freeze([...new Set(validatedRuntimes)]),
    fixturesValidated:  Object.freeze(fixtureIds)
  })
}
