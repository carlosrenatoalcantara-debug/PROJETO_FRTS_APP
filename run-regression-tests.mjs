#!/usr/bin/env node

/**
 * Regression Test Runner
 * Executes the golden fixture suite and reports results
 */

import { GoldenSuiteRunner } from './backend/src/testing/goldenSuiteRunner.js'
import fs from 'fs'
import path from 'path'

const fixtureDir = path.join(process.cwd(), 'tests/fixtures/golden')

console.log(`Running regression tests from: ${fixtureDir}\n`)

const summary = GoldenSuiteRunner.run({ fixtureDir })

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
console.log(`Total:    ${summary.total}`)
console.log(`Passed:   ${summary.passed}`)
console.log(`Failed:   ${summary.failed}`)
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

// Write summary to JSON file
fs.writeFileSync(
  'regression-report.json',
  JSON.stringify(summary, null, 2),
  'utf-8'
)

console.log('Report saved to: regression-report.json')
process.exit(summary.exitCode)
