// backend/src/testing/goldenSuiteRunner.js

import fs   from 'fs'
import path from 'path'
import { RegressionManager } from './regressionManager.js'

export class GoldenSuiteRunner {
  static run(options = {}) {
    const fixtureDir = options.fixtureDir || path.join(process.cwd(), 'tests/fixtures/golden')
    const files      = fs.readdirSync(fixtureDir).sort()

    const summary = { total: 0, passed: 0, failed: 0, hashes: {}, exitCode: 0, failures: [] }

    for (const file of files) {
      if (!file.endsWith('.json')) continue

      summary.total++

      let fixture
      try {
        fixture = JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf-8'))
        this._validateFixtureShape(fixture)
      } catch (err) {
        summary.failed++
        summary.exitCode = 1
        summary.failures.push({ id: file, code: 'INVALID_FIXTURE', message: err.message })
        console.error(`[FAIL] ${file} - INVALID: ${err.message}`)
        if (options.stopOnFirstFailure) break
        continue
      }

      try {
        const result = RegressionManager.run(fixture)
        // Hash recorded for both pass and fail — forensic baseline and audit integrity
        summary.hashes[fixture.fixture_id] = result.hash

        if (result.passed) {
          summary.passed++
          console.log(`[PASS] ${fixture.fixture_id}`)
        } else {
          summary.failed++
          summary.exitCode = 1
          summary.failures.push({
            id:   fixture.fixture_id,
            code: 'DIFF_FAILURE',
            diff: result.diff
          })
          console.error(`[FAIL] ${fixture.fixture_id}`)
          if (options.stopOnFirstFailure) break
        }
      } catch (err) {
        summary.failed++
        summary.exitCode = 1
        summary.failures.push({
          id:      fixture.fixture_id,
          code:    err.code  ?? 'UNKNOWN',
          name:    err.name  ?? 'Error',
          message: err.message
        })
        console.error(`[FAIL] ${fixture.fixture_id} - CRASH: ${err.message}`)
        if (options.stopOnFirstFailure) break
      }
    }

    summary.hashes = Object.keys(summary.hashes)
      .sort()
      .reduce((acc, key) => ({ ...acc, [key]: summary.hashes[key] }), {})

    return summary
  }

  static _validateFixtureShape(f) {
    if (
      typeof f.snapshot_version !== 'string' ||
      typeof f.fixture_id       !== 'string' ||
      typeof f.input_payload    !== 'object' || f.input_payload === null ||
      typeof f.expected_output_snapshot !== 'object' || f.expected_output_snapshot === null
    ) {
      throw new Error(`INVALID_FIXTURE_SHAPE: ${f.fixture_id || 'UNKNOWN'}`)
    }
  }
}
