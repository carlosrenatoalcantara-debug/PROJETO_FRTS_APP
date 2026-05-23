# Governance Freeze v2 - Git Command Sequence

## COMMAND SEQUENCE (Do NOT execute until approved)

### PHASE 1: Composition Layer Commit

```bash
# Stage governance-critical files only
git add backend/src/electrical/validators/electricalRulesValidator.js
git add tests/fixtures/golden/GOLDEN_201_HYBRID_VALID.json
git add tests/fixtures/golden/GOLDEN_202_HYBRID_BESS_FAIL.json
git add tests/fixtures/golden/GOLDEN_203_HYBRID_FV_FAIL.json

# Optional: Add governance documentation
git add COMPOSITION_LAYER_IMPLEMENTATION_REPORT.md
git add RUNTIME_PARITY_REPORT.md
git add regression-report.json

# Create freeze commit
git commit -m "feat(s2.18-a1): Add composition layer orchestration with hybrid FV+BESS support

- Implement conditional routing for FV-only, BESS-only, and hybrid validator paths
- Add BESS validacoes merging into main validacoes object (conditional AND for corrente)
- Update approval logic to enforce both-domains-must-pass for hybrid projects
- Create 3 new golden fixtures for hybrid orchestration testing (GOLDEN_201-203)
- All FV baseline hashes remain byte-identical (zero drift)
- Regression suite: 9/9 PASS (3 v1 FV + 3 BESS + 3 Hybrid)
- Ready for GOLDEN_BASELINE_v2_BESS_FOUNDATION homologation

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"

# Verify commit
git log -1 --oneline
git diff HEAD~1..HEAD --stat
```

### PHASE 2: Tag Immutable Baseline v2

```bash
# Create immutable tag for v2 BESS Foundation
git tag -a v2_BESS_FOUNDATION -m "GOLDEN_BASELINE_v2_BESS_FOUNDATION

Production-ready governance freeze for BESS domain foundation.

Fixtures (9 total):
- GOLDEN_001-003: v1 FV baseline (immutable, byte-identical)
- GOLDEN_101-103: BESS-only domain foundation
- GOLDEN_201-203: Hybrid FV+BESS composition layer orchestration

Governance:
- Composition layer orchestrator implemented in electricalRulesValidator.js
- Conditional routing: FV-only, BESS-only, Hybrid paths
- Hybrid aggregation: Merged validacoes, conditional AND approval, deduped alertas
- Zero breaking changes: ProjectDTO unchanged, FV validators unchanged, snapshots unchanged
- All hashes verified: 3 immutable (v1), 6 new (v2)

Ready for CI matrix re-homologation on develop merge (Node 18/20/22).
Ready for S2.18-A2 EV domain implementation."

# Verify tag
git tag -l v2_BESS_FOUNDATION
git show v2_BESS_FOUNDATION --stat
```

### PHASE 3: Push to Remote (develop)

```bash
# Push commit to develop
git push origin develop

# Push tag to remote
git push origin v2_BESS_FOUNDATION

# Verify pushed state
git branch -v
git tag -l v2_BESS_FOUNDATION
```

### PHASE 4: Create Isolated EV Branch

```bash
# Create feature branch for S2.18-A2 EV domain
# Base: current develop (with composition layer)
git checkout -b feature/s2.18-a2-ev-domain

# Verify branch isolation
git log --oneline develop..feature/s2.18-a2-ev-domain
git status
```

---

## PRE-EXECUTION CHECKLIST

Before running ANY of the above commands, verify:

- [ ] `git status --short` shows only governance-critical files staged
- [ ] `git diff --cached` shows only electricalRulesValidator + GOLDEN_20*.json
- [ ] No untracked governance artifacts will be committed
- [ ] Commit message follows project conventions
- [ ] Tag name `v2_BESS_FOUNDATION` is correct and unique
- [ ] Remote `origin` is set to correct repository
- [ ] Current branch is `develop` or feature branch
- [ ] No uncommitted changes outside of staged files

---

## COMMAND STATUS

🔴 **NOT YET EXECUTED** - Awaiting explicit approval to proceed

- [ ] Phase 1: Composition Layer Commit
- [ ] Phase 2: Tag Immutable Baseline v2
- [ ] Phase 3: Push to Remote
- [ ] Phase 4: Create EV Branch

---

## SAFETY NOTES

1. **No Destructive Operations**: All commands are additive (commit, tag, push, branch)
2. **Reversible if Needed**: Commits can be reverted, tags can be deleted, branches can be removed
3. **Remote Safety**: Push to develop only; feature branch stays local until reviewed
4. **Governance Immutable**: v2_BESS_FOUNDATION tag is permanent governance record

---

## ROLLBACK PROCEDURE (if needed)

```bash
# If commit needs to be undone before push:
git reset --soft HEAD~1
git reset HEAD <files>  # unstage individual files

# If tag is created incorrectly before push:
git tag -d v2_BESS_FOUNDATION

# After push, only revert:
git revert <commit-hash>
git push origin develop
```

