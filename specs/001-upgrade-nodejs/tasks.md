# Tasks: Upgrade NodeJS to LTS v24

## Phase 1: Setup

- [ ] T001 Ensure NodeJS v24 is installed on all developer machines
- [ ] T002 Update documentation to specify NodeJS v24 requirement in README.md and dev-docs/README.md
- [ ] T003 Update Dockerfile to use FROM node:24
- [ ] T004 Update CI/CD configuration files to use NodeJS v24 (e.g., .github/workflows/\*, scripts/build-node.js)
- [ ] T005 [P] Update package.json engines field to require NodeJS v24

## Phase 2: Foundational

- [ ] T006 Audit all dependencies for NodeJS v24 compatibility (package.json, packages/\*/package.json)
- [ ] T007 [P] Upgrade any incompatible dependencies
- [ ] T008 [P] Run npm install to update lockfiles
- [ ] T009 [P] Run all automated tests to verify upgrade (npm test)
- [ ] T010 [P] Update changelog to document NodeJS upgrade (scripts/updateChangelog.js)

## Phase 3: User Story 1 - NodeJS Upgrade (Priority: P1)

- [ ] T011 [US1] Validate all tests pass after NodeJS v24 upgrade
- [ ] T012 [P] [US1] Verify no new vulnerabilities are reported (CI scan)
- [ ] T013 [US1] Confirm no compatibility issues or deprecation warnings occur

## Phase 4: User Story 2 - Developer Onboarding (Priority: P2)

- [ ] T014 [US2] Update onboarding guides to reference NodeJS v24 (dev-docs/introduction/)
- [ ] T015 [P] [US2] Test onboarding flow with NodeJS v24

## Phase 5: User Story 3 - CI/CD Compatibility (Priority: P3)

- [ ] T016 [US3] Update CI/CD pipeline documentation to reference NodeJS v24
- [ ] T017 [P] [US3] Run full pipeline with NodeJS v24 and verify success

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T018 Review all documentation for consistency and verify all references to NodeJS v24
- [ ] T019 [P] Confirm all contributors are using NodeJS v24 by checking their reported node --version
- [ ] T020 [P] Final audit for environment drift between local and CI/CD by comparing NodeJS versions and dependency lists
- [ ] T021 [P] Run performance regression tests and compare results to previous NodeJS version benchmarks

## Dependencies

- Phase 1 (Setup) must be completed before Phase 2 (Foundational)
- Phase 2 must be completed before any User Story phases
- User Story phases (3, 4, 5) are independent and can be executed in parallel after foundational tasks
- Final Phase tasks can be executed after all user stories are complete

## Parallel Execution Examples

- T005, T007, T008, T009, T010 can be executed in parallel after initial setup
- T012, T015, T017, T019, T020 can be executed in parallel after foundational and story-specific tasks

## Implementation Strategy

- MVP scope: Complete Phase 1, Phase 2, and User Story 1 (P1)
- Incremental delivery: Complete onboarding and CI/CD compatibility in parallel after MVP

## Independent Test Criteria

- Each user story phase includes a testable outcome (see spec.md)
- All tasks are independently executable and verifiable
