// backend/src/testing/baselineManifest.js
//
// Immutable governance manifest for the S2.17-E1 homologated baseline.
// Defines the canonical fixture set and approved runtime matrix.
// DO NOT modify without a full governance review and regression pass.

export const BASELINE_MANIFEST = Object.freeze({
  snapshotVersion:     '1.0.0',
  approvedFixtures:    Object.freeze([
    'GOLDEN_001_VALID_PROJECT',
    'GOLDEN_002_COLD_OVERVOLTAGE',
    'GOLDEN_003_MPPT_STRING_IMBALANCE'
  ]),
  homologatedRuntimes: Object.freeze(['18', '20', '22'])
})
