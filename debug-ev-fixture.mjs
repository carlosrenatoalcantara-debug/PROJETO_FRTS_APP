#!/usr/bin/env node

import fs from 'fs'
import { validateElectricalRules } from './backend/src/electrical/validators/electricalRulesValidator.js'
import { serialize } from './backend/src/testing/snapshotSerializer.js'

const fixtureFile = process.argv[2] || 'tests/fixtures/golden/EV_VALID_LIMIT.json'

console.log(`Loading fixture: ${fixtureFile}\n`)

const fixture = JSON.parse(fs.readFileSync(fixtureFile, 'utf-8'))
const inputPayload = fixture.input_payload

console.log('Input Payload:')
console.log(JSON.stringify(inputPayload, null, 2))
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

try {
  const actual = validateElectricalRules(inputPayload)
  console.log('Actual Output:')
  console.log(JSON.stringify(actual, null, 2))

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('Expected Output (from fixture):')
  console.log(JSON.stringify(fixture.expected_output_snapshot, null, 2))

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const serialized = serialize(actual)
  console.log('Serialized Output:')
  console.log(serialized)
} catch (err) {
  console.error('ERROR:', err.message)
  console.error('Code:', err.code)
  console.error('Stack:', err.stack)
  process.exit(1)
}
