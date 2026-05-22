# GOLDEN BASELINE v1 — Deterministic Governance Checkpoint

**Sprint:** S2.17-E1  
**Status:** PENDING EMPIRICAL HOMOLOGATION  
**Freeze Timestamp:** `2026-05-22T20:30:00Z`

---

## 1. Purpose

This document is the authoritative record of the S2.17-E1 homologated deterministic baseline for the Forte Solar electrical governance platform. It captures the empirically validated output hashes produced by the Golden Regression Matrix across all three approved Node.js runtimes.

Once the placeholders are replaced with empirically validated values, this document becomes a governance-grade forensic artifact. Any future divergence from these hashes constitutes a governance violation requiring triage before merge.

---

## 2. Homologated Runtime Matrix

| Runtime | Status |
|---|---|
| Node.js 18 (LTS) | PENDING |
| Node.js 20 (LTS) | PENDING |
| Node.js 22 (Current) | PENDING |

**Parity requirement:** All three runtimes must produce byte-identical `regression-report.json` output. `validateRuntimeParity()` must return `{ valid: true }`.

---

## 3. Approved Fixture Set

| Fixture ID | Description | Expected `aprovado` | Expected `score_eletrico` |
|---|---|---|---|
| `GOLDEN_001_VALID_PROJECT` | Valid single-string project, all limits respected | `true` | `1.0` |
| `GOLDEN_002_COLD_OVERVOLTAGE` | Cold Voc overvoltage — 18 modules at T_min=-5°C | `false` | `0.1` |
| `GOLDEN_003_MPPT_STRING_IMBALANCE` | Mixed-module MPPT input — balance fingerprint mismatch | `true` | `0.7` |

---

## 4. Empirically Validated Hashes

These hashes are produced by `RegressionManager.run()` using `snapshotSerializer` (SHA-256 of the canonically sorted, transient-stripped output). They must be identical across Node 18, 20, and 22.

| Fixture ID | SHA-256 Hash |
|---|---|
| `GOLDEN_001_VALID_PROJECT` | `e1d5cca8fdf717df315a20d0908ce081c93872c2911e45ba4017e2f1657ca354` |
| `GOLDEN_002_COLD_OVERVOLTAGE` | `6d9670596cc1a9047a9c8c84eb0682f1c16030dfea52fa31c144088e706e9664` |
| `GOLDEN_003_MPPT_STRING_IMBALANCE` | `6c989dc34afa16fcd80c9db61dd50b816cfc4b6d5a8f50c7847f9e0beb8699fd` |

---

## 5. Invariant Contracts

The following invariants are enforced by `contractInvariantGuard.js` on every regression run:

- `aprovado` is a strict boolean (`true` or `false`, never `null`, `undefined`, or truthy string)
- `score_eletrico` is a finite number in the closed interval `[0, 1]`
- `falhas` is an array of non-empty strings (ERR-prefixed alert codes)
- `alertas` is an array of non-empty strings (WARN-prefixed alert codes)
- `validacoes` is a plain object where every value is a strict boolean

---

## 6. Transient Fields Stripped by Serializer

The following fields are excluded from snapshot comparison to ensure cross-run determinism:

```
timestamp
traceId
parentTraceId
engineModule
stack
hash
```

---

## 7. Drift Detection Policy

Any change to the electrical engine, DTO contracts, serializer semantics, or fixture inputs that produces a hash delta against the values in Section 4 is classified as a **governance drift event**.

Governance drift events require:
1. Root cause analysis
2. Explicit approval from the engineering lead
3. Full re-homologation run (Node 18 + 20 + 22)
4. Update of this document with new empirically validated hashes
5. New governance tag (`GOLDEN_BASELINE_v2`, etc.)

---

## 8. Forensic Audit Policy

- This document must not be modified outside of a formal governance review
- Hash values must be sourced exclusively from CI artifact downloads — never hand-calculated
- The `GOLDEN_BASELINE_v1` git tag points to the exact commit where these hashes were first confirmed
- Any PR that modifies `tests/fixtures/golden/` must re-run the full matrix and update this document

---

## 9. Governance Tag

```
GOLDEN_BASELINE_v1
```

Created after empirical homologation success. Points to the freeze commit on `main`.
