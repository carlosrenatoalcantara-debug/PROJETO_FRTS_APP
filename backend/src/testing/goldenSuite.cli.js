#!/usr/bin/env node
// backend/src/testing/goldenSuite.cli.js

import { parseArgs }       from 'node:util'
import fs                  from 'fs'
import { GoldenSuiteRunner } from './goldenSuiteRunner.js'

const { values } = parseArgs({
  options: {
    'fixture-dir': { type: 'string' },
    'fail-fast':   { type: 'boolean' },
    'json':        { type: 'boolean' }
  }
})

let summary
try {
  summary = GoldenSuiteRunner.run({
    fixtureDir: typeof values['fixture-dir'] === 'string' && values['fixture-dir'].trim() !== ''
      ? values['fixture-dir']
      : null,
    stopOnFirstFailure: !!values['fail-fast']
  })
} catch (err) {
  console.error('[FATAL] CLI_RUNTIME_CRASH:', err.message)
  if (process.env.DEBUG === 'true') {
    console.error(err.stack)
  }
  process.exit(1)
}

const output = JSON.stringify(summary, null, 2)

if (values.json) {
  process.stdout.write(output + '\n')
  try {
    fs.writeFileSync('regression-report.json', output, 'utf8')
  } catch (writeErr) {
    console.error('[WARN] Could not write regression-report.json:', writeErr.message)
  }
} else {
  console.log(`\nSUMMARY: ${summary.passed}/${summary.total} PASSED | FAILED=${summary.failed}`)
}

process.exit(summary.exitCode)
